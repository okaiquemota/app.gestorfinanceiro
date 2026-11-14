// Plano, teste grátis e pagamento pelo Mercado Pago.
//
// Duas formas de pagar, e nenhuma pede dado do pagador dentro do Poupin — a
// pessoa se identifica na página do Mercado Pago:
//  - cartão com renovação automática: assinatura de um plano ("preapproval_plan");
//  - Pix, boleto ou cartão avulso: Checkout Pro; cada pagamento libera 30 dias.

import type { Billing } from '../shared/types.ts'

export type BillingEnv = {
  DB: D1Database
  /** Access token do Mercado Pago. Sem ele a cobrança fica desligada. */
  MP_ACCESS_TOKEN?: string
  /** Assinatura secreta dos webhooks (painel do Mercado Pago). */
  MP_WEBHOOK_SECRET?: string
  /** Preço mensal em centavos. */
  PLAN_PRICE_CENTS?: string
  TRIAL_DAYS?: string
}

export type PlanRow = {
  plan: string
  trial_ends_at: string | null
  paid_until: string | null
}

const DAY = 86_400_000
const MP = 'https://api.mercadopago.com'
/** Folga depois do vencimento, pra cobrança que atrasa um pouco não bloquear ninguém. */
const GRACE_DAYS = 3
/** Dias liberados por pagamento avulso. */
const PREPAID_DAYS = 30
/** Janela pra ligar uma assinatura sem dono a quem acabou de clicar em assinar. */
const INTENT_WINDOW = 45 * 60_000

export const priceCents = (env: BillingEnv): number => Number(env.PLAN_PRICE_CENTS) || 1490
export const trialDays = (env: BillingEnv): number => Number(env.TRIAL_DAYS) || 14
export const trialEnd = (env: BillingEnv): string => new Date(Date.now() + trialDays(env) * DAY).toISOString()

export const billingFor = (u: PlanRow, env: BillingEnv): Billing => {
  const now = new Date().toISOString()
  const enabled = !!env.MP_ACCESS_TOKEN
  const paid = !!u.paid_until && now < u.paid_until
  const inTrial = !!u.trial_ends_at && now < u.trial_ends_at
  const status: Billing['status'] =
    u.plan === 'lifetime'
      ? 'lifetime'
      : paid
        ? u.plan === 'cancelled'
          ? 'cancelled'
          : u.plan === 'prepaid'
            ? 'prepaid'
            : 'active'
        : inTrial
          ? 'trial'
          : 'expired'
  const left = (iso: string) => Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / DAY))
  return {
    status,
    // Enquanto a cobrança não estiver configurada ninguém é bloqueado:
    // não faz sentido travar a pessoa sem dar a ela como pagar.
    access: status !== 'expired' || !enabled ? 'full' : 'readonly',
    enabled,
    price_cents: priceCents(env),
    trial_days: trialDays(env),
    trial_days_left: inTrial ? left(u.trial_ends_at!) : 0,
    paid_until: u.paid_until,
    paid_days_left: paid ? left(u.paid_until!) : 0,
  }
}

type Json = Record<string, unknown>

const mp = async (env: BillingEnv, method: string, path: string, body?: unknown): Promise<Json> => {
  const res = await fetch(MP + path, {
    method,
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as Json | null
  if (!res.ok) {
    console.error('Mercado Pago', method, path, res.status, JSON.stringify(data))
    throw new Error(`Mercado Pago respondeu ${res.status}: ${typeof data?.message === 'string' ? data.message : ''}`)
  }
  return data ?? {}
}

const setting = async (db: D1Database, key: string): Promise<string | null> =>
  (await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>())?.value ?? null

// ---------- cartão com renovação automática ----------

/** O plano de assinatura é criado uma vez por preço e reaproveitado. */
const ensurePlan = async (env: BillingEnv, origin: string): Promise<{ id: string; url: string }> => {
  const key = `mp_plan_${priceCents(env)}`
  const saved = await setting(env.DB, key)
  if (saved) return JSON.parse(saved) as { id: string; url: string }
  const data = await mp(env, 'POST', '/preapproval_plan', {
    reason: 'Poupin — assinatura mensal',
    back_url: `${origin}/ajustes?assinatura=retorno`,
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: priceCents(env) / 100, currency_id: 'BRL' },
  })
  if (typeof data.id !== 'string' || typeof data.init_point !== 'string') throw new Error('Mercado Pago não devolveu o plano')
  const plan = { id: data.id, url: data.init_point }
  await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, JSON.stringify(plan)).run()
  return plan
}

