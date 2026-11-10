import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Pencil, TriangleAlert } from 'lucide-react'
import {
  HOUSING,
  addMonths,
  dueDate,
  goalBalance,
  invoiceFor,
  occurrences,
  payables,
  summarize,
} from '../../shared/finance.ts'
import type { Payable, Summary } from '../../shared/finance.ts'
import { CardVisual, Meter, PanelHeader, PayableRow, daysUntil, dueStatus } from '../components.tsx'
import { category } from '../lib/categories.ts'
import { brl, dd, monthLower, monthShort, pct } from '../lib/format.ts'
import { Link } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Amount, Button, Emoji, Money, Panel, Segmented, cx } from '../ui.tsx'

export function Dashboard() {
  const { state, month } = useStore()
  const sum = useMemo(() => summarize(state, month), [state, month])
  const pay = useMemo(() => payables(state, month), [state, month])
  const hasIncome = state.entries.some((e) => e.kind === 'income')
  const hasBills = state.entries.some((e) => e.kind === 'expense')

  return (
    <div className="space-y-4">
      {(!hasIncome || !hasBills) && <Onboarding hasIncome={hasIncome} hasBills={hasBills} />}
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="contents min-w-0 flex-1 xl:flex xl:flex-col xl:gap-4">
          <div className="order-1 xl:order-none">
            <BalanceCard sum={sum} />
          </div>
          <div className="order-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:order-none">
            <BreakdownCard sum={sum} />
            <CardsCard sum={sum} />
          </div>
        </div>
        <div className="contents xl:flex xl:w-[392px] xl:shrink-0 xl:flex-col xl:gap-4">
          <div className="order-2 xl:order-none">
            <PayablesCard list={pay} />
          </div>
          <div className="order-4 xl:order-none">
            <HousingCard sum={sum} />
          </div>
        </div>
      </div>
      <ReserveStrip />
    </div>
  )
}

// ---------- primeiros passos ----------

