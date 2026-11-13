import { useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Pencil, TriangleAlert } from 'lucide-react'
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
import { useLayoutMode } from '../lib/scale.ts'
import { Link } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Amount, Badge, Button, Emoji, Money, Panel, Segmented, cx } from '../ui.tsx'

export function Dashboard() {
  const { state, month } = useStore()
  const sum = useMemo(() => summarize(state, month), [state, month])
  const pay = useMemo(() => payables(state, month), [state, month])

  return (
    // Em telas "fit" tudo cabe na janela (margens + barra do mês + respiros = 8.625rem).
    <div className="space-y-4 fit:flex fit:h-[calc(var(--app-vh)-8.625rem)] fit:flex-col fit:gap-4 fit:space-y-0">
      <div className="flex flex-col gap-4 xl:flex-row fit:min-h-0 fit:flex-1">
        <div className="contents min-w-0 flex-1 xl:flex xl:flex-col xl:gap-4">
          <div className="order-1 xl:order-none fit:shrink-0">
            <BalanceCard sum={sum} allPaid={pay.length > 0 && pay.every((p) => p.paid)} />
          </div>
          <div className={cx('order-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:order-none', FILL, 'fit:grid-rows-[minmax(0,1fr)]')}>
            <BreakdownCard sum={sum} />
            <CardsCard />
          </div>
          <div className="hidden shrink-0 fit:block">
            <ReserveStrip compact />
          </div>
        </div>
        <div className="contents xl:flex xl:w-[392px] xl:shrink-0 xl:flex-col xl:gap-4">
          <div className={cx('order-2 xl:order-none', FILL)}>
            <PayablesCard list={pay} />
          </div>
          <div className="order-4 xl:order-none fit:shrink-0">
            <HousingCard sum={sum} />
          </div>
        </div>
      </div>
      <div className="fit:hidden">
        <ReserveStrip />
      </div>
    </div>
  )
}

/** No modo "fit": ocupa a altura que sobrar. */
const FILL = 'fit:min-h-0 fit:flex-1'
/** No modo "fit": cartão do tamanho do espaço, rolando por dentro se precisar. */
const SCROLL = 'scroll-thin fit:h-full fit:overflow-y-auto'

// ---------- saldo previsto ----------

/** O mascote reage ao mês, em vez de repetir o logo do menu. */
const mascotFor = (sum: Summary, allPaid: boolean): { pose: string; alt: string } =>
  sum.income === 0 && sum.expenses === 0
    ? { pose: 'mascote-dormindo', alt: 'Poupin dormindo: ainda não há nada cadastrado neste mês' }
    : sum.leftover < 0
      ? { pose: 'mascote-preocupado', alt: 'Poupin preocupado: as saídas passam da renda' }
      : allPaid
        ? { pose: 'mascote-festa', alt: 'Poupin comemorando: todas as contas do mês estão pagas' }
        : { pose: 'mascote-moeda', alt: 'Poupin abraçando uma moeda: está sobrando dinheiro no mês' }

