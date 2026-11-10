import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addMonths,
  cardCommitted,
  clampDay,
  invoiceFor,
  invoiceMonthFor,
  monthDiff,
  occurrences,
  payables,
  purchaseShare,
  summarize,
} from './finance.ts'
import type { AppState, Card, Entry, Purchase } from './types.ts'

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e1',
  kind: 'expense',
  name: 'Conta',
  category: 'outros',
  amount_cents: 10000,
  due_day: 10,
  start_month: '2026-01',
  end_month: null,
  estimated: false,
  goal_id: null,
  notes: '',
  ...over,
})

const card: Card = {
  id: 'c1',
  name: 'Cartão',
  color: 'graphite',
  last4: '',
  limit_cents: 1000000,
  closing_day: 28,
  due_day: 5,
}

const purchase = (over: Partial<Purchase>): Purchase => ({
  id: 'p1',
  card_id: 'c1',
  description: 'Compra',
  category: 'outros',
  amount_cents: 100000,
  installments: 1,
  recurring: false,
  first_month: '2026-12',
  end_month: null,
  purchased_at: null,
  ...over,
})

const state = (over: Partial<AppState>): AppState => ({
  user: { id: 'u', email: 'a@b.c', name: 'A', daily_budget_cents: 0 },
  entries: [],
  entryMonths: [],
  cards: [],
  purchases: [],
  invoices: [],
  goals: [],
  goalMoves: [],
  ...over,
})

test('meses: soma, diferença e virada de ano', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', -1), '2025-12')
  assert.equal(addMonths('2026-03', 22), '2028-01')
  assert.equal(monthDiff('2026-11', '2027-02'), 3)
  assert.equal(clampDay('2027-02', 31), 28)
  assert.equal(clampDay('2028-02', 31), 29)
})

test('conta mensal aparece do início em diante e respeita o fim', () => {
  const s = state({ entries: [entry({ start_month: '2026-03', end_month: '2026-05' })] })
  assert.equal(occurrences(s, '2026-02').length, 0)
  assert.equal(occurrences(s, '2026-03').length, 1)
  assert.equal(occurrences(s, '2026-05').length, 1)
  assert.equal(occurrences(s, '2026-06').length, 0)
  assert.deepEqual(occurrences(s, '2026-04')[0].installment, { n: 2, total: 3 })
})

test('conta avulsa não mostra parcela', () => {
  const s = state({ entries: [entry({ start_month: '2026-03', end_month: '2026-03' })] })
  assert.equal(occurrences(s, '2026-03')[0].installment, null)
})

test('ajuste de valor e pagamento valem só para o mês', () => {
  const s = state({
    entries: [entry({})],
    entryMonths: [
      { entry_id: 'e1', month: '2026-04', amount_cents: 12345, paid_at: '2026-04-09', skipped: false },
    ],
  })
  const abr = occurrences(s, '2026-04')[0]
  assert.equal(abr.amount, 12345)
  assert.equal(abr.paid, true)
  assert.equal(abr.adjusted, true)
  const mai = occurrences(s, '2026-05')[0]
  assert.equal(mai.amount, 10000)
  assert.equal(mai.paid, false)
})

test('parcelas somam exatamente o total da compra', () => {
  const p = purchase({ amount_cents: 100000, installments: 3, first_month: '2026-12' })
  const shares = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'].map((m) => purchaseShare(p, m))
  assert.deepEqual(shares, [0, 33334, 33333, 33333, 0])
  assert.equal(
    shares.reduce((a, b) => a + b, 0),
    100000,
  )
})

test('assinatura no cartão repete todo mês até o fim', () => {
  const p = purchase({ recurring: true, amount_cents: 5590, first_month: '2026-12', end_month: '2027-02' })
  assert.equal(purchaseShare(p, '2026-11'), 0)
  assert.equal(purchaseShare(p, '2027-02'), 5590)
  assert.equal(purchaseShare(p, '2027-03'), 0)
})

test('mês da fatura considera fechamento e vencimento', () => {
  // fecha dia 28, vence dia 5 do mês seguinte
  assert.equal(invoiceMonthFor({ closing_day: 28, due_day: 5 }, '2026-11-10'), '2026-12')
  assert.equal(invoiceMonthFor({ closing_day: 28, due_day: 5 }, '2026-11-29'), '2027-01')
  // fecha dia 3, vence dia 12 do mesmo mês
  assert.equal(invoiceMonthFor({ closing_day: 3, due_day: 12 }, '2026-11-02'), '2026-11')
  assert.equal(invoiceMonthFor({ closing_day: 3, due_day: 12 }, '2026-11-04'), '2026-12')
})

test('fatura: valor manual sobrepõe a soma das compras', () => {
  const s = state({
    cards: [card],
    purchases: [purchase({ amount_cents: 30000 }), purchase({ id: 'p2', amount_cents: 20000 })],
    invoices: [{ card_id: 'c1', month: '2026-12', amount_cents: 79990, paid_at: null }],
  })
  const inv = invoiceFor(s, card, '2026-12')
  assert.equal(inv.computed, 50000)
  assert.equal(inv.amount, 79990)
  assert.equal(inv.manual, true)
  assert.equal(invoiceFor(s, card, '2027-01').amount, 0)
})

test('limite comprometido soma a fatura aberta e as parcelas futuras', () => {
  const s = state({
    cards: [card],
    purchases: [
      purchase({ amount_cents: 90000, installments: 3, first_month: '2026-12' }),
      purchase({ id: 'p2', recurring: true, amount_cents: 5000, first_month: '2026-01' }),
    ],
  })
  // dez: 30000 + 5000 de assinatura; jan e fev: 30000 cada
  assert.equal(cardCommitted(s, card, '2026-12'), 95000)
  const pago = state({ ...s, invoices: [{ card_id: 'c1', month: '2026-12', amount_cents: null, paid_at: 'x' }] })
  assert.equal(cardCommitted(pago, card, '2026-12'), 60000)
})

test('resumo do mês: renda menos contas, cartões e dia a dia', () => {
  const s = state({
    user: { id: 'u', email: 'a@b.c', name: 'A', daily_budget_cents: 50000 },
    entries: [
      entry({ id: 'i', kind: 'income', amount_cents: 1000000, name: 'Salário' }),
      entry({ id: 'a', category: 'moradia', amount_cents: 240000, name: 'Aluguel' }),
      entry({ id: 'b', category: 'reserva', amount_cents: 100000, name: 'Reserva' }),
      entry({ id: 'c', category: 'saude', amount_cents: 30000, name: 'Plano' }),
      entry({ id: 'd', category: 'lazer', amount_cents: 9900, name: 'Pulado' }),
    ],
    entryMonths: [{ entry_id: 'd', month: '2026-12', amount_cents: null, paid_at: null, skipped: true }],
    cards: [card],
    purchases: [purchase({ amount_cents: 80000 })],
  })
  const r = summarize(s, '2026-12')
  assert.equal(r.income, 1000000)
  assert.equal(r.housing, 240000)
  assert.equal(r.savings, 100000)
  assert.equal(r.bills, 30000)
  assert.equal(r.cards, 80000)
  assert.equal(r.daily, 50000)
  assert.equal(r.leftover, 1000000 - 240000 - 100000 - 30000 - 80000 - 50000)
  assert.equal(r.byCategory[0].category, 'moradia')

  const p = payables(s, '2026-12')
  assert.deepEqual(
    p.map((x) => x.name),
    ['Fatura Cartão', 'Aluguel', 'Reserva', 'Plano'],
  )
})
