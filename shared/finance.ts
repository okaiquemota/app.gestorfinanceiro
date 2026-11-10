// Regras de negócio puras: o que vence em cada mês, quanto custa, quanto sobra.
// Sem dependência de DOM nem de banco — usado no front e coberto por testes.

import type { AppState, Card, Entry, EntryMonth, Goal, Invoice, Purchase } from './types.ts'

// ---------- meses ----------

export const toMonth = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const toISODate = (d: Date): string =>
  `${toMonth(d)}-${String(d.getDate()).padStart(2, '0')}`

const monthIndex = (m: string): number => {
  const [y, mo] = m.split('-').map(Number)
  return y * 12 + (mo - 1)
}

const fromIndex = (i: number): string =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`

export const addMonths = (m: string, n: number): string => fromIndex(monthIndex(m) + n)

/** Quantos meses de `a` até `b` (positivo se b é depois). */
export const monthDiff = (a: string, b: string): number => monthIndex(b) - monthIndex(a)

export const daysInMonth = (m: string): number => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo, 0).getDate()
}

/** Dia de vencimento ajustado ao mês (dia 31 em fevereiro vira 28/29). */
export const clampDay = (m: string, day: number): number => Math.min(day, daysInMonth(m))

export const dueDate = (m: string, day: number): string =>
  `${m}-${String(clampDay(m, day)).padStart(2, '0')}`

// ---------- rendas e contas ----------

export const entryActive = (e: Entry, month: string): boolean =>
  e.start_month <= month && (e.end_month === null || month <= e.end_month)

export type Occurrence = {
  entry: Entry
  month: string
  day: number
  amount: number
  /** Valor foi ajustado só neste mês. */
  adjusted: boolean
  paid: boolean
  skipped: boolean
  /** Parcela atual / total, quando a conta tem fim e dura mais de um mês. */
  installment: { n: number; total: number } | null
}

const indexMonths = (rows: EntryMonth[]): Map<string, EntryMonth> =>
  new Map(rows.map((r) => [`${r.entry_id}|${r.month}`, r]))

export const occurrences = (
  state: Pick<AppState, 'entries' | 'entryMonths'>,
  month: string,
  kind?: Entry['kind'],
): Occurrence[] => {
  const idx = indexMonths(state.entryMonths)
  return state.entries
    .filter((e) => (!kind || e.kind === kind) && entryActive(e, month))
    .map((entry) => {
      const row = idx.get(`${entry.id}|${month}`)
      const total = entry.end_month ? monthDiff(entry.start_month, entry.end_month) + 1 : 0
      return {
        entry,
        month,
        day: clampDay(month, entry.due_day),
        amount: row?.amount_cents ?? entry.amount_cents,
        adjusted: row?.amount_cents != null && row.amount_cents !== entry.amount_cents,
        paid: !!row?.paid_at,
        skipped: !!row?.skipped,
        installment: total > 1 ? { n: monthDiff(entry.start_month, month) + 1, total } : null,
      }
    })
    .sort((a, b) => a.day - b.day || a.entry.name.localeCompare(b.entry.name))
}

// ---------- cartões ----------

/** Quanto de uma compra cai na fatura de `month` (0 se não cai). */
export const purchaseShare = (p: Purchase, month: string): number => {
  if (month < p.first_month) return 0
  if (p.recurring) return p.end_month === null || month <= p.end_month ? p.amount_cents : 0
  const i = monthDiff(p.first_month, month)
  if (i >= p.installments) return 0
  const base = Math.floor(p.amount_cents / p.installments)
  // os centavos que sobram da divisão vão na primeira parcela
  return i === 0 ? p.amount_cents - base * (p.installments - 1) : base
}

/**
 * Em qual fatura (mês de vencimento) entra uma compra feita em `date` ('YYYY-MM-DD').
 * Compra depois do fechamento vai pra fatura seguinte; se o vencimento é em dia
 * menor ou igual ao fechamento, a fatura vence no mês seguinte ao fechamento.
 */
export const invoiceMonthFor = (card: Pick<Card, 'closing_day' | 'due_day'>, date: string): string => {
  const month = date.slice(0, 7)
  const day = Number(date.slice(8, 10))
  const closingMonth = day > clampDay(month, card.closing_day) ? addMonths(month, 1) : month
  return card.due_day > card.closing_day ? closingMonth : addMonths(closingMonth, 1)
}

export type InvoiceItem = { purchase: Purchase; amount: number; installment: number | null }

export type InvoiceView = {
  card: Card
  month: string
  day: number
  items: InvoiceItem[]
  /** Soma das compras lançadas. */
  computed: number
  /** Valor que vale: o informado manualmente, ou a soma das compras. */
  amount: number
  manual: boolean
  paid: boolean
}

export const invoiceFor = (
  state: Pick<AppState, 'purchases' | 'invoices'>,
  card: Card,
  month: string,
): InvoiceView => {
  const items: InvoiceItem[] = []
  for (const purchase of state.purchases) {
    if (purchase.card_id !== card.id) continue
    const amount = purchaseShare(purchase, month)
    if (amount === 0) continue
    items.push({
      purchase,
      amount,
      installment:
        !purchase.recurring && purchase.installments > 1
          ? monthDiff(purchase.first_month, month) + 1
          : null,
    })
  }
  items.sort((a, b) => b.amount - a.amount)
  const computed = items.reduce((s, i) => s + i.amount, 0)
  const row: Invoice | undefined = state.invoices.find(
    (i) => i.card_id === card.id && i.month === month,
  )
  return {
    card,
    month,
    day: clampDay(month, card.due_day),
    items,
    computed,
    amount: row?.amount_cents ?? computed,
    manual: row?.amount_cents != null,
    paid: !!row?.paid_at,
  }
}

/**
 * Limite já comprometido: fatura em aberto deste mês em diante.
 * Meses futuros contam só as parcelas (assinaturas ainda não foram cobradas).
 */
export const cardCommitted = (
  state: Pick<AppState, 'purchases' | 'invoices'>,
  card: Card,
  month: string,
): number => {
  let total = 0
  const current = invoiceFor(state, card, month)
  if (!current.paid) total += current.amount
  let last = month
  for (const p of state.purchases) {
    if (p.card_id !== card.id || p.recurring) continue
    const end = addMonths(p.first_month, p.installments - 1)
    if (end > last) last = end
  }
  for (let m = addMonths(month, 1); m <= last; m = addMonths(m, 1)) {
    for (const p of state.purchases) {
      if (p.card_id === card.id && !p.recurring) total += purchaseShare(p, m)
    }
  }
  return total
}

// ---------- contas a pagar (contas + faturas) ----------

export type Payable = {
  key: string
  type: 'entry' | 'invoice'
  id: string
  name: string
  category: string
  month: string
  day: number
  amount: number
  paid: boolean
  estimated: boolean
  installment: { n: number; total: number } | null
}

export const payables = (state: AppState, month: string): Payable[] => {
  const list: Payable[] = occurrences(state, month, 'expense')
    .filter((o) => !o.skipped)
    .map((o) => ({
      key: `entry:${o.entry.id}`,
      type: 'entry',
      id: o.entry.id,
      name: o.entry.name,
      category: o.entry.category,
      month,
      day: o.day,
      amount: o.amount,
      paid: o.paid,
      estimated: o.entry.estimated && !o.adjusted,
      installment: o.installment,
    }))
  for (const card of state.cards) {
    const inv = invoiceFor(state, card, month)
    if (inv.amount <= 0) continue
    list.push({
      key: `invoice:${card.id}`,
      type: 'invoice',
      id: card.id,
      name: `Fatura ${card.name}`,
      category: 'cartao',
      month,
      day: inv.day,
      amount: inv.amount,
      paid: inv.paid,
      estimated: !inv.manual,
      installment: null,
    })
  }
  return list.sort((a, b) => a.day - b.day || b.amount - a.amount)
}

// ---------- resumo do mês ----------

export type Summary = {
  month: string
  income: number
  /** Contas de moradia. */
  housing: number
  /** Demais contas (fora moradia e reserva). */
  bills: number
  /** O que vai pra reserva/investimentos. */
  savings: number
  cards: number
  daily: number
  expenses: number
  leftover: number
  byCategory: { category: string; amount: number }[]
}

export const HOUSING = 'moradia'
export const SAVINGS = 'reserva'

export const summarize = (state: AppState, month: string): Summary => {
  const income = occurrences(state, month, 'income')
    .filter((o) => !o.skipped)
    .reduce((s, o) => s + o.amount, 0)

  const cats = new Map<string, number>()
  for (const o of occurrences(state, month, 'expense')) {
    if (o.skipped) continue
    cats.set(o.entry.category, (cats.get(o.entry.category) ?? 0) + o.amount)
  }
  const housing = cats.get(HOUSING) ?? 0
  const savings = cats.get(SAVINGS) ?? 0
  const entryTotal = [...cats.values()].reduce((s, v) => s + v, 0)
  const cards = state.cards.reduce((s, c) => s + invoiceFor(state, c, month).amount, 0)
  const daily = state.user.daily_budget_cents
  const expenses = entryTotal + cards + daily

  if (cards > 0) cats.set('cartao', cards)
  if (daily > 0) cats.set('dia-a-dia', daily)

  return {
    month,
    income,
    housing,
    bills: entryTotal - housing - savings,
    savings,
    cards,
    daily,
    expenses,
    leftover: income - expenses,
    byCategory: [...cats.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  }
}

// ---------- reserva ----------

export const goalBalance = (state: Pick<AppState, 'goalMoves'>, goal: Goal): number =>
  state.goalMoves.reduce((s, m) => (m.goal_id === goal.id ? s + m.amount_cents : s), 0)
