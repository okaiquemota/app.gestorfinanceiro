import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { addMonths, cardCommitted, invoiceFor } from '../../shared/finance.ts'
import { CardVisual, Meter } from '../components.tsx'
import { category } from '../lib/categories.ts'
import { brl, dayMonth, monthLong, monthLower, monthShort, pct } from '../lib/format.ts'
import { useStore } from '../store.tsx'
import { Amount, Badge, Button, Emoji, EmptyState, IconButton, Money, Panel, cx } from '../ui.tsx'

export function Cards() {
  const { state, month, setMonth, openForm } = useStore()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const card = state.cards.find((c) => c.id === pickedId) ?? state.cards[0]

  const invoices = useMemo(() => state.cards.map((c) => invoiceFor(state, c, month)), [state, month])
  const inv = useMemo(() => (card ? invoiceFor(state, card, month) : null), [state, card, month])
  const next = useMemo(
    () => (card ? Array.from({ length: 6 }, (_, i) => invoiceFor(state, card, addMonths(month, i))) : []),
    [state, card, month],
  )

  if (!card || !inv)
    return (
      <Panel>
        <EmptyState
          emoji="card"
          title="Nenhum cartão cadastrado"
          action={
            <Button variant="primary" onClick={() => openForm({ type: 'card' })}>
              Adicionar cartão
            </Button>
          }
        >
          Com o cartão cadastrado, a fatura entra nas contas do mês e as parcelas aparecem nos meses seguintes.
        </EmptyState>
      </Panel>
    )

  const committed = cardCommitted(state, card, month)
  const max = Math.max(1, ...next.map((n) => n.amount))

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-1">
        {invoices.map((i) => (
          <CardVisual key={i.card.id} card={i.card} invoice={i} selected={i.card.id === card.id} onClick={() => setPickedId(i.card.id)} />
        ))}
        <button
          type="button"
          onClick={() => openForm({ type: 'card' })}
          className="flex aspect-[1.6] w-[270px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong font-semibold text-muted hover:border-primary hover:text-accent"
        >
          <Plus size={22} />
          Novo cartão
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_392px]">
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lead font-semibold">
                {card.name}
                {inv.amount > 0 && <Badge tone={inv.paid ? 'good' : 'primary'}>{inv.paid ? 'Paga' : 'Aberta'}</Badge>}
              </h2>
              <p className="mt-3 text-caption text-muted">Fatura de {monthLower(month)}</p>
              <Money cents={inv.amount} approx={!inv.manual && inv.amount > 0} className="mt-1" />
              <p className="mt-1.5 text-caption text-muted">
                vence em {dayMonth(month, inv.day)} · fecha dia {card.closing_day}
                {inv.manual && inv.computed !== inv.amount && <> · valor informado ({brl(inv.computed)} em compras lançadas)</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <IconButton label="Editar cartão" onClick={() => openForm({ type: 'card', card })}>
                <Pencil size={16} />
              </IconButton>
              <Button onClick={() => openForm({ type: 'invoice', cardId: card.id, month })}>Editar fatura</Button>
              <Button variant="primary" onClick={() => openForm({ type: 'purchase', cardId: card.id })}>
                <Plus size={16} strokeWidth={2.5} /> Compra
              </Button>
            </div>
          </div>

          <h3 className="mt-6 border-b border-line pb-1.5 text-caption font-semibold text-muted">
            Lançamentos desta fatura
          </h3>
          {inv.items.length === 0 ? (
            <p className="py-8 text-center text-muted">
              Nenhuma compra lançada nesta fatura.
              <br />
              Lance compra por compra ou só informe o valor fechado em “Editar fatura”.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {inv.items.map(({ purchase, amount, installment }) => (
                <li key={purchase.id}>
                  <button
                    type="button"
                    onClick={() => openForm({ type: 'purchase', purchase })}
                    className="group flex min-h-12 w-full items-center gap-3 py-2.5 text-left"
                  >
                    <Emoji name={category(purchase.category).emoji} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{purchase.description}</span>
                      <span className="block text-xs text-muted">
                        {category(purchase.category).label}
                        {purchase.recurring && ' · assinatura'}
                        {installment && ` · parcela ${installment} de ${purchase.installments}`}
                      </span>
                    </span>
                    <Amount cents={amount} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          {card.limit_cents > 0 && (
            <Panel className="p-5 sm:p-6">
              <h2 className="text-lead font-semibold">Limite</h2>
              <p className="mt-3 text-caption text-muted">Livre</p>
              <Money cents={card.limit_cents - committed} size="lg" className="mt-1" />
              <Meter
                value={committed}
                max={card.limit_cents}
                color={committed > card.limit_cents * 0.8 ? 'var(--warn)' : 'var(--primary)'}
                label={`${pct(committed, card.limit_cents)} do limite usado`}
                className="mt-3"
              />
              <p className="tnum mt-2 flex justify-between text-xs text-muted">
                <span>
                  {brl(committed)} usado · {pct(committed, card.limit_cents)}
                </span>
                <span>de {brl(card.limit_cents)}</span>
              </p>
            </Panel>
          )}

          <Panel className="p-5 sm:p-6">
            <h2 className="text-lead font-semibold">Próximas faturas</h2>
            <p className="mt-1 text-caption text-muted">Parcelas e assinaturas já lançadas.</p>
            <ol className="mt-3 space-y-0.5">
              {next.map((n) => (
                <li key={n.month}>
                  <button
                    type="button"
                    onClick={() => setMonth(n.month)}
                    aria-label={`Ver ${monthLong(n.month)}: fatura de ${brl(n.amount)}`}
                    className="grid min-h-9 w-full grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg text-left hover:bg-sunken"
                  >
                    <span className={cx('text-caption font-semibold', n.month === month ? 'text-accent' : 'text-muted')}>
                      {monthShort(n.month)}
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(n.amount / max) * 100}%`,
                          background: n.month === month ? 'var(--primary)' : 'var(--line-strong)',
                        }}
                      />
                    </span>
                    <Amount cents={n.amount} className="text-caption" />
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}
