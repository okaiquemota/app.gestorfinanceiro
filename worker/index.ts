import { Hono } from 'hono'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppState, User } from '../shared/types.ts'
import { billingFor, cancelPreapproval, createCheckout, handleWebhook, syncPreapproval, trialEnd, validWebhook } from './billing.ts'
import type { BillingEnv, PlanRow } from './billing.ts'
import { emailEnabled, sendEmail } from './email.ts'
import type { EmailEnv } from './email.ts'
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  hashPassword,
  randomHex,
  safeEqual,
  sha256,
} from './auth.ts'

type Env = BillingEnv & EmailEnv & { DB: D1Database }
type HonoEnv = { Bindings: Env; Variables: { userId: string } }
type Ctx = Context<HonoEnv>

class HttpError extends Error {
  status: 400 | 401 | 402 | 403 | 404 | 409 | 429 | 503
  /** Código estável para o front reagir (ex.: abrir a tela de assinatura). */
  code?: string
  constructor(status: HttpError['status'], message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// ---------- validação ----------

type Body = Record<string, unknown>

const text = (b: Body, k: string, { max = 120, min = 1 } = {}): string => {
  const v = b[k]
  if (typeof v !== 'string') throw new HttpError(400, `Campo "${k}" é obrigatório.`)
  const t = v.trim()
  if (t.length < min || t.length > max) throw new HttpError(400, `Campo "${k}" inválido.`)
  return t
}
const optText = (b: Body, k: string, max = 500): string =>
  b[k] == null ? '' : text(b, k, { max, min: 0 })

const int = (b: Body, k: string, min: number, max: number): number => {
  const v = b[k]
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new HttpError(400, `Campo "${k}" inválido.`)
  return v
}
const MAX_CENTS = 100_000_000_000 // R$ 1 bilhão
const cents = (b: Body, k: string, min = 0): number => int(b, k, min, MAX_CENTS)

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const isMonth = (v: unknown): v is string => typeof v === 'string' && MONTH.test(v)
const month = (b: Body, k: string): string => {
  if (!isMonth(b[k])) throw new HttpError(400, `Campo "${k}" deve ser um mês (AAAA-MM).`)
  return b[k]
}
const optMonth = (b: Body, k: string): string | null => (b[k] == null ? null : month(b, k))
const optDate = (b: Body, k: string): string | null => {
  const v = b[k]
  if (v == null || v === '') return null
  if (typeof v !== 'string' || !DATE.test(v)) throw new HttpError(400, `Campo "${k}" deve ser uma data.`)
  return v
}
const bool = (b: Body, k: string): boolean => b[k] === true

const readBody = async (c: Ctx): Promise<Body> => {
  const data = await c.req.json().catch(() => null)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new HttpError(400, 'Requisição inválida.')
  return data as Body
}

const now = () => new Date().toISOString()
const today = () => now().slice(0, 10)

// ---------- app ----------

const app = new Hono<HonoEnv>().basePath('/api')

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, code: err.code }, err.status)
  console.error(err)
  return c.json({ error: 'Erro inesperado. Tente de novo.' }, 500)
})

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  // CSRF: além do cookie SameSite=Strict, toda escrita precisa vir da própria origem.
  // (o webhook do Mercado Pago vem de fora e é conferido pela assinatura dele)
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !c.req.path.endsWith('/billing/webhook')) {
    const origin = c.req.header('Origin')
    if (!origin || new URL(origin).host !== new URL(c.req.url).host)
      throw new HttpError(403, 'Origem não permitida.')
  }
  await next()
})

// ---------- autenticação ----------

const startSession = async (c: Ctx, userId: string) => {
  const token = randomHex(32)
  const expires = Date.now() + SESSION_DAYS * 86_400_000
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(
      await sha256(token),
      userId,
      expires,
    ),
  ])
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

const sessionUser = async (c: Ctx): Promise<string | null> => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const row = await c.env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(await sha256(token), Date.now())
    .first<{ user_id: string }>()
  return row?.user_id ?? null
}

const WINDOW_MS = 15 * 60_000
const MAX_ATTEMPTS = 8