const ourPlanIds = async (db: D1Database): Promise<Set<string>> => {
  const rows = await db.prepare("SELECT value FROM settings WHERE key LIKE 'mp_plan_%'").all<{ value: string }>()
  return new Set(rows.results.map((r) => (JSON.parse(r.value) as { id: string }).id))
}

/** Endereço da página do Mercado Pago pra assinar no cartão. */
export const cardCheckout = async (env: BillingEnv, userId: string, origin: string): Promise<string> => {
  const plan = await ensurePlan(env, origin)
  await env.DB.prepare('UPDATE users SET billing_intent_at = ? WHERE id = ?').bind(Date.now(), userId).run()
  return plan.url
}

/**
 * Grava a situação de uma assinatura. O plano não carrega quem é o usuário do
 * Poupin, então o dono é: quem já está ligado a ela; senão `claimant` (quem
 * voltou do Mercado Pago com o id); senão a única pessoa que clicou em assinar
 * há pouco. Devolve se achou o dono.
 */
export const syncPreapproval = async (env: BillingEnv, preapprovalId: string, claimant?: string): Promise<boolean> => {
  const db = env.DB
  const p = await mp(env, 'GET', `/preapproval/${encodeURIComponent(preapprovalId)}`)
  if (typeof p.preapproval_plan_id !== 'string' || !(await ourPlanIds(db)).has(p.preapproval_plan_id)) return false

  let owner = (await db.prepare('SELECT id FROM users WHERE mp_preapproval_id = ?').bind(preapprovalId).first<{ id: string }>())?.id
  if (!owner && claimant) owner = claimant
  if (!owner) {
    const waiting = await db
      .prepare("SELECT id FROM users WHERE billing_intent_at > ? AND mp_preapproval_id IS NULL AND plan != 'lifetime' LIMIT 2")
      .bind(Date.now() - INTENT_WINDOW)
      .all<{ id: string }>()
    // só liga sozinho se não houver dúvida de quem é
    if (waiting.results.length === 1) owner = waiting.results[0].id
  }
  if (!owner) {
    console.error('Mercado Pago: assinatura sem dono identificado', preapprovalId)
    return false
  }

  if (p.status === 'authorized') {
    const next = typeof p.next_payment_date === 'string' ? Date.parse(p.next_payment_date) : NaN
    const until = new Date((Number.isNaN(next) ? Date.now() + 31 * DAY : next) + GRACE_DAYS * DAY).toISOString()
    await db
      .prepare("UPDATE users SET plan = 'active', paid_until = ?, mp_preapproval_id = ?, billing_intent_at = NULL WHERE id = ? AND plan != 'lifetime'")
      .bind(until, preapprovalId, owner)
      .run()
  } else if (p.status === 'cancelled' || p.status === 'paused') {
    // quem cancela continua com acesso até o fim do período já pago
    await db.prepare("UPDATE users SET plan = 'cancelled' WHERE id = ? AND mp_preapproval_id = ? AND plan = 'active'").bind(owner, preapprovalId).run()
  }
  return true
}

export const cancelPreapproval = async (env: BillingEnv, preapprovalId: string): Promise<void> => {
  await mp(env, 'PUT', `/preapproval/${encodeURIComponent(preapprovalId)}`, { status: 'cancelled' })
}

// ---------- Pix, boleto ou cartão avulso ----------

