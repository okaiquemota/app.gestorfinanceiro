import { Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { goalBalance, monthDiff } from '../../shared/finance.ts'
import { Meter } from '../components.tsx'
import { api } from '../lib/api.ts'
import { brl, currentMonth, dateBR, monthLong, pct } from '../lib/format.ts'
import { useStore } from '../store.tsx'
import { Amount, Button, ConfirmButton, Emoji, EmptyState, IconButton, Money, Panel, cx } from '../ui.tsx'

export function Reserve() {
  const { state, openForm, run } = useStore()
  const total = state.goals.reduce((s, g) => s + goalBalance(state, g), 0)
  const names = new Map(state.goals.map((g) => [g.id, g.name]))

  if (state.goals.length === 0)
    return (
      <Panel>
        <EmptyState
          emoji="umbrella"
          title="Sua reserva começa aqui"
          action={
            <Button
              variant="primary"
              onClick={() => openForm({ type: 'goal' })}
            >
              Criar primeira meta
            </Button>
          }
        >
          Crie uma meta (reserva de emergência, viagem, entrada do apartamento…) e registre o que for guardando.
        </EmptyState>
      </Panel>
    )

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="text-caption text-muted">Total guardado</p>
          <Money cents={total} className="mt-1" />
        </div>
        <div className="flex items-center gap-4">
          <Button variant="primary" onClick={() => openForm({ type: 'goal' })}>
            <Plus size={16} strokeWidth={2.5} /> Nova meta
          </Button>
          <Emoji name="money-bag" size={64} className="hidden sm:block" />
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {state.goals.map((goal) => {
          const balance = goalBalance(state, goal)
          const left = goal.target_cents - balance
          const months = goal.deadline ? monthDiff(currentMonth(), goal.deadline) : 0
          return (
            <Panel key={goal.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <Emoji name={goal.icon} size={48} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lead font-semibold">{goal.name}</h2>
                  <Money cents={balance} size="lg" className="mt-1.5" />
                </div>
                <IconButton label={`Editar ${goal.name}`} onClick={() => openForm({ type: 'goal', goal })} className="-mr-2 -mt-1">
                  <Pencil size={15} />
                </IconButton>
              </div>
              {goal.target_cents > 0 && (
                <>
                  <Meter
                    value={balance}
                    max={goal.target_cents}
                    color="var(--good-fill)"
                    label={`${pct(balance, goal.target_cents)} da meta`}
                    className="mt-4"
                  />
                  <p className="tnum mt-2 flex justify-between text-xs text-muted">
                    <span className="font-semibold text-fg">{pct(balance, goal.target_cents)}</span>
                    <span>meta de {brl(goal.target_cents)}</span>
                  </p>
                  <p className="mt-2 text-caption text-muted">
                    {left <= 0
                      ? 'Meta batida 🎉'
                      : goal.deadline && months > 0
                        ? `Faltam ${brl(left)} — ${brl(Math.ceil(left / months))} por mês até ${monthLong(goal.deadline)}.`
                        : `Faltam ${brl(left)}.`}
                  </p>
                </>
              )}
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="primary" className="flex-1" onClick={() => openForm({ type: 'move', goalId: goal.id, direction: 'in' })}>
                  <Plus size={16} strokeWidth={2.5} /> Guardar
                </Button>
                <Button className="flex-1" onClick={() => openForm({ type: 'move', goalId: goal.id, direction: 'out' })}>
                  <Minus size={16} strokeWidth={2.5} /> Retirar
                </Button>
              </div>
            </Panel>
          )
        })}
      </div>

      <Panel className="p-5 sm:p-6">
        <h2 className="text-lead font-semibold">Histórico</h2>
        {state.goalMoves.length === 0 ? (
          <p className="py-8 text-center text-muted">Nada guardado ainda. Use “Guardar” em uma das metas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {state.goalMoves.slice(0, 50).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cx(
                    'flex size-8 shrink-0 items-center justify-center rounded-full max-[380px]:hidden',
                    m.amount_cents >= 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad',
                  )}
                >
                  {m.amount_cents >= 0 ? <Plus size={15} strokeWidth={2.5} /> : <Minus size={15} strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{names.get(m.goal_id)}</span>
                  <span className="block truncate text-xs text-muted">
                    {dateBR(m.date)}
                    {m.note && ` · ${m.note}`}
                  </span>
                </span>
                <Amount cents={m.amount_cents} className={m.amount_cents < 0 ? 'text-bad' : undefined} />
                {/* depósitos que vieram de uma conta paga se desfazem desmarcando a conta */}
                {m.entry_id ? (
                  <span className="size-10 max-sm:hidden" />
                ) : (
                  <ConfirmButton
                    label="Excluir movimentação"
                    onConfirm={() => run(() => api('DELETE', `/goal-moves/${m.id}`), { success: 'Movimentação excluída.' })}
                  >
                    <Trash2 size={15} />
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
