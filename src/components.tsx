// Peças usadas por mais de uma tela: linha de conta a pagar, cartão visual, barra de progresso.

import type { ReactNode } from 'react'
import { ChevronRight, Wifi } from 'lucide-react'
import { cardCommitted, dueDate, payables, toISODate } from '../shared/finance.ts'
import type { InvoiceView, Payable } from '../shared/finance.ts'
import type { AppState, Card } from '../shared/types.ts'
import { api } from './lib/api.ts'
import { CARD_COLORS, category } from './lib/categories.ts'
import { brl, brlRound, dayMonth, monthLower } from './lib/format.ts'
import { playCoin } from './lib/fun.ts'
import { useStore } from './store.tsx'
import { Amount, Badge, CheckCircle, Emoji, cx } from './ui.tsx'

// ---------- contas a pagar ----------

export type DueStatus = 'paid' | 'overdue' | 'today' | 'upcoming'

export const dueStatus = (p: Pick<Payable, 'paid' | 'month' | 'day'>, today = toISODate(new Date())): DueStatus => {
  if (p.paid) return 'paid'
  const due = dueDate(p.month, p.day)
  return due < today ? 'overdue' : due === today ? 'today' : 'upcoming'
}

export const daysUntil = (iso: string, today = new Date()): number => {
  const [y, m, d] = iso.split('-').map(Number)
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000)
}

/** Marcar paga/abrir detalhes de uma conta ou fatura, com a tela reagindo na hora. */
export const usePayableActions = () => {
  const { run, openForm, state, celebrate } = useStore()

  const setPaid = (p: Payable, paid: boolean) => {
    const paidAt = paid ? toISODate(new Date()) : null
    if (paid) {
      // era a última conta em aberto do mês? então é festa; senão, só a moedinha
      const others = payables(state, p.month).filter((o) => o.key !== p.key)
      if (others.length > 0 && others.every((o) => o.paid)) celebrate(`Tudo pago em ${monthLower(p.month)}!`)
      else playCoin()
    }
    if (p.type === 'entry')
      return run(
        () => api('PUT', `/entries/${p.id}/months/${p.month}`, { paid }),
        {
          patch: (s: AppState) => {
            const cur = s.entryMonths.find((r) => r.entry_id === p.id && r.month === p.month)
            const row = { entry_id: p.id, month: p.month, amount_cents: null, skipped: false, ...cur, paid_at: paidAt }
            return { ...s, entryMonths: [...s.entryMonths.filter((r) => r !== cur), row] }
          },
        },
      )
    return run(
      () => api('PUT', `/cards/${p.id}/invoices/${p.month}`, { paid }),
      {
        patch: (s: AppState) => {
          const cur = s.invoices.find((r) => r.card_id === p.id && r.month === p.month)
          const row = { card_id: p.id, month: p.month, amount_cents: null, ...cur, paid_at: paidAt }
          return { ...s, invoices: [...s.invoices.filter((r) => r !== cur), row] }
        },
      },
    )
  }

  const open = (p: Payable) =>
    openForm(
      p.type === 'entry'
        ? { type: 'occurrence', entryId: p.id, month: p.month }
        : { type: 'invoice', cardId: p.id, month: p.month },
    )

  return { setPaid, open }
}

export function PayableRow({ p, detailed }: { p: Payable; detailed?: boolean }) {
  const { setPaid, open } = usePayableActions()
  const status = dueStatus(p)
  const cat = category(p.category)
  return (
    <li className="flex items-center gap-3">
      <CheckCircle
        checked={p.paid}
        onChange={(v) => setPaid(p, v)}
        label={p.paid ? `Desmarcar ${p.name} como paga` : `Marcar ${p.name} como paga`}
      />
      <button
        type="button"
        onClick={() => open(p)}
        className="group flex min-h-12 min-w-0 flex-1 tight:min-h-10 tight:py-1.5 items-center gap-3 rounded-lg py-2 text-left"
      >
        {/* em telas muito estreitas o nome da conta vale mais que o ícone */}
        {detailed && <Emoji name={cat.emoji} size={30} className={cx('max-[359px]:hidden', p.paid && 'opacity-50')} />}
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate font-medium group-hover:text-accent', p.paid && 'text-faint line-through')}>
            {p.name}
          </span>
          {detailed && (
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
              {cat.label}
              {p.installment && (
                <span>
                  · {p.installment.n}/{p.installment.total}
                </span>
              )}
              {status === 'overdue' && <Badge tone="bad">Atrasada</Badge>}
              {status === 'today' && <Badge tone="warn">Vence hoje</Badge>}
            </span>
          )}
        </span>
        <Amount cents={p.amount} approx={p.estimated && !p.paid} className={p.paid ? 'text-faint' : undefined} />
        {detailed && <ChevronRight size={16} className="text-faint group-hover:text-fg max-[359px]:hidden" />}
      </button>
    </li>
  )
}