/** Freia tentativas repetidas de login/cadastro vindas do mesmo IP. */
const throttle = async (c: Ctx): Promise<{ fail: () => Promise<void> }> => {
  const key = c.req.header('CF-Connecting-IP') ?? 'local'
  const since = Date.now() - WINDOW_MS
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND at > ?')
    .bind(key, since)
    .first<{ n: number }>()
  if ((row?.n ?? 0) >= MAX_ATTEMPTS)
    throw new HttpError(429, 'Muitas tentativas. Espere alguns minutos e tente de novo.')
  return {
    fail: async () => {
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM auth_attempts WHERE at <= ?').bind(since),
        c.env.DB.prepare('INSERT INTO auth_attempts (key, at) VALUES (?, ?)').bind(key, Date.now()),
      ])
    },
  }
}

const password = (b: Body, k: string): string => {
  const v = b[k]
  if (typeof v !== 'string' || v.length < 8 || v.length > 200)
    throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.')
  return v
}

app.get('/auth/status', async (c) => c.json({ authenticated: !!(await sessionUser(c)) }))

/** O que a página de apresentação precisa saber sem login. */
app.get('/public/plan', (c) => {
  const b = billingFor({ plan: 'trial', trial_ends_at: null, paid_until: null }, c.env)
  return c.json({ price_cents: b.price_cents, trial_days: b.trial_days, billing_enabled: b.enabled, email_enabled: emailEnabled(c.env) })
})

app.post('/auth/signup', async (c) => {
  const b = await readBody(c)
  const guard = await throttle(c)
  if (b.accept_terms !== true) throw new HttpError(400, 'Para criar a conta é preciso aceitar os termos de uso e a política de privacidade.')
  const email = text(b, 'email', { max: 200, min: 3 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.')
  const name = text(b, 'name', { max: 60 })
  const pass = password(b, 'password')
  // toda tentativa de cadastro conta no freio por IP: evita criação de contas em massa
  await guard.fail()
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first())
    throw new HttpError(409, 'Já existe uma conta com este e-mail. Entre ou recupere a senha.')
  const salt = randomHex(16)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, password_salt, created_at, plan, trial_ends_at, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?, 'trial', ?, ?)",
  )
    .bind(id, email, name, await hashPassword(pass, salt), salt, now(), trialEnd(c.env), now())
    .run()
  await startSession(c, id)
  return c.json({ ok: true })
})

// ---------- recuperação de senha ----------

app.post('/auth/forgot', async (c) => {
  const b = await readBody(c)
  const guard = await throttle(c)
  await guard.fail()
  if (!emailEnabled(c.env))
    throw new HttpError(503, 'A recuperação de senha por e-mail ainda não está disponível. Fale com o suporte.')
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  const user = await c.env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first<{ id: string; name: string }>()
  if (user) {
    const token = randomHex(32)
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').bind(user.id, Date.now()),
      c.env.DB.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(
        await sha256(token),
        user.id,
        Date.now() + 60 * 60_000,
      ),
    ])
    const link = `${new URL(c.req.url).origin}/nova-senha?token=${token}`
    const first = user.name.split(' ')[0].replace(/[<>&"]/g, '')
    await sendEmail(
      c.env,
      email,
      'Poupin: criar uma nova senha',
      `<p>Oi, ${first}.</p><p>Recebemos um pedido para criar uma nova senha no Poupin. O link vale por 1 hora:</p><p><a href="${link}">${link}</a></p><p>Se não foi você, é só ignorar este e-mail: sua senha continua a mesma.</p>`,
    )
  }
  // mesma resposta existindo ou não a conta: não revela quem tem cadastro
  return c.json({ ok: true })
})

app.post('/auth/reset', async (c) => {
  const b = await readBody(c)
  const guard = await throttle(c)
  const token = typeof b.token === 'string' ? b.token : ''
  const row = await c.env.DB.prepare('SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), Date.now())
    .first<{ user_id: string }>()
  if (!row) {
    await guard.fail()
    throw new HttpError(400, 'Este link expirou ou já foi usado. Peça um novo.')
  }
  const salt = randomHex(16)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(
      await hashPassword(password(b, 'password'), salt),
      salt,
      row.user_id,
    ),
    c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(row.user_id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),
  ])
  await startSession(c, row.user_id)
  return c.json({ ok: true })
})

// ---------- aviso de pagamento (Mercado Pago) ----------