/** Endereço da página do Mercado Pago pra pagar um mês. */
export const oneOffCheckout = async (env: BillingEnv, userId: string, origin: string): Promise<string> => {
  const back = `${origin}/ajustes?pagamento=retorno`
  const data = await mp(env, 'POST', '/checkout/preferences', {
    items: [{ title: `Poupin — ${PREPAID_DAYS} dias`, quantity: 1, unit_price: priceCents(env) / 100, currency_id: 'BRL' }],
    external_reference: userId,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    notification_url: `${origin}/api/billing/webhook`,
    statement_descriptor: 'POUPIN',
  })
  if (typeof data.init_point !== 'string') throw new Error('Mercado Pago não devolveu o link de pagamento')
  return data.init_point
}

/**
 * Contabiliza um pagamento avulso aprovado: soma 30 dias a partir de hoje ou do
 * fim do período já pago, o que for mais tarde. Cada pagamento conta uma vez só.
 */
export const applyPayment = async (env: BillingEnv, paymentId: string, onlyUser?: string): Promise<boolean> => {
  const db = env.DB
  const pay = await mp(env, 'GET', `/v1/payments/${encodeURIComponent(paymentId)}`)
  const userId = typeof pay.external_reference === 'string' ? pay.external_reference : ''
  if (pay.status !== 'approved' || !userId || (onlyUser && onlyUser !== userId)) return false
  // valor conferido no servidor: ninguém libera acesso pagando menos
  if (typeof pay.transaction_amount !== 'number' || Math.round(pay.transaction_amount * 100) < priceCents(env)) return false
  const user = await db.prepare('SELECT plan, paid_until FROM users WHERE id = ?').bind(userId).first<{ plan: string; paid_until: string | null }>()
  if (!user) return false

  const fresh = await db
    .prepare('INSERT OR IGNORE INTO mp_payments (id, user_id, created_at) VALUES (?, ?, ?)')
    .bind(String(pay.id ?? paymentId), userId, new Date().toISOString())
    .run()
  if (!fresh.meta.changes) return true // já contabilizado

  const from = Math.max(Date.now(), user.paid_until ? Date.parse(user.paid_until) : 0)
  const until = new Date(from + PREPAID_DAYS * DAY).toISOString()
  await db
    // quem tem assinatura no cartão ativa continua "active"; os demais viram mês a mês
    .prepare("UPDATE users SET paid_until = ?, plan = CASE WHEN plan = 'active' THEN 'active' ELSE 'prepaid' END WHERE id = ? AND plan != 'lifetime'")
    .bind(until, userId)
    .run()
  return true
}

// ---------- webhook ----------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Confere a assinatura do webhook (cabeçalho x-signature: "ts=...,v1=...").
 * O Mercado Pago assina "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256.
 */
export const validWebhook = async (
  secret: string,
  signature: string | undefined,
  requestId: string | undefined,
  dataId: string,
): Promise<boolean> => {
  const parts = Object.fromEntries((signature ?? '').split(',').map((kv) => kv.trim().split('=') as [string, string]))
  if (!parts.ts || !parts.v1) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId ?? ''};ts:${parts.ts};`
  const mac = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  if (mac.length !== parts.v1.length) return false
  let diff = 0
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ parts.v1.charCodeAt(i)
  return diff === 0
}

/** Webhook: descobre de que o aviso fala e atualiza a conta certa. */
export const handleWebhook = async (env: BillingEnv, type: string, dataId: string): Promise<void> => {
  if (type === 'payment') {
    await applyPayment(env, dataId)
  } else if (type === 'subscription_preapproval') {
    await syncPreapproval(env, dataId)
  } else if (type === 'subscription_authorized_payment') {
    const pay = await mp(env, 'GET', `/authorized_payments/${encodeURIComponent(dataId)}`)
    if (typeof pay.preapproval_id === 'string') await syncPreapproval(env, pay.preapproval_id)
  }
}