function Onboarding({ hasIncome, hasBills }: { hasIncome: boolean; hasBills: boolean }) {
  const { state, openForm } = useStore()
  const steps = [
    {
      done: hasIncome,
      emoji: 'banknote',
      title: 'Cadastre sua renda',
      text: 'Salário e o que mais entra todo mês.',
      go: () => openForm({ type: 'entry', kind: 'income', preset: { name: 'Salário' } }),
    },
    {
      done: hasBills,
      emoji: 'receipt',
      title: 'Adicione suas contas',
      text: 'Aluguel, luz, internet, parcelas… uma por uma.',
      go: () => openForm({ type: 'entry', kind: 'expense' }),
    },
    {
      done: state.cards.length > 0,
      emoji: 'card',
      title: 'Cadastre seus cartões',
      text: 'Pra fatura entrar na conta do mês.',
      go: () => openForm({ type: 'card' }),
    },
  ]
  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Emoji name="wave" size={40} />
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Vamos organizar isso, {state.user.name.split(' ')[0]}</h2>
          <p className="text-muted">Três passos e você já enxerga quanto sobra no mês.</p>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={s.go}
              className={cx(
                'flex h-full w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors',
                s.done ? 'border-line bg-sunken' : 'border-line-strong hover:border-primary hover:bg-primary-soft',
              )}
            >
              <Emoji name={s.emoji} size={36} className={s.done ? 'opacity-60' : undefined} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-[13px] text-muted">{s.text}</span>
              </span>
              {s.done ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-good-fill text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : (
                <ChevronRight size={18} className="text-faint" />
              )}
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

// ---------- saldo previsto ----------

function BalanceCard({ sum }: { sum: Summary }) {
  const segs = [
    { label: 'Moradia', value: sum.housing, color: 'var(--s-housing)' },
    { label: 'Outras contas', value: sum.bills, color: 'var(--s-bills)' },
    { label: 'Cartões', value: sum.cards, color: 'var(--s-cards)' },
    { label: 'Reserva', value: sum.savings, color: 'var(--s-savings)' },
    { label: 'Dia a dia', value: sum.daily, color: 'var(--s-daily)' },
  ].filter((s) => s.value > 0)
  const positive = sum.leftover >= 0
  // Sem renda cadastrada, a barra mostra só a composição das saídas.
  const scale = Math.max(sum.income, sum.expenses)

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Saldo previsto</h2>
          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3 sm:mt-7">
            <Money cents={sum.leftover} size="hero" className={positive ? undefined : 'text-bad'} />
            <div className="border-line pb-1 sm:border-l sm:pl-5">
              {sum.income === 0 ? (
                <p className="font-semibold text-muted">Cadastre sua renda pra ver quanto sobra</p>
              ) : positive ? (
                <p className="flex items-center gap-1 font-semibold text-good">
                  <ArrowUpRight size={16} strokeWidth={2.5} />
                  {pct(sum.leftover, sum.income)} da renda livre
                </p>
              ) : (
                <p className="flex items-center gap-1 font-semibold text-bad">
                  <ArrowDownRight size={16} strokeWidth={2.5} />
                  As saídas passam da renda
                </p>
              )}
              <p className="text-[13px] text-muted">valor estimado após pagar todas as contas</p>
            </div>
          </div>
        </div>
        <Emoji name="wallet" size={104} className="hidden drop-shadow-[0_14px_16px_rgb(0_0_0/0.16)] sm:block" />
      </div>

      <div
        role="img"
        aria-label={`Renda de ${brl(sum.income)}: ${segs.map((s) => `${s.label} ${brl(s.value)}`).join(', ')}, sobra ${brl(sum.leftover)}`}
        className="mt-7 flex h-2.5 gap-[2px] overflow-hidden rounded-full"
      >
        {scale === 0 && <span className="flex-1 bg-sunken" />}
        {segs.map((s) => (
          <span key={s.label} title={`${s.label}: ${brl(s.value)}`} style={{ flexGrow: s.value, background: s.color }} className="min-w-[3px] rounded-[2px]" />
        ))}
        {sum.leftover > 0 && (
          <span title={`Sobra: ${brl(sum.leftover)}`} style={{ flexGrow: sum.leftover, background: 'var(--s-left)' }} className="min-w-[3px] rounded-[2px]" />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="text-[13px] text-muted">Renda</dt>
          <dd className="mt-0.5 flex items-center gap-1.5">
            <Amount cents={sum.income} className="text-[15px]" />
            <Link href="/renda" aria-label="Editar renda" className="text-faint hover:text-primary">
              <Pencil size={13} />
            </Link>
          </dd>
        </div>
        {segs.map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1.5 text-[13px] text-muted">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </dt>
            <dd className="mt-0.5 text-[15px]">
              <span className="text-faint">− </span>
              <Amount cents={s.value} />
              <span className="tnum text-xs text-faint"> · {pct(s.value, sum.income)}</span>
            </dd>
          </div>
        ))}
        <div>
          <dt className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className="size-2 rounded-full" style={{ background: positive ? 'var(--s-left)' : 'var(--bad)' }} />= {positive ? 'Sobra' : 'Falta'}
          </dt>
          <dd className={cx('mt-0.5 text-[15px]', positive ? 'text-good' : 'text-bad')}>
            <Amount cents={Math.abs(sum.leftover)} />
            {positive && <span className="tnum text-xs opacity-70"> · {pct(sum.leftover, sum.income)}</span>}
          </dd>
        </div>
      </dl>
    </Panel>
  )
}

// ---------- contas a pagar ----------

function payablesHeadline(list: Payable[]): { text: string; tone: 'bad' | 'warn' | 'muted' | 'good' } {
  const open = list.filter((p) => !p.paid)
  if (list.length > 0 && open.length === 0) return { text: 'tudo pago', tone: 'good' }
  const overdue = open.filter((p) => dueStatus(p) === 'overdue').length
  if (overdue > 0) return { text: overdue === 1 ? '1 atrasada' : `${overdue} atrasadas`, tone: 'bad' }
  const next = open[0]
  if (!next) return { text: 'nada pra pagar', tone: 'muted' }
  const days = daysUntil(dueDate(next.month, next.day))
  if (days === 0) return { text: 'vence hoje', tone: 'warn' }
  return { text: days === 1 ? 'vence amanhã' : `em ${days} dias`, tone: 'muted' }
}