app.post('/billing/webhook', async (c) => {
  if (!c.env.MP_ACCESS_TOKEN) return c.json({ ok: true })
  const body = (await c.req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } }
  const url = new URL(c.req.url)
  const type = body.type ?? url.searchParams.get('type') ?? ''
  const dataId = String(body.data?.id ?? url.searchParams.get('data.id') ?? '')
  if (!dataId) return c.json({ ok: true })
  if (
    c.env.MP_WEBHOOK_SECRET &&
    !(await validWebhook(c.env.MP_WEBHOOK_SECRET, c.req.header('x-signature'), c.req.header('x-request-id'), dataId))
  )
    throw new HttpError(401, 'Assinatura inválida.')
  try {
    await handleWebhook(c.env, type, dataId)
  } catch {
    // erro ao consultar o Mercado Pago: responde 503 para ele tentar de novo mais tarde
    throw new HttpError(503, 'Não foi possível processar o aviso agora.')
  }
  return c.json({ ok: true })
})

app.post('/auth/login', async (c) => {
  const b = await readBody(c)
  const guard = await throttle(c)
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  const pass = typeof b.password === 'string' ? b.password : ''
  const user = await c.env.DB.prepare('SELECT id, password_hash, password_salt FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; password_hash: string; password_salt: string }>()
  // calcula o hash mesmo sem usuário, pra resposta levar o mesmo tempo
  const hash = await hashPassword(pass, user?.password_salt ?? '00000000000000000000000000000000')
  if (!user || !safeEqual(hash, user.password_hash)) {
    await guard.fail()
    throw new HttpError(401, 'E-mail ou senha incorretos.')
  }
  await startSession(c, user.id)
  return c.json({ ok: true })
})

app.post('/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token)
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

// Tudo daqui pra baixo exige sessão.
app.use('*', async (c, next) => {
  const userId = await sessionUser(c)
  if (!userId) throw new HttpError(401, 'Sessão expirada. Faça login de novo.')
  c.set('userId', userId)
  // Teste encerrado e sem assinatura: dá pra ver e exportar, não pra alterar.
  // Assinar, sair, trocar senha e excluir a conta continuam liberados.
  const free = /\/(auth|billing|account)\//.test(c.req.path)
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !free) {
    const u = await planRow(c.env.DB, userId)
    if (u && billingFor(u, c.env).access === 'readonly')
      throw new HttpError(402, 'Seu teste grátis terminou. Assine para continuar lançando e editando.', 'subscription_required')
  }
  await next()
})

const planRow = (db: D1Database, uid: string) =>
  db.prepare('SELECT plan, trial_ends_at, paid_until FROM users WHERE id = ?').bind(uid).first<PlanRow>()

// ---------- assinatura ----------

const billingUser = (c: Ctx) =>
  c.env.DB.prepare('SELECT id, email, mp_preapproval_id FROM users WHERE id = ?')
    .bind(c.get('userId'))
    .first<{ id: string; email: string; mp_preapproval_id: string | null }>()

const requireBilling = (c: Ctx) => {
  if (!c.env.MP_ACCESS_TOKEN) throw new HttpError(503, 'A assinatura ainda não está disponível. Tente de novo mais tarde.')
}

app.post('/billing/checkout', async (c) => {
  requireBilling(c)
  const user = await billingUser(c)
  if (!user) throw new HttpError(404, 'Conta não encontrada.')
  try {
    return c.json({ url: await createCheckout(c.env, user, new URL(c.req.url).origin) })
  } catch {
    throw new HttpError(503, 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.')
  }
})

// Ao voltar do Mercado Pago: confere a assinatura sem esperar o aviso automático.
app.post('/billing/sync', async (c) => {
  const user = await billingUser(c)
  if (c.env.MP_ACCESS_TOKEN && user?.mp_preapproval_id) await syncPreapproval(c.env, user.mp_preapproval_id).catch(() => {})
  return c.json({ ok: true })
})

app.post('/billing/cancel', async (c) => {
  requireBilling(c)
  const user = await billingUser(c)
  if (!user?.mp_preapproval_id) throw new HttpError(404, 'Você não tem uma assinatura ativa.')
  try {
    await cancelPreapproval(c.env, user.mp_preapproval_id)
  } catch {
    throw new HttpError(503, 'Não foi possível cancelar agora. Tente de novo em instantes.')
  }
  await c.env.DB.prepare("UPDATE users SET plan = 'cancelled' WHERE id = ? AND plan = 'active'").bind(user.id).run()
  return c.json({ ok: true })
})

// ---------- excluir a conta (LGPD) ----------

app.post('/account/delete', async (c) => {
  const b = await readBody(c)
  const db = c.env.DB
  const uid = c.get('userId')
  const user = await db
    .prepare('SELECT password_hash, password_salt, mp_preapproval_id, plan FROM users WHERE id = ?')
    .bind(uid)
    .first<{ password_hash: string; password_salt: string; mp_preapproval_id: string | null; plan: string }>()
  const pass = typeof b.password === 'string' ? b.password : ''
  if (!user || !safeEqual(await hashPassword(pass, user.password_salt), user.password_hash))
    throw new HttpError(403, 'Senha incorreta.')
  // não deixa uma cobrança correndo para uma conta que não existe mais
  if (c.env.MP_ACCESS_TOKEN && user.mp_preapproval_id && user.plan === 'active') {
    try {
      await cancelPreapproval(c.env, user.mp_preapproval_id)
    } catch {
      throw new HttpError(503, 'Não foi possível cancelar sua assinatura no Mercado Pago. Tente de novo em instantes.')
    }
  }
  await db.batch([
    db.prepare('DELETE FROM goal_moves WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM entry_months WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)').bind(uid),
    db.prepare('DELETE FROM entries WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM goals WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM invoices WHERE card_id IN (SELECT id FROM cards WHERE user_id = ?)').bind(uid),
    db.prepare('DELETE FROM purchases WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM cards WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ])
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

app.post('/auth/password', async (c) => {
  const b = await readBody(c)
  const db = c.env.DB
  const uid = c.get('userId')
  const user = await db
    .prepare('SELECT password_hash, password_salt FROM users WHERE id = ?')
    .bind(uid)
    .first<{ password_hash: string; password_salt: string }>()
  const current = typeof b.current === 'string' ? b.current : ''
  if (!user || !safeEqual(await hashPassword(current, user.password_salt), user.password_hash))
    throw new HttpError(403, 'Senha atual incorreta.')
  const salt = randomHex(16)
  await db.batch([
    db
      .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
      .bind(await hashPassword(password(b, 'next'), salt), salt, uid),
    // trocar a senha derruba as outras sessões
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
  ])
  await startSession(c, uid)
  return c.json({ ok: true })
})

// ---------- estado completo ----------

const loadState = async (env: Env, uid: string): Promise<AppState> => {
  const db = env.DB
  const [user, entries, entryMonths, cards, purchases, invoices, goals, goalMoves] = await db.batch([
    db.prepare('SELECT id, email, name, daily_budget_cents, plan, trial_ends_at, paid_until FROM users WHERE id = ?').bind(uid),
    db
      .prepare(
        'SELECT id, kind, name, category, amount_cents, due_day, start_month, end_month, estimated, goal_id, notes FROM entries WHERE user_id = ? ORDER BY created_at',
      )
      .bind(uid),
    db
      .prepare(
        'SELECT m.entry_id, m.month, m.amount_cents, m.paid_at, m.skipped FROM entry_months m JOIN entries e ON e.id = m.entry_id WHERE e.user_id = ?',
      )
      .bind(uid),
    db
      .prepare(
        'SELECT id, name, color, last4, limit_cents, closing_day, due_day FROM cards WHERE user_id = ? ORDER BY created_at',
      )
      .bind(uid),
    db
      .prepare(
        'SELECT id, card_id, description, category, amount_cents, installments, recurring, first_month, end_month, purchased_at FROM purchases WHERE user_id = ? ORDER BY created_at DESC',
      )
      .bind(uid),
    db
      .prepare(
        'SELECT i.card_id, i.month, i.amount_cents, i.paid_at FROM invoices i JOIN cards c ON c.id = i.card_id WHERE c.user_id = ?',
      )
      .bind(uid),
    db
      .prepare('SELECT id, name, icon, target_cents, deadline FROM goals WHERE user_id = ? ORDER BY created_at')
      .bind(uid),
    db
      .prepare(
        'SELECT id, goal_id, amount_cents, date, note, entry_id, month FROM goal_moves WHERE user_id = ? ORDER BY date DESC, rowid DESC',
      )
      .bind(uid),
  ])
  type Row = Record<string, unknown>
  const flag = (rows: Row[], ...keys: string[]) =>
    rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, !!r[k]])) }))
  const { plan, trial_ends_at, paid_until, ...profile } = user.results[0] as Omit<User, 'billing'> & PlanRow
  return {
    user: { ...profile, billing: billingFor({ plan, trial_ends_at, paid_until }, env) },
    entries: flag(entries.results as Row[], 'estimated'),
    entryMonths: flag(entryMonths.results as Row[], 'skipped'),
    cards: cards.results,
    purchases: flag(purchases.results as Row[], 'recurring'),
    invoices: invoices.results,
    goals: goals.results,
    goalMoves: goalMoves.results,
  } as unknown as AppState
}

app.get('/state', async (c) => c.json(await loadState(c.env, c.get('userId'))))

app.get('/export', async (c) => {
  const state = await loadState(c.env, c.get('userId'))
  c.header('Content-Disposition', `attachment; filename="poupin-${today()}.json"`)
  return c.json({ exported_at: now(), ...state })
})

app.put('/me', async (c) => {
  const b = await readBody(c)
  await c.env.DB.prepare('UPDATE users SET name = ?, daily_budget_cents = ? WHERE id = ?')
    .bind(text(b, 'name', { max: 60 }), cents(b, 'daily_budget_cents'), c.get('userId'))
    .run()
  return c.json({ ok: true })
})

/** Garante que o registro existe e é do usuário logado. */
const owned = async (c: Ctx, table: 'entries' | 'cards' | 'purchases' | 'goals' | 'goal_moves', id: string) => {
  const row = await c.env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND user_id = ?`)
    .bind(id, c.get('userId'))
    .first()
  if (!row) throw new HttpError(404, 'Registro não encontrado.')
}

const monthParam = (c: Ctx): string => {
  const m = c.req.param('month')
  if (!isMonth(m)) throw new HttpError(400, 'Mês inválido.')
  return m
}

// ---------- rendas e contas ----------

const entryFields = async (c: Ctx, b: Body) => {
  const kind = b.kind === 'income' ? 'income' : b.kind === 'expense' ? 'expense' : null
  if (!kind) throw new HttpError(400, 'Tipo inválido.')
  const start = month(b, 'start_month')
  const end = optMonth(b, 'end_month')
  if (end && end < start) throw new HttpError(400, 'O fim não pode ser antes do início.')
  const goalId = typeof b.goal_id === 'string' && b.goal_id ? b.goal_id : null
  if (goalId) await owned(c, 'goals', goalId)
  return [
    kind,
    text(b, 'name'),
    text(b, 'category', { max: 40 }),
    cents(b, 'amount_cents'),
    int(b, 'due_day', 1, 31),
    start,
    end,
    bool(b, 'estimated') ? 1 : 0,
    goalId,
    optText(b, 'notes'),
  ] as const
}

app.post('/entries', async (c) => {
  const f = await entryFields(c, await readBody(c))
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO entries (kind, name, category, amount_cents, due_day, start_month, end_month, estimated, goal_id, notes, id, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(...f, id, c.get('userId'), now())
    .run()
  return c.json({ id })
})

app.put('/entries/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'entries', id)
  const f = await entryFields(c, await readBody(c))
  await c.env.DB.prepare(
    'UPDATE entries SET kind = ?, name = ?, category = ?, amount_cents = ?, due_day = ?, start_month = ?, end_month = ?, estimated = ?, goal_id = ?, notes = ? WHERE id = ?',
  )
    .bind(...f, id)
    .run()
  return c.json({ ok: true })
})

app.delete('/entries/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'entries', id)
  const db = c.env.DB
  await db.batch([
    db.prepare('DELETE FROM goal_moves WHERE entry_id = ?').bind(id),
    db.prepare('DELETE FROM entry_months WHERE entry_id = ?').bind(id),
    db.prepare('DELETE FROM entries WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})

// Estado da conta em um mês: pago, valor ajustado só naquele mês, pulado.
app.put('/entries/:id/months/:month', async (c) => {
  const id = c.req.param('id')
  const m = monthParam(c)
  await owned(c, 'entries', id)
  const b = await readBody(c)
  const db = c.env.DB
  const uid = c.get('userId')

  const entry = await db
    .prepare('SELECT name, amount_cents, goal_id FROM entries WHERE id = ?')
    .bind(id)
    .first<{ name: string; amount_cents: number; goal_id: string | null }>()
  const cur = await db
    .prepare('SELECT amount_cents, paid_at, skipped FROM entry_months WHERE entry_id = ? AND month = ?')
    .bind(id, m)
    .first<{ amount_cents: number | null; paid_at: string | null; skipped: number }>()

  const amount = 'amount_cents' in b ? (b.amount_cents === null ? null : cents(b, 'amount_cents')) : (cur?.amount_cents ?? null)
  const paidAt = 'paid' in b ? (bool(b, 'paid') ? (cur?.paid_at ?? today()) : null) : (cur?.paid_at ?? null)
  const skipped = 'skipped' in b ? bool(b, 'skipped') : !!cur?.skipped

  const stmts = [
    db
      .prepare(
        'INSERT INTO entry_months (entry_id, month, amount_cents, paid_at, skipped) VALUES (?, ?, ?, ?, ?) ON CONFLICT (entry_id, month) DO UPDATE SET amount_cents = excluded.amount_cents, paid_at = excluded.paid_at, skipped = excluded.skipped',
      )
      .bind(id, m, amount, paidAt, skipped ? 1 : 0),
    // Conta ligada a uma meta: pagar vira depósito na reserva; desmarcar desfaz.
    db.prepare('DELETE FROM goal_moves WHERE entry_id = ? AND month = ?').bind(id, m),
  ]
  if (entry?.goal_id && paidAt && !skipped) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO goal_moves (id, user_id, goal_id, amount_cents, date, note, entry_id, month) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(crypto.randomUUID(), uid, entry.goal_id, amount ?? entry.amount_cents, paidAt, entry.name, id, m),
    )
  }
  await db.batch(stmts)
  return c.json({ ok: true })
})

// ---------- cartões ----------

const CARD_COLORS = ['graphite', 'blue', 'orange', 'purple', 'green', 'red', 'pink', 'gold']

const cardFields = (b: Body) => {
  const color = typeof b.color === 'string' && CARD_COLORS.includes(b.color) ? b.color : 'graphite'
  const last4 = optText(b, 'last4', 4)
  if (last4 && !/^\d{4}$/.test(last4)) throw new HttpError(400, 'Os 4 últimos dígitos devem ser números.')
  return [
    text(b, 'name', { max: 40 }),
    color,
    last4,
    cents(b, 'limit_cents'),
    int(b, 'closing_day', 1, 31),
    int(b, 'due_day', 1, 31),
  ] as const
}

app.post('/cards', async (c) => {
  const f = cardFields(await readBody(c))
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO cards (name, color, last4, limit_cents, closing_day, due_day, id, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(...f, id, c.get('userId'), now())
    .run()
  return c.json({ id })
})

app.put('/cards/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'cards', id)
  const f = cardFields(await readBody(c))
  await c.env.DB.prepare(
    'UPDATE cards SET name = ?, color = ?, last4 = ?, limit_cents = ?, closing_day = ?, due_day = ? WHERE id = ?',
  )
    .bind(...f, id)
    .run()
  return c.json({ ok: true })
})

app.delete('/cards/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'cards', id)
  const db = c.env.DB
  await db.batch([
    db.prepare('DELETE FROM invoices WHERE card_id = ?').bind(id),
    db.prepare('DELETE FROM purchases WHERE card_id = ?').bind(id),
    db.prepare('DELETE FROM cards WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})

// Fatura do mês: marcar paga e/ou informar o valor fechado manualmente.
app.put('/cards/:id/invoices/:month', async (c) => {
  const id = c.req.param('id')
  const m = monthParam(c)
  await owned(c, 'cards', id)
  const b = await readBody(c)
  const db = c.env.DB
  const cur = await db
    .prepare('SELECT amount_cents, paid_at FROM invoices WHERE card_id = ? AND month = ?')
    .bind(id, m)
    .first<{ amount_cents: number | null; paid_at: string | null }>()
  const amount = 'amount_cents' in b ? (b.amount_cents === null ? null : cents(b, 'amount_cents')) : (cur?.amount_cents ?? null)
  const paidAt = 'paid' in b ? (bool(b, 'paid') ? (cur?.paid_at ?? today()) : null) : (cur?.paid_at ?? null)
  await db
    .prepare(
      'INSERT INTO invoices (card_id, month, amount_cents, paid_at) VALUES (?, ?, ?, ?) ON CONFLICT (card_id, month) DO UPDATE SET amount_cents = excluded.amount_cents, paid_at = excluded.paid_at',
    )
    .bind(id, m, amount, paidAt)
    .run()
  return c.json({ ok: true })
})

const purchaseFields = async (c: Ctx, b: Body) => {
  const cardId = text(b, 'card_id', { max: 40 })
  await owned(c, 'cards', cardId)
  const recurring = bool(b, 'recurring')
  const first = month(b, 'first_month')
  const end = recurring ? optMonth(b, 'end_month') : null
  if (end && end < first) throw new HttpError(400, 'O fim não pode ser antes do início.')
  return [
    cardId,
    text(b, 'description'),
    text(b, 'category', { max: 40 }),
    cents(b, 'amount_cents', 1),
    recurring ? 1 : int(b, 'installments', 1, 120),
    recurring ? 1 : 0,
    first,
    end,
    optDate(b, 'purchased_at'),
  ] as const
}

app.post('/purchases', async (c) => {
  const f = await purchaseFields(c, await readBody(c))
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO purchases (card_id, description, category, amount_cents, installments, recurring, first_month, end_month, purchased_at, id, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(...f, id, c.get('userId'), now())
    .run()
  return c.json({ id })
})

app.put('/purchases/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'purchases', id)
  const f = await purchaseFields(c, await readBody(c))
  await c.env.DB.prepare(
    'UPDATE purchases SET card_id = ?, description = ?, category = ?, amount_cents = ?, installments = ?, recurring = ?, first_month = ?, end_month = ?, purchased_at = ? WHERE id = ?',
  )
    .bind(...f, id)
    .run()
  return c.json({ ok: true })
})

app.delete('/purchases/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'purchases', id)
  await c.env.DB.prepare('DELETE FROM purchases WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// ---------- reserva e metas ----------

const goalFields = (b: Body) =>
  [text(b, 'name', { max: 60 }), text(b, 'icon', { max: 30 }), cents(b, 'target_cents'), optMonth(b, 'deadline')] as const

app.post('/goals', async (c) => {
  const f = goalFields(await readBody(c))
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO goals (name, icon, target_cents, deadline, id, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(...f, id, c.get('userId'), now())
    .run()
  return c.json({ id })
})

app.put('/goals/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'goals', id)
  const f = goalFields(await readBody(c))
  await c.env.DB.prepare('UPDATE goals SET name = ?, icon = ?, target_cents = ?, deadline = ? WHERE id = ?')
    .bind(...f, id)
    .run()
  return c.json({ ok: true })
})

app.delete('/goals/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'goals', id)
  const db = c.env.DB
  await db.batch([
    db.prepare('UPDATE entries SET goal_id = NULL WHERE goal_id = ?').bind(id),
    db.prepare('DELETE FROM goal_moves WHERE goal_id = ?').bind(id),
    db.prepare('DELETE FROM goals WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})

app.post('/goals/:id/moves', async (c) => {
  const goalId = c.req.param('id')
  await owned(c, 'goals', goalId)
  const b = await readBody(c)
  const amount = int(b, 'amount_cents', -MAX_CENTS, MAX_CENTS)
  if (amount === 0) throw new HttpError(400, 'Informe um valor.')
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO goal_moves (id, user_id, goal_id, amount_cents, date, note) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, c.get('userId'), goalId, amount, optDate(b, 'date') ?? today(), optText(b, 'note', 120))
    .run()
  return c.json({ id })
})

app.delete('/goal-moves/:id', async (c) => {
  const id = c.req.param('id')
  await owned(c, 'goal_moves', id)
  await c.env.DB.prepare('DELETE FROM goal_moves WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

app.all('*', () => {
  throw new HttpError(404, 'Rota não encontrada.')
})

export default app
