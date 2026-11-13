// Plano, teste grátis e assinatura pelo Mercado Pago (API de assinaturas / "preapproval").

import type { Billing } from '../shared/types.ts'

export type BillingEnv = {
  DB: D1Database
  /** Access token de produção do Mercado Pago. Sem ele a cobrança fica desligada. */
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
          : 'active'
        : inTrial
          ? 'trial'
          : 'expired'
  return {
    status,
    // Enquanto a cobrança não estiver configurada ninguém é bloqueado:
    // não faz sentido travar a pessoa sem dar a ela como pagar.
    access: status !== 'expired' || !enabled ? 'full' : 'readonly',
    enabled,
    price_cents: priceCents(env),
    trial_days: trialDays(env),
    trial_days_left: inTrial ? Math.max(1, Math.ceil((Date.parse(u.trial_ends_at!) - Date.now()) / DAY)) : 0,
    paid_until: u.paid_until,
  }
}

const mp = async (env: BillingEnv, method: string, path: string, body?: unknown) => {
  const res = await fetch(MP + path, {
    method,
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    console.error('Mercado Pago', method, path, res.status, JSON.stringify(data))
    throw new Error(`Mercado Pago respondeu ${res.status}`)
  }
  return data ?? {}
}

/** Cria a assinatura e devolve o endereço do checkout do Mercado Pago. */
export const createCheckout = async (
  env: BillingEnv,
  user: { id: string; email: string },
  origin: string,
): Promise<string> => {
  const data = await mp(env, 'POST', '/preapproval', {
    reason: 'Poupin — assinatura mensal',
    external_reference: user.id,
    payer_email: user.email,
    back_url: `${origin}/ajustes?assinatura=retorno`,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: priceCents(env) / 100,
      currency_id: 'BRL',
    },
  })
  if (typeof data.id === 'string')
    await env.DB.prepare('UPDATE users SET mp_preapproval_id = ? WHERE id = ?').bind(data.id, user.id).run()
  if (typeof data.init_point !== 'string') throw new Error('Mercado Pago não devolveu o link de pagamento')
  return data.init_point
}

/** Lê a assinatura no Mercado Pago e grava a situação no usuário dono dela. */
export const syncPreapproval = async (env: BillingEnv, preapprovalId: string): Promise<void> => {
  const p = await mp(env, 'GET', `/preapproval/${encodeURIComponent(preapprovalId)}`)
  const userId = typeof p.external_reference === 'string' ? p.external_reference : null
  if (!userId) return
  if (p.status === 'authorized') {
    const next = typeof p.next_payment_date === 'string' ? Date.parse(p.next_payment_date) : NaN
    const until = new Date((Number.isNaN(next) ? Date.now() + 31 * DAY : next) + GRACE_DAYS * DAY).toISOString()
    await env.DB.prepare(
      "UPDATE users SET plan = 'active', paid_until = ?, mp_preapproval_id = ? WHERE id = ? AND plan != 'lifetime'",
    )
      .bind(until, preapprovalId, userId)
      .run()
  } else if (p.status === 'cancelled' || p.status === 'paused') {
    // quem cancela continua com acesso até o fim do período já pago
    await env.DB.prepare("UPDATE users SET plan = 'cancelled' WHERE id = ? AND mp_preapproval_id = ? AND plan = 'active'")
      .bind(userId, preapprovalId)
      .run()
  }
}

export const cancelPreapproval = async (env: BillingEnv, preapprovalId: string): Promise<void> => {
  await mp(env, 'PUT', `/preapproval/${encodeURIComponent(preapprovalId)}`, { status: 'cancelled' })
}

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

/** Webhook: descobre de qual assinatura o aviso fala e sincroniza. */
export const handleWebhook = async (env: BillingEnv, type: string, dataId: string): Promise<void> => {
  if (type === 'subscription_preapproval') return syncPreapproval(env, dataId)
  if (type === 'subscription_authorized_payment') {
    const pay = await mp(env, 'GET', `/authorized_payments/${encodeURIComponent(dataId)}`)
    const id = pay.preapproval_id
    if (typeof id === 'string') return syncPreapproval(env, id)
  }
}