function PayablesCard({ list }: { list: Payable[] }) {
  const { month, openForm } = useStore()
  const days = useMemo(() => {
    const map = new Map<number, Payable[]>()
    for (const p of list) map.set(p.day, [...(map.get(p.day) ?? []), p])
    return [...map.entries()]
  }, [list])

  // Dia em foco: o próximo com conta em aberto (ou o primeiro do mês).
  const defaultDay = (list.find((p) => !p.paid) ?? list[0])?.day ?? null
  const [picked, setPicked] = useState<{ month: string; day: number | 'all' } | null>(null)
  const day = picked?.month === month ? picked.day : defaultDay
  const shown = day === 'all' || day === null ? list : list.filter((p) => p.day === day)

  const open = list.filter((p) => !p.paid)
  const remaining = open.reduce((s, p) => s + p.amount, 0)
  const head = payablesHeadline(list)

  return (
    <Panel className="flex flex-col p-5 sm:p-6">
      <PanelHeader
        title="Contas a pagar"
        emoji="calendar-spiral"
        aside={
          typeof day === 'number' ? <span className="text-xs font-normal text-muted">• dia {dd(day)}</span> : undefined
        }
      >
        <div className="mt-3">
          <Money cents={remaining} />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          <span
            className={cx(
              head.tone === 'bad' && 'font-semibold text-bad',
              head.tone === 'warn' && 'font-semibold text-warn',
              head.tone === 'good' && 'font-semibold text-good',
            )}
          >
            {head.text}
          </span>
          {list.length > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-fg">
                {list.length - open.length} de {list.length} pagas
              </span>
            </>
          )}
        </p>
      </PanelHeader>

      {list.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-sunken px-4 py-6 text-center">
          <p className="text-muted">Nenhuma conta em {monthLower(month)}.</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => openForm({ type: 'entry', kind: 'expense' })}>
            Adicionar conta
          </Button>
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 py-1">
            {days.map(([d, items]) => {
              const active = d === day
              const allPaid = items.every((p) => p.paid)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Dia ${d}: ${items.length} ${items.length === 1 ? 'conta' : 'contas'}`}
                  onClick={() => setPicked({ month, day: active ? 'all' : d })}
                  className={cx(
                    'flex h-12 min-w-[62px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border transition-colors',
                    active
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-line bg-surface hover:border-line-strong',
                    !active && allPaid && 'text-faint',
                  )}
                >
                  <span className="tnum text-[15px] font-semibold leading-none">{dd(d)}</span>
                  <span className="flex gap-0.5">
                    {items.slice(0, 5).map((p) => (
                      <span
                        key={p.key}
                        className={cx(
                          'size-1 rounded-full',
                          active ? 'bg-white' : p.paid ? 'bg-good-fill' : 'bg-line-strong',
                          active && p.paid && 'opacity-50',
                        )}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
          <ul className="mt-2 divide-y divide-line">
            {shown.map((p) => (
              <PayableRow key={p.key} p={p} />
            ))}
          </ul>
          <Link
            href="/contas"
            className="mt-2 flex items-center justify-center gap-1 rounded-xl py-2 text-[13px] font-semibold text-primary hover:bg-primary-soft"
          >
            Ver todas as {list.length} contas <ChevronRight size={14} />
          </Link>
        </>
      )}
    </Panel>
  )
}

// ---------- para onde vai ----------

function BreakdownCard({ sum }: { sum: Summary }) {
  const max = sum.byCategory[0]?.amount ?? 0
  return (
    <Panel className="p-5 sm:p-6">
      <PanelHeader title="Para onde vai" emoji="chart-bar">
        <p className="mt-3 text-[13px] text-muted">Total das saídas</p>
        <div className="mt-1">
          <Money cents={sum.expenses} />
        </div>
      </PanelHeader>
      {sum.byCategory.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-sunken px-4 py-6 text-center text-muted">
          Quando você cadastrar contas, o peso de cada categoria aparece aqui.
        </p>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {sum.byCategory.map(({ category: id, amount }) => {
            const cat = category(id)
            return (
              <li key={id} className="flex items-center gap-3">
                <Emoji name={cat.emoji} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{cat.label}</span>
                    <span className="whitespace-nowrap">
                      <Amount cents={amount} />
                      <span className="tnum ml-1.5 inline-block w-8 text-right text-xs text-faint">
                        {pct(amount, sum.expenses)}
                      </span>
                    </span>
                  </div>
                  <Meter value={amount} max={max} label={`${cat.label}: ${pct(amount, sum.expenses)} das saídas`} className="mt-1.5 !h-1.5" />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------- cartões ----------

function CardsCard({ sum }: { sum: Summary }) {
  const { state, month, openForm } = useStore()
  const invoices = useMemo(() => state.cards.map((c) => invoiceFor(state, c, month)), [state, month])
  const upcoming = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const m = addMonths(month, i)
        return { month: m, total: state.cards.reduce((s, c) => s + invoiceFor(state, c, m).amount, 0) }
      }),
    [state, month],
  )
  const max = Math.max(1, ...upcoming.map((u) => u.total))

  return (
    <Panel className="flex flex-col p-5 sm:p-6">
      <PanelHeader title="Cartões" emoji="card">
        <p className="mt-3 text-[13px] text-muted">
          {state.cards.length > 1 ? 'Faturas' : 'Fatura'} de {monthLower(month)}
        </p>
        <div className="mt-1">
          <Money cents={sum.cards} />
        </div>
      </PanelHeader>

      {state.cards.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-sunken px-4 py-6 text-center">
          <p className="text-muted">Cadastre um cartão pra acompanhar faturas e parcelas.</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => openForm({ type: 'card' })}>
            Adicionar cartão
          </Button>
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 py-1 sm:-mx-6 sm:px-6">
            {invoices.map((inv) => (
              <CardVisual
                key={inv.card.id}
                card={inv.card}
                invoice={inv}
                onClick={() => openForm({ type: 'invoice', cardId: inv.card.id, month })}
              />
            ))}
          </div>

          <h3 className="mt-5 text-[11px] font-semibold tracking-[0.06em] text-faint">PRÓXIMAS FATURAS</h3>
          <ol className="mt-2 grid flex-1 grid-cols-3 gap-2">
            {upcoming.map((u, i) => (
              <li
                key={u.month}
                className={cx(
                  'flex min-h-[132px] flex-col rounded-xl border p-2.5 text-center',
                  i === 0 ? 'border-primary bg-primary-soft' : 'border-transparent bg-sunken',
                )}
              >
                <span className="text-[13px] font-semibold">{monthShort(u.month)}</span>
                <span className="mt-2 flex flex-1 items-end justify-center" aria-hidden>
                  <span
                    className="w-7 rounded-t-[4px]"
                    style={{
                      height: `${Math.max(4, (u.total / max) * 100)}%`,
                      background: i === 0 ? 'var(--primary)' : 'var(--line-strong)',
                    }}
                  />
                </span>
                <span className={cx('tnum mt-2 text-[13px] font-semibold', i === 0 ? 'text-primary' : 'text-muted')}>
                  {brl(u.total)}
                </span>
              </li>
            ))}
          </ol>
          <Link
            href="/cartoes"
            className="mt-3 flex items-center justify-center gap-1 rounded-xl py-2 text-[13px] font-semibold text-primary hover:bg-primary-soft"
          >
            Ver compras e parcelas <ChevronRight size={14} />
          </Link>
        </>
      )}
    </Panel>
  )
}

// ---------- moradia ----------

const HOUSING_REF = 0.3
const HOUSING_SCALE = 0.6

function HousingCard({ sum }: { sum: Summary }) {
  const { state, month, openForm } = useStore()
  const items = useMemo(
    () => occurrences(state, month, 'expense').filter((o) => o.entry.category === HOUSING && !o.skipped),
    [state, month],
  )
  const ratio = sum.income > 0 ? sum.housing / sum.income : 0
  const ok = ratio <= HOUSING_REF

  return (
    <Panel className="p-5 sm:p-6">
      <PanelHeader title="Moradia" emoji="house">
        <p className="mt-3 text-[13px] text-muted">Quanto você gasta pra morar</p>
        <div className="mt-1">
          <Money cents={sum.housing} />
        </div>
      </PanelHeader>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-sunken px-4 py-6 text-center">
          <p className="text-muted">Aluguel, condomínio, luz, internet… marque como “Moradia” e eles entram aqui.</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => openForm({ type: 'entry', kind: 'expense', preset: { category: HOUSING } })}
          >
            Adicionar conta de moradia
          </Button>
        </div>
      ) : (
        <>
          {sum.income > 0 && (
            <>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13px]">
                <span className={cx('flex items-center gap-1 font-semibold', ok ? 'text-good' : 'text-warn')}>
                  {ok ? <Check size={15} strokeWidth={3} /> : <TriangleAlert size={14} />}
                  {pct(sum.housing, sum.income)} da renda
                </span>
                <span className="text-muted">referência: até 30%</span>
              </p>
              <div className="relative mt-6">
                <span
                  className="tnum absolute -top-5 -translate-x-1/2 text-[11px] font-semibold text-muted"
                  style={{ left: `${(HOUSING_REF / HOUSING_SCALE) * 100}%` }}
                >
                  30%
                </span>
                <Meter
                  value={ratio}
                  max={HOUSING_SCALE}
                  color={ok ? 'var(--good-fill)' : 'var(--warn)'}
                  label={`Moradia consome ${pct(sum.housing, sum.income)} da renda; a referência é até 30%`}
                  className="!h-3"
                />
                <span
                  aria-hidden
                  className="absolute -top-1 h-5 w-0.5 rounded-full bg-fg"
                  style={{ left: `${(HOUSING_REF / HOUSING_SCALE) * 100}%` }}
                />
                <div className="tnum mt-1.5 flex justify-between text-[11px] text-faint">
                  <span>0%</span>
                  <span>60% da renda</span>
                </div>
              </div>
            </>
          )}
          <h3 className="mt-5 text-[13px] font-semibold">O que entra na conta</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {items.map((o) => (
              <li key={o.entry.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => openForm({ type: 'occurrence', entryId: o.entry.id, month })}
                  className="block w-full min-w-0 text-left hover:text-primary"
                >
                  <span className="block truncate text-xs text-muted">{o.entry.name}</span>
                  <Amount cents={o.amount} approx={o.entry.estimated && !o.adjusted} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

// ---------- reserva ----------

function ReserveStrip() {
  const { state } = useStore()
  const [mode, setMode] = useState<'all' | 'open'>('all')
  if (state.goals.length === 0) return null
  const goals = state.goals
    .map((g) => ({ goal: g, balance: goalBalance(state, g) }))
    .filter((g) => mode === 'all' || g.goal.target_cents === 0 || g.balance < g.goal.target_cents)
  const total = state.goals.reduce((s, g) => s + goalBalance(state, g), 0)

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PanelHeader title="Reserva">
          <div className="mt-2">
            <Money cents={total} size="lg" />
          </div>
          <p className="mt-1 text-[13px] text-muted">guardado em {state.goals.length === 1 ? '1 meta' : `${state.goals.length} metas`}</p>
        </PanelHeader>
        <div className="flex items-center gap-3">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'open', label: 'Em andamento' },
            ]}
          />
          <Emoji name="money-bag" size={56} className="hidden drop-shadow-[0_8px_10px_rgb(0_0_0/0.12)] sm:block" />
        </div>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {goals.map(({ goal, balance }) => (
          <li key={goal.id}>
            <Link href="/reserva" className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-line-strong">
              <Emoji name={goal.icon} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{goal.name}</span>
                  {goal.target_cents > 0 && (
                    <span className="tnum text-xs font-semibold text-muted">{pct(balance, goal.target_cents)}</span>
                  )}
                </span>
                <span className="tnum block text-[13px] text-muted">
                  {brl(balance)}
                  {goal.target_cents > 0 && ` de ${brl(goal.target_cents)}`}
                </span>
                {goal.target_cents > 0 && (
                  <Meter
                    value={balance}
                    max={goal.target_cents}
                    color="var(--good-fill)"
                    label={`${goal.name}: ${pct(balance, goal.target_cents)} da meta`}
                    className="mt-1.5 !h-1.5"
                  />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
