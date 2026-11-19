import { Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { goalBalance, monthDiff } from '../../shared/finance.ts'
import { Meter } from '../components.tsx'
import { api } from '../lib/api.ts'
import { achievements, streak } from '../lib/fun.ts'
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
          emoji="mascote-moeda"
          title="Sua reserva começa aqui"
          action={
            <Button variant="primary" onClick={() => openForm({ type: 'goal' })}>
              Criar primeira meta
            </Button>
          }
        >
          Crie uma meta (reserva de emergência, viagem, entrada do apartamento…) e registre o que for guardando.
        </EmptyState>
      </Panel>
    )

  return (
    <div className="fit-page space-y-3 sm:space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
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

      {/* no computador: metas, histórico e conquistas lado a lado, cada um rolando por dentro */}
      <div className="fit-grow fit-grid space-y-3 sm:space-y-4 fit:grid fit:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-4 fit:gap-4 fit:space-y-0">
        {/* todas as metas num card só, que ocupa a coluna inteira e rola por dentro */}
        <Panel className="fit-scroll flex flex-col p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lead font-semibold">Metas</h2>
            <span className="text-caption text-muted">{state.goals.length === 1 ? '1 meta' : `${state.goals.length} metas`}</span>
          </div>
          {state.goals.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
              <Emoji name="mascote-moeda" size={88} className="mascot" />
              <p className="max-w-xs text-muted">Crie uma meta pra começar a guardar: reserva de emergência, viagem, um sonho…</p>
              <Button variant="primary" onClick={() => openForm({ type: 'goal' })}>
                <Plus size={16} strokeWidth={2.5} /> Nova meta
              </Button>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2 fit:md:grid-cols-1 fit:2xl:grid-cols-2">
              {state.goals.map((goal) => {
                const balance = goalBalance(state, goal)
                const left = goal.target_cents - balance
                const months = goal.deadline ? monthDiff(currentMonth(), goal.deadline) : 0
                return (
                  <div key={goal.id} className="flex flex-col rounded-2xl border border-line p-4">
                    <div className="flex items-start gap-3">
                      <Emoji name={goal.icon} size={48} />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lead font-semibold">{goal.name}</h3>
                        <Money cents={balance} size="lg" className="mt-1.5" />
                      </div>
                      <IconButton
                        label={`Editar ${goal.name}`}
                        onClick={() => openForm({ type: 'goal', goal })}
                        className="-mr-2 -mt-1"
                      >
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
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() =>
                          openForm({
                            type: 'move',
                            goalId: goal.id,
                            direction: 'in',
                          })
                        }
                      >
                        <Plus size={16} strokeWidth={2.5} /> Guardar
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() =>
                          openForm({
                            type: 'move',
                            goalId: goal.id,
                            direction: 'out',
                          })
                        }
                      >
                        <Minus size={16} strokeWidth={2.5} /> Retirar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel className="fit-scroll p-4 sm:p-6">
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
                      onConfirm={() =>
                        run(() => api('DELETE', `/goal-moves/${m.id}`), {
                          success: 'Movimentação excluída.',
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </ConfirmButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <AchievementsPanel />
      </div>
    </div>
  )
}

function AchievementsPanel() {
  const { state, openForm, run, celebrate } = useStore()
  const list = achievements(state)
  const streakRun = streak(state)
  const mine = state.challenges
  const done = list.filter((a) => a.done).length + mine.filter((c) => c.done_at).length
  const total = list.length + mine.length
  // reveladas primeiro; as secretas ainda trancadas vão pro fim, como "???"
  const ordered = [...list.filter((a) => !a.secret || a.done), ...list.filter((a) => a.secret && !a.done)]
  const locked = list.filter((a) => a.secret && !a.done).length

  const finish = (id: string, title: string) =>
    run(() => api('POST', `/challenges/${id}/done`, { done: true })).then((ok) => ok && celebrate(`Conquista: ${title}!`))

  return (
    <Panel className="fit-scroll p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lead font-semibold">Conquistas</h2>
          <p className="text-caption text-muted">
            {done} de {total}
            {streakRun > 0 && <> · {streakRun === 1 ? '1 mês seguido' : `${streakRun} meses seguidos`} no azul</>}
          </p>
        </div>
        <Button className="shrink-0" onClick={() => openForm({ type: 'challenge' })}>
          <Plus size={16} strokeWidth={2.5} /> Criar
        </Button>
      </div>

      {/* as criadas pela pessoa: desafios do ano, promessas, o que ela quiser */}
      {mine.length > 0 && (
        <>
          <h3 className="mt-4 text-micro font-semibold tracking-[0.06em] text-faint">SUAS</h3>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4 fit:sm:grid-cols-1 fit:xl:grid-cols-1">
            {mine.map((c) => (
              <li
                key={c.id}
                className={cx(
                  'flex items-center gap-3 rounded-2xl border p-3',
                  c.done_at ? 'border-primary/40 bg-primary-soft' : 'border-dashed border-line-strong',
                )}
              >
                <button
                  type="button"
                  onClick={() => openForm({ type: 'challenge', challenge: c })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Editar ${c.title}`}
                >
                  <Emoji name={c.icon} size={36} className={c.done_at ? undefined : 'opacity-50 grayscale'} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cx('font-semibold', !c.done_at && 'text-muted')}>{c.title}</span>
                      {c.year !== null && (
                        <span className="rounded-full bg-sunken px-1.5 text-micro font-semibold text-muted">{c.year}</span>
                      )}
                    </span>
                    {c.text && <span className="block text-xs text-muted sm:text-caption">{c.text}</span>}
                    {c.done_at && <span className="block text-xs font-semibold text-accent">Concluída em {dateBR(c.done_at.slice(0, 10))}</span>}
                  </span>
                </button>
                {!c.done_at && (
                  <Button variant="primary" className="shrink-0" onClick={() => finish(c.id, c.title)}>
                    Concluí!
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-micro font-semibold tracking-[0.06em] text-faint">DO POUPIN</h3>
        </>
      )}

      {/* no celular, duas por linha: ícone em cima, texto embaixo */}
      <ul
        className={cx(
          'grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4 fit:grid-cols-1 fit:sm:grid-cols-1 fit:xl:grid-cols-1',
          mine.length > 0 ? 'mt-2' : 'mt-3 sm:mt-4',
        )}
      >
        {ordered.map((a) => {
          const hidden = a.secret && !a.done
          return (
            <li
              key={a.id}
              className={cx(
                'flex flex-col items-start gap-1.5 rounded-2xl border p-3 sm:flex-row sm:items-center sm:gap-3',
                a.done ? 'border-line bg-surface' : 'border-dashed border-line-strong',
              )}
            >
              <Emoji name={hidden ? 'lock' : a.emoji} size={36} className={a.done ? undefined : 'opacity-35 grayscale'} />
              <span className="min-w-0">
                <span className={cx('block font-semibold', !a.done && 'text-muted')}>{hidden ? '???' : a.title}</span>
                <span className="block text-xs text-muted sm:text-caption">
                  {hidden ? 'Conquista secreta. Continue usando pra descobrir.' : a.text}
                </span>
                {a.secret && a.done && <span className="block text-xs font-semibold text-accent">Secreta</span>}
                <span className="sr-only">{a.done ? ' (conquistada)' : hidden ? ' (secreta, ainda não)' : ' (ainda não)'}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {locked > 0 && (
        <p className="mt-3 text-center text-caption text-muted">
          {locked === 1 ? 'Falta 1 conquista secreta.' : `Faltam ${locked} conquistas secretas.`}
        </p>
      )}
    </Panel>
  )
}
