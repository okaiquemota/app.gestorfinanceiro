// Plano, teste grátis e pagamento pela Stripe (Checkout).
//
//  - mensal no cartão: assinatura, renova sozinha;
//  - anual (cartão parcelado ou boleto) e mensal no boleto: pagamento único,
//    que libera os dias do período comprado.
//
// Todo pagamento carrega o id do usuário do Poupin (client_reference_id e
// metadata), então a Stripe sempre diz de quem é.

import type { Billing } from '../shared/types.ts'

export type BillingEnv = {
  DB: D1Database
  /** Chave secreta da Stripe (sk_test_… ou sk_live_…). Sem ela a cobrança fica desligada. */
  STRIPE_SECRET_KEY?: string
  /** Segredo de assinatura do webhook (whsec_…). */
  STRIPE_WEBHOOK_SECRET?: string
  /** Preço mensal em centavos. */
  PLAN_PRICE_CENTS?: string
  /** Preço do plano anual em centavos (padrão: 10 mensalidades). */
  ANNUAL_PRICE_CENTS?: string
  TRIAL_DAYS?: string
}

export type PlanRow = {
  plan: string
  trial_ends_at: string | null
  paid_until: string | null
}

const DAY = 86_400_000
const STRIPE = 'https://api.stripe.com/v1'
/** Folga depois do vencimento, pra cobrança que atrasa um pouco não bloquear ninguém. */
const GRACE_DAYS = 3
/** Dias liberados por pagamento único, conforme o período comprado. */
const PERIOD_DAYS = { month: 30, year: 365 } as const
export type Period = keyof typeof PERIOD_DAYS
export type Method = 'card' | 'boleto'

export const priceCents = (env: BillingEnv): number => Number(env.PLAN_PRICE_CENTS) || 1490
export const annualCents = (env: BillingEnv): number => Number(env.ANNUAL_PRICE_CENTS) || priceCents(env) * 10
const periodCents = (env: BillingEnv, period: Period): number => (period === 'year' ? annualCents(env) : priceCents(env))
export const trialDays = (env: BillingEnv): number => Number(env.TRIAL_DAYS) || 14
export const trialEnd = (env: BillingEnv): string => new Date(Date.now() + trialDays(env) * DAY).toISOString()

export const billingFor = (u: PlanRow, env: BillingEnv): Billing => {
  const now = new Date().toISOString()
  const enabled = !!env.STRIPE_SECRET_KEY
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
    annual_price_cents: annualCents(env),
    trial_days: trialDays(env),
    trial_days_left: inTrial ? left(u.trial_ends_at!) : 0,
    paid_until: u.paid_until,
    paid_days_left: paid ? left(u.paid_until!) : 0,
  }
}

type Json = Record<string, unknown>