// ---------- cartão ----------

export function CardVisual({
  card,
  invoice,
  selected,
  onClick,
  className,
  compact,
}: {
  card: Card
  invoice: InvoiceView
  selected?: boolean
  onClick?: () => void
  className?: string
  /** Versão menor, que ocupa a largura da coluna: vários cartões lado a lado sem cortar nenhum. */
  compact?: boolean
}) {
  const { state } = useStore()
  const free = card.limit_cents - cardCommitted(state, card, invoice.month)
  const status = invoice.amount <= 0 ? 'Sem fatura' : invoice.paid ? 'Paga' : 'Aberta'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{ background: (CARD_COLORS[card.color] ?? CARD_COLORS.graphite).bg }}
      className={cx(
        'relative flex aspect-[1.6] flex-col justify-between overflow-hidden rounded-2xl text-left text-white shadow-card ring-offset-2 ring-offset-surface transition-shadow',
        compact ? 'w-full min-w-0 p-3' : 'w-[270px] shrink-0 snap-start p-4',
        selected && 'ring-2 ring-primary',
        className,
      )}
    >
      {/* brilho diagonal, pra parecer cartão de verdade */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgb(255_255_255/0.10)_50%,transparent_60%)]"
      />
      <span className="relative flex items-start justify-between gap-2">
        <span className={cx('truncate font-semibold', compact ? 'text-caption' : 'text-lead')}>{card.name}</span>
        <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">{status}</span>
      </span>
      <span className="relative flex items-center justify-between">
        <span
          aria-hidden
          className={cx('grid grid-cols-3 gap-px overflow-hidden rounded-md bg-black/20 p-px', compact ? 'h-5 w-7' : 'h-7 w-9')}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="bg-white/80" />
          ))}
        </span>
        {card.last4 && !compact && <span className="tnum text-xs tracking-[0.2em] text-white/80">•••• {card.last4}</span>}
        <Wifi aria-hidden size={compact ? 14 : 18} className="rotate-90 text-white/70" />
      </span>
      <span className="relative flex items-end justify-between gap-2">
        <span>
          <span className="block text-[9px] font-semibold tracking-[0.1em] text-white/60">VENCE</span>
          <span className={cx('tnum font-semibold', compact ? 'text-xs' : 'text-sm')}>{dayMonth(invoice.month, invoice.day)}</span>
        </span>
        {card.limit_cents > 0 && (
          <span className="text-right">
            <span className="block text-[9px] font-semibold tracking-[0.1em] text-white/60">{compact ? 'LIVRE' : 'LIMITE LIVRE'}</span>
            <span className={cx('tnum font-semibold', compact ? 'text-xs' : 'text-sm')}>{compact ? brlRound(free) : brl(free)}</span>
          </span>
        )}
      </span>
    </button>
  )
}

// ---------- progresso ----------

/** Barra de progresso de 0 a 100%. */
export function Meter({
  value,
  max,
  color = 'var(--primary)',
  label,
  className,
}: {
  value: number
  max: number
  color?: string
  label: string
  className?: string
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx('h-2 overflow-hidden rounded-full bg-sunken', className)}
    >
      <div className="bar-x h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
    </div>
  )
}

export function PanelHeader({
  title,
  aside,
  emoji,
  children,
}: {
  title: string
  aside?: ReactNode
  emoji?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lead font-semibold">
          {title}
          {aside}
        </h2>
        {children}
      </div>
      {emoji && <Emoji name={emoji} size={64} className="-mr-1 -mt-1 drop-shadow-[0_8px_10px_rgb(0_0_0/0.12)]" />}
    </div>
  )
}