function BalanceCard({ sum, allPaid }: { sum: Summary; allPaid: boolean }) {
  const mascot = mascotFor(sum, allPaid)
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
          <h2 className="text-lead font-semibold">Saldo previsto</h2>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 sm:mt-5">
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
              <p className="text-caption text-muted">valor estimado após pagar todas as contas</p>
            </div>
          </div>
        </div>
        <Emoji name={mascot.pose} alt={mascot.alt} size={104} className="mascot hidden drop-shadow-[0_14px_16px_rgb(0_0_0/0.16)] sm:block" />
      </div>

      <div
        role="img"
        aria-label={`Renda de ${brl(sum.income)}: ${segs.map((s) => `${s.label} ${brl(s.value)}`).join(', ')}, sobra ${brl(sum.leftover)}`}
        className="bar-x mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full sm:mt-6"
      >
        {scale === 0 && <span className="flex-1 bg-sunken" />}
        {segs.map((s) => (
          <span key={s.label} title={`${s.label}: ${brl(s.value)}`} style={{ flexGrow: s.value, background: s.color }} className="bar-seg min-w-[3px] rounded-[2px]" />
        ))}
        {sum.leftover > 0 && (
          <span title={`Sobra: ${brl(sum.leftover)}`} style={{ flexGrow: sum.leftover, background: 'var(--s-left)' }} className="bar-seg min-w-[3px] rounded-[2px]" />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="text-caption text-muted">Renda</dt>
          <dd className="mt-0.5 flex items-center gap-1.5">
            <Amount cents={sum.income} className="text-lead" />
            <Link
              href="/renda"
              aria-label="Editar renda"
              title="Editar renda"
              className="-m-2 flex size-8 items-center justify-center rounded-lg text-faint hover:bg-sunken hover:text-accent"
            >
              <Pencil size={13} />
            </Link>
          </dd>
        </div>
        {segs.map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1.5 text-caption text-muted">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </dt>
            <dd className="mt-0.5 text-lead">
              <span className="text-faint">− </span>
              <Amount cents={s.value} />
              <span className="tnum text-xs text-faint"> · {pct(s.value, sum.income)}</span>
            </dd>
          </div>
        ))}
        <div>
          <dt className="flex items-center gap-1.5 text-caption font-semibold">
            <span className="size-2 rounded-full" style={{ background: positive ? 'var(--s-left)' : 'var(--bad)' }} />= {positive ? 'Sobra' : 'Falta'}
          </dt>
          <dd className={cx('mt-0.5 text-lead', positive ? 'text-good' : 'text-bad')}>
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
  // "Todas" aqui é um resumo: as próximas a vencer; a lista completa fica na tela de contas.
  const shown =
    day === 'all' || day === null ? [...list.filter((p) => !p.paid), ...list.filter((p) => p.paid)].slice(0, 6) : list.filter((p) => p.day === day)

  const open = list.filter((p) => !p.paid)
  const remaining = open.reduce((s, p) => s + p.amount, 0)
  const head = payablesHeadline(list)

  return (
    <Panel className={cx('flex flex-col p-5 sm:p-6 tight:p-5', SCROLL)}>
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
        <p className="mt-2 text-caption text-muted">
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
            <button
              type="button"
              aria-pressed={day === 'all'}
              onClick={() => setPicked({ month, day: 'all' })}
              className={cx(
                'h-12 shrink-0 rounded-xl border px-3 text-caption font-semibold transition-colors',
                day === 'all' ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-line-strong',
              )}
            >
              Todas
            </button>
            {days.map(([d, items]) => {
              const active = d === day
              const allPaid = items.every((p) => p.paid)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Dia ${d}: ${items.length} ${items.length === 1 ? 'conta' : 'contas'}`}
                  onClick={() => setPicked({ month, day: d })}
                  className={cx(
                    'flex h-12 min-w-[62px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border transition-colors',
                    active
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-line bg-surface hover:border-line-strong',
                    !active && allPaid && 'text-faint',
                  )}
                >
                  <span className="tnum text-lead font-semibold leading-none">{dd(d)}</span>
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
            className="mt-2 flex items-center justify-center gap-1 rounded-xl py-2 text-caption font-semibold text-accent hover:bg-primary-soft"
          >
            Ver todas as {list.length} contas <ChevronRight size={14} />
          </Link>
        </>
      )}
    </Panel>
  )
}

// ---------- para onde vai ----------

const MAX_CATEGORIES = 7
function BreakdownCard({ sum }: { sum: Summary }) {
  const limit = useLayoutMode() === 'tight' ? 4 : MAX_CATEGORIES
  // As maiores aparecem; o resto vira uma linha só — o cartão não cresce sem limite.
  const rows = useMemo(() => {
    if (sum.byCategory.length <= limit) return sum.byCategory
    const top = sum.byCategory.slice(0, limit - 1)
    const rest = sum.byCategory.slice(limit - 1)
    return [...top, { category: 'demais', amount: rest.reduce((t, c) => t + c.amount, 0), count: rest.length }]
  }, [sum.byCategory, limit])
  const max = Math.max(0, ...rows.map((r) => r.amount))
  return (
    <Panel className={cx('p-5 sm:p-6 tight:p-5', SCROLL)}>
      <PanelHeader title="Para onde vai" emoji="chart-bar">
        <p className="mt-3 text-caption text-muted">Total das saídas</p>
        <div className="mt-1">
          <Money cents={sum.expenses} />
        </div>
      </PanelHeader>
      {sum.byCategory.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-sunken px-4 py-6 text-center text-muted">
          Quando você cadastrar contas, o peso de cada categoria aparece aqui.
        </p>
      ) : (
        <ul className="mt-5 space-y-3.5 tight:mt-4 tight:space-y-2.5">
          {rows.map((row) => {
            const { category: id, amount } = row
            const cat = 'count' in row ? { label: `Outras ${row.count} categorias`, emoji: 'box' } : category(id)
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

function CardsCard() {
  const { state, month, openForm } = useStore()
  const invoices = useMemo(() => state.cards.map((c) => invoiceFor(state, c, month)), [state, month])

  // Carrossel: um cartão em foco por vez, com o próximo aparecendo na borda.
  const [pickedId, setPickedId] = useState<string | null>(null)
  const index = Math.max(0, invoices.findIndex((i) => i.card.id === pickedId))
  const current = invoices[index]
  const strip = useRef<HTMLDivElement>(null)
  const go = (i: number) => {
    const next = invoices[i]
    if (!next) return
    setPickedId(next.card.id)
    const el = strip.current?.children[i] as HTMLElement | undefined
    // rola só a fileira (scrollIntoView mexeria também na página)
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - strip.current.offsetLeft, behavior: 'smooth' })
  }

  const upcoming = useMemo(
    () =>
      current
        ? [0, 1, 2].map((i) => invoiceFor(state, current.card, addMonths(month, i)))
        : [],
    [state, month, current],
  )
  const max = Math.max(1, ...upcoming.map((u) => u.amount))
  // altura do ponto de cada mês dentro da faixa do gráfico (10% a 90%)
  const y = (amount: number) => 90 - (amount / max) * 80

  return (
    <Panel className={cx('flex flex-col p-5 sm:p-6 tight:p-5', SCROLL)}>
      <PanelHeader title="Cartões" emoji="card">
        <p className="mt-3 text-caption text-muted">
          Fatura de {monthLower(month)}
          {current && invoices.length > 1 && <> · {current.card.name}</>}
        </p>
        <div className="mt-1">
          <Money cents={current?.amount ?? 0} />
        </div>
      </PanelHeader>

      {!current ? (
        <div className="mt-5 rounded-2xl bg-sunken px-4 py-6 text-center">
          <p className="text-muted">Cadastre um cartão pra acompanhar faturas e parcelas.</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => openForm({ type: 'card' })}>
            Adicionar cartão
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex shrink-0 tight:mt-2 items-center justify-between gap-2">
            <Button size="sm" onClick={() => openForm({ type: 'invoice', cardId: current.card.id, month })}>
              Ver fatura
            </Button>
            {invoices.length > 1 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-label="Cartão anterior"
                  disabled={index === 0}
                  onClick={() => go(index - 1)}
                  className="flex size-9 items-center justify-center rounded-full border border-line-strong text-fg hover:bg-sunken disabled:cursor-not-allowed disabled:text-faint disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Próximo cartão"
                  disabled={index === invoices.length - 1}
                  onClick={() => go(index + 1)}
                  className="flex size-9 items-center justify-center rounded-full border border-line-strong text-fg hover:bg-sunken disabled:cursor-not-allowed disabled:text-faint disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* a fileira sangra até a borda direita do painel: o próximo cartão aparece pela metade, como convite */}
          <div
            ref={strip}
            className="no-scrollbar -mr-5 mt-3 flex shrink-0 tight:mt-2 gap-3 overflow-x-auto py-1 pr-5 sm:-mr-6 sm:pr-6"
          >
            {invoices.map((inv, i) => (
              <CardVisual
                key={inv.card.id}
                card={inv.card}
                invoice={inv}
                className="!w-[min(320px,82%)] fit:!w-[min(272px,74%)] tight:!w-[min(216px,66%)]"
                onClick={() => (i === index ? openForm({ type: 'invoice', cardId: inv.card.id, month }) : go(i))}
              />
            ))}
          </div>

          <h3 className="mt-5 text-micro font-semibold tracking-[0.06em] text-faint fit:mt-4 tight:hidden">PRÓXIMAS FATURAS</h3>
          <div className="relative mt-2 tight:hidden">
            <ol className="grid grid-cols-3 gap-2">
              {upcoming.map((u, i) => (
                <li
                  key={u.month}
                  className={cx(
                    'flex h-[132px] flex-col items-center justify-between rounded-xl border p-2.5 text-center fit:h-[116px]',
                    i === 0 ? 'border-primary bg-linear-to-b from-surface from-45% to-primary-soft' : 'border-transparent bg-sunken',
                  )}
                >
                  <span>
                    <span className="block text-caption font-semibold">{monthShort(u.month)}</span>
                    {i === 0 && u.amount > 0 && <Badge tone={u.paid ? 'good' : 'primary'}>{u.paid ? 'Paga' : 'Aberta'}</Badge>}
                  </span>
                  <span className={cx('tnum text-caption font-semibold', i === 0 ? 'text-accent' : 'text-muted')}>
                    {brl(u.amount)}
                  </span>
                </li>
              ))}
            </ol>
            {/* linha ligando os três meses: sobe e desce com o valor da fatura */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-9 top-[58px]">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="size-full overflow-visible">
                <polyline
                  points={[...upcoming.map((u, i) => `${50 + i * 100},${y(u.amount)}`), `300,${y(upcoming[2].amount)}`].join(' ')}
                  fill="none"
                  stroke="var(--control)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {upcoming.map((u, i) => (
                <span
                  key={u.month}
                  className={cx(
                    'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface',
                    i === 0 ? 'border-primary' : 'border-control',
                  )}
                  style={{ left: `${((i + 0.5) / 3) * 100}%`, top: `${y(u.amount)}%` }}
                />
              ))}
            </div>
          </div>
          <Link
            href="/cartoes"
            className="mt-3 flex items-center justify-center gap-1 rounded-xl py-2 text-caption font-semibold text-accent hover:bg-primary-soft fit:hidden"
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
        <p className="mt-3 text-caption text-muted">Quanto você gasta pra morar</p>
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
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-caption">
                <span className={cx('flex items-center gap-1 font-semibold', ok ? 'text-good' : 'text-warn')}>
                  {ok ? <Check size={15} strokeWidth={3} /> : <TriangleAlert size={14} />}
                  {pct(sum.housing, sum.income)} da renda
                </span>
                <span className="text-muted">referência: até 30%</span>
              </p>
              <div className="relative mt-6">
                <span
                  className="tnum absolute -top-5 -translate-x-1/2 text-micro font-semibold text-muted"
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
                <div className="tnum mt-1.5 flex justify-between text-micro text-faint">
                  <span>0%</span>
                  <span>60% da renda</span>
                </div>
              </div>
            </>
          )}
          <h3 className="mt-5 text-caption font-semibold tight:hidden">O que entra na conta</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 tight:hidden">
            {items.map((o) => (
              <li key={o.entry.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => openForm({ type: 'occurrence', entryId: o.entry.id, month })}
                  className="-my-1 block w-full min-w-0 rounded-lg py-1 text-left hover:text-accent"
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

function ReserveStrip({ compact }: { compact?: boolean }) {
  const { state } = useStore()
  const [mode, setMode] = useState<'all' | 'open'>('all')
  if (state.goals.length === 0) return null
  const goals = state.goals
    .map((g) => ({ goal: g, balance: goalBalance(state, g) }))
    .filter((g) => mode === 'all' || g.goal.target_cents === 0 || g.balance < g.goal.target_cents)
  const total = state.goals.reduce((s, g) => s + goalBalance(state, g), 0)

  // Versão de uma linha, usada quando a Visão geral precisa caber na janela.
  if (compact)
    return (
      <Link
        href="/reserva"
        className="flex items-center gap-4 rounded-panel border border-line bg-surface px-5 py-3 shadow-card hover:border-line-strong sm:px-6"
      >
        <Emoji name="money-bag" size={36} />
        <span className="shrink-0">
          <span className="block text-caption text-muted">Reserva</span>
          <Amount cents={total} className="text-lead" />
        </span>
        <span className="flex min-w-0 flex-1 gap-5 overflow-hidden border-l border-line pl-5">
          {state.goals.slice(0, 3).map((goal) => {
            const balance = goalBalance(state, goal)
            return (
              <span key={goal.id} className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2 text-caption">
                  <span className="truncate font-medium">{goal.name}</span>
                  <span className="tnum shrink-0 text-muted">
                    {goal.target_cents > 0 ? pct(balance, goal.target_cents) : brl(balance)}
                  </span>
                </span>
                <Meter
                  value={balance}
                  max={goal.target_cents || balance || 1}
                  color="var(--good-fill)"
                  label={`${goal.name}: ${brl(balance)} guardados`}
                  className="mt-1.5 !h-1.5"
                />
              </span>
            )
          })}
        </span>
        <ChevronRight size={18} className="shrink-0 text-faint" />
      </Link>
    )

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PanelHeader title="Reserva">
          <div className="mt-2">
            <Money cents={total} size="lg" />
          </div>
          <p className="mt-1 text-caption text-muted">guardado em {state.goals.length === 1 ? '1 meta' : `${state.goals.length} metas`}</p>
        </PanelHeader>
        <div className="flex items-center gap-3">
          <Segmented
            label="Quais metas mostrar"
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
                <span className="tnum block text-caption text-muted">
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
