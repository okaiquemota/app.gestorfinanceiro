// Tipos compartilhados entre o Worker (API) e o front-end.
// Valores sempre em centavos; meses no formato 'YYYY-MM'.

export type EntryKind = 'income' | 'expense'

export type Entry = {
  id: string
  kind: EntryKind
  name: string
  category: string
  amount_cents: number
  due_day: number
  start_month: string
  /** null = mensal sem fim. Igual a start_month = lançamento avulso. */
  end_month: string | null
  estimated: boolean
  goal_id: string | null
  notes: string
}

export type EntryMonth = {
  entry_id: string
  month: string
  amount_cents: number | null
  paid_at: string | null
  skipped: boolean
}

export type Card = {
  id: string
  name: string
  color: string
  last4: string
  limit_cents: number
  closing_day: number
  due_day: number
}

export type Purchase = {
  id: string
  card_id: string
  description: string
  category: string
  /** Total da compra (parcelada) ou valor mensal (recorrente). */
  amount_cents: number
  installments: number
  recurring: boolean
  /** Mês da primeira fatura em que a compra aparece. */
  first_month: string
  end_month: string | null
  purchased_at: string | null
}

export type Invoice = {
  card_id: string
  month: string
  amount_cents: number | null
  paid_at: string | null
}

export type Goal = {
  id: string
  name: string
  icon: string
  target_cents: number
  deadline: string | null
}

export type GoalMove = {
  id: string
  goal_id: string
  amount_cents: number
  date: string
  note: string
  entry_id: string | null
  month: string | null
}

export type Billing = {
  /** Situação do plano. */
  /** 'active' = cartão com renovação automática; 'prepaid' = pago mês a mês. */
  status: 'trial' | 'active' | 'prepaid' | 'cancelled' | 'expired' | 'lifetime'
  /** 'readonly': o teste acabou e não há assinatura — dá pra ver e exportar, não pra alterar. */
  access: 'full' | 'readonly'
  /** A cobrança está configurada no servidor? */
  enabled: boolean
  price_cents: number
  annual_price_cents: number
  trial_days: number
  trial_days_left: number
  paid_until: string | null
  /** Dias que faltam do período já pago (0 se não há). */
  paid_days_left: number
}

export type User = {
  id: string
  email: string
  name: string
  daily_budget_cents: number
  billing: Billing
}

export type AppState = {
  user: User
  entries: Entry[]
  entryMonths: EntryMonth[]
  cards: Card[]
  purchases: Purchase[]
  invoices: Invoice[]
  goals: Goal[]
  goalMoves: GoalMove[]
}