/** A API da Stripe recebe formulário, com chaves aninhadas no estilo a[b][c]. */
const form = (obj: Json, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v === undefined || v === null) return []
    if (typeof v === 'object') return form(v as Json, key)
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`]
  })

const stripe = async (env: BillingEnv, method: string, path: string, body?: Json): Promise<Json> => {
  const res = await fetch(STRIPE + path, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body ? form(body).join('&') : undefined,
  })
  const data = (await res.json().catch(() => null)) as Json | null
  if (!res.ok) {
    const message = ((data?.error as Json | undefined)?.message as string | undefined) ?? ''
    console.error('Stripe', method, path, res.status, message)
    throw new Error(`Stripe respondeu ${res.status}: ${message}`)
  }
  return data ?? {}
}

// ---------- abrir o pagamento ----------

/** Cria a sessão de checkout e devolve o endereço da página de pagamento da Stripe. */
export const createCheckout = async (
  env: BillingEnv,
  user: { id: string; email: string; stripe_customer_id: string | null },
  origin: string,
  period: Period,
  method: Method,
): Promise<string> => {
  const recurring = period === 'month' && method === 'card'
  const meta = { user_id: user.id, period }
  const session = await stripe(env, 'POST', '/checkout/sessions', {
    mode: recurring ? 'subscription' : 'payment',
    client_reference_id: user.id,
    metadata: meta,
    // reaproveita o cliente da Stripe quando já existe; senão, só preenche o e-mail
    ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
    locale: 'pt-BR',
    success_url: `${origin}/assinatura?pagamento=retorno&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/assinatura`,
    payment_method_types: [method],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: periodCents(env, period),
          product_data: { name: recurring ? 'Poupin — plano mensal' : period === 'year' ? 'Poupin — plano anual (12 meses)' : 'Poupin — 30 dias' },
          ...(recurring ? { recurring: { interval: 'month' } } : {}),
        },
      },
    ],
    ...(recurring ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
    // anual no cartão: a Stripe oferece o parcelamento disponível para o cartão da pessoa
    ...(period === 'year' && method === 'card' ? { payment_method_options: { card: { installments: { enabled: true } } } } : {}),
  })
  if (typeof session.url !== 'string') throw new Error('Stripe não devolveu o link de pagamento')
  return session.url
}

// ---------- registrar o que foi pago ----------

/** Fim do período em vigor de uma assinatura (o campo mudou de lugar entre versões da API). */
const periodEnd = (sub: Json): number | null => {
  if (typeof sub.current_period_end === 'number') return sub.current_period_end
  const item = ((sub.items as Json | undefined)?.data as Json[] | undefined)?.[0]
  return typeof item?.current_period_end === 'number' ? item.current_period_end : null
}

/** Grava no usuário a situação atual de uma assinatura da Stripe. */
export const applySubscription = async (env: BillingEnv, sub: Json, userHint?: string): Promise<void> => {
  const db = env.DB
  const id = String(sub.id)
  const userId =
    (await db.prepare('SELECT id FROM users WHERE stripe_subscription_id = ?').bind(id).first<{ id: string }>())?.id ??
    ((sub.metadata as Json | undefined)?.user_id as string | undefined) ??
    userHint
  if (!userId) return console.error('Stripe: assinatura sem usuário', id)

  const end = periodEnd(sub)
  const until = new Date((end ? end * 1000 : Date.now() + 31 * DAY) + GRACE_DAYS * DAY).toISOString()
  if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
    // "cancelar no fim do período": continua valendo até lá, mas já não renova
    const plan = sub.cancel_at_period_end ? 'cancelled' : 'active'
    await db
      .prepare("UPDATE users SET plan = ?, paid_until = ?, stripe_subscription_id = ?, stripe_customer_id = ? WHERE id = ? AND plan != 'lifetime'")
      .bind(plan, until, id, typeof sub.customer === 'string' ? sub.customer : null, userId)
      .run()
  } else if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
    // encerrada: o acesso vale até o fim do que já estava pago
    await db
      .prepare("UPDATE users SET plan = 'cancelled', stripe_subscription_id = NULL WHERE id = ? AND stripe_subscription_id = ?")
      .bind(userId, id)
      .run()
  }
}

/**
 * Contabiliza uma sessão de checkout concluída. Assinatura: liga e sincroniza.
 * Pagamento único: soma os dias do período, uma vez só, com o valor conferido.
 */
export const applySession = async (env: BillingEnv, session: Json, onlyUser?: string): Promise<boolean> => {
  const db = env.DB
  const userId = typeof session.client_reference_id === 'string' ? session.client_reference_id : ''
  if (!userId || (onlyUser && onlyUser !== userId)) return false
  const customer = typeof session.customer === 'string' ? session.customer : null

  if (session.mode === 'subscription') {
    if (typeof session.subscription !== 'string') return false
    await applySubscription(env, await stripe(env, 'GET', `/subscriptions/${session.subscription}`), userId)
    return true
  }

  // boleto fica "unpaid" até compensar; o aviso de pagamento chega depois
  if (session.payment_status !== 'paid') return false
  const period: Period = (session.metadata as Json | undefined)?.period === 'year' ? 'year' : 'month'
  // valor conferido no servidor: ninguém libera um período pagando menos do que ele custa
  if (typeof session.amount_subtotal !== 'number' || session.amount_subtotal < periodCents(env, period)) return false
  const user = await db.prepare('SELECT paid_until FROM users WHERE id = ?').bind(userId).first<{ paid_until: string | null }>()
  if (!user) return false

  const fresh = await db
    .prepare('INSERT OR IGNORE INTO billing_payments (id, user_id, created_at) VALUES (?, ?, ?)')
    .bind(String(session.id), userId, new Date().toISOString())
    .run()
  if (!fresh.meta.changes) return true // já contabilizado

  const from = Math.max(Date.now(), user.paid_until ? Date.parse(user.paid_until) : 0)
  const until = new Date(from + PERIOD_DAYS[period] * DAY).toISOString()
  await db
    // quem tem assinatura no cartão ativa continua "active"; os demais ficam com período pago
    .prepare(
      "UPDATE users SET paid_until = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), plan = CASE WHEN plan = 'active' THEN 'active' ELSE 'prepaid' END WHERE id = ? AND plan != 'lifetime'",
    )
    .bind(until, customer, userId)
    .run()
  return true
}

/** Ao voltar do pagamento: confere a sessão sem esperar o aviso automático. */
export const syncSession = async (env: BillingEnv, sessionId: string, userId: string): Promise<void> => {
  await applySession(env, await stripe(env, 'GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`), userId)
}

export const syncSubscription = async (env: BillingEnv, subscriptionId: string): Promise<void> => {
  await applySubscription(env, await stripe(env, 'GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`))
}

/** Cancela no fim do período já pago (a pessoa não perde o que pagou). */
export const cancelAtPeriodEnd = async (env: BillingEnv, subscriptionId: string): Promise<void> => {
  await applySubscription(env, await stripe(env, 'POST', `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: true }))
}

/** Encerra na hora (usado ao excluir a conta). */
export const cancelNow = async (env: BillingEnv, subscriptionId: string): Promise<void> => {
  await stripe(env, 'DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`)
}

// ---------- webhook ----------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Confere o cabeçalho Stripe-Signature ("t=…,v1=…"): HMAC-SHA256 de "<t>.<corpo>"
 * com o segredo do webhook, e recusa avisos com mais de 5 minutos.
 */
export const validWebhook = async (secret: string, header: string | undefined, payload: string): Promise<boolean> => {
  const parts = (header ?? '').split(',').map((kv) => kv.trim().split('='))
  const t = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || sigs.length === 0 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)))
  return sigs.some((sig) => {
    if (sig.length !== mac.length) return false
    let diff = 0
    for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ sig.charCodeAt(i)
    return diff === 0
  })
}

/** Webhook: trata os avisos que mudam o acesso de alguém. */
export const handleWebhook = async (env: BillingEnv, event: Json): Promise<void> => {
  const type = String(event.type)
  const obj = ((event.data as Json | undefined)?.object ?? {}) as Json
  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    await applySession(env, obj)
  } else if (type.startsWith('customer.subscription.')) {
    await applySubscription(env, obj)
  } else if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
    // renovação: busca a assinatura pra pegar o novo fim de período
    const sub = obj.subscription ?? ((obj.parent as Json | undefined)?.subscription_details as Json | undefined)?.subscription
    if (typeof sub === 'string') await syncSubscription(env, sub)
  }
}
