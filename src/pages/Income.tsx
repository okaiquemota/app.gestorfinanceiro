import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { occurrences } from '../../shared/finance.ts'
import { api } from '../lib/api.ts'
import { brl, dayMonth, monthLower } from '../lib/format.ts'
import { useStore } from '../store.tsx'
import { Amount, Badge, Button, Emoji, EmptyState, MoneyInput, Money, Panel } from '../ui.tsx'

export function Income() {
  const { state, month, openForm, run } = useStore()
  const list = useMemo(() => occurrences(state, month, 'income'), [state, month])
  const total = list.filter((o) => !o.skipped).reduce((s, o) => s + o.amount, 0)

  const saved = state.user.daily_budget_cents
  const [daily, setDaily] = useState(saved)
  const [busy, setBusy] = useState(false)
  useEffect(() => setDaily(saved), [saved])

  const saveDaily = async () => {
    setBusy(true)
    await run(() => api('PUT', '/me', { name: state.user.name, daily_budget_cents: daily }), { success: 'Gasto do dia a dia salvo.' })
    setBusy(false)
  }
  const add = () => openForm({ type: 'entry', kind: 'income' })

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_392px]">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lead font-semibold">Minha renda</h2>
            <p className="mt-3 text-caption text-muted">Entra em {monthLower(month)}</p>
            <Money cents={total} className="mt-1" />
          </div>
          <Button variant="primary" onClick={add}>
            <Plus size={16} strokeWidth={2.5} /> Nova renda
          </Button>
        </div>

        {list.length === 0 ? (
          <EmptyState emoji="banknote" title={`Nenhuma renda em ${monthLower(month)}`}>
            Cadastre seu salário e o que mais entra. É daqui que sai a conta de quanto sobra.
          </EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {list.map((o) => (
              <li key={o.entry.id}>
                <button
                  type="button"
                  onClick={() => openForm({ type: 'occurrence', entryId: o.entry.id, month })}
                  className="group flex min-h-12 w-full items-center gap-3 py-3 text-left"
                >
                  <Emoji name="banknote" size={32} className={o.skipped ? 'opacity-40' : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className={o.skipped ? 'block truncate font-medium text-faint line-through' : 'block truncate font-medium'}>
                      {o.entry.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                      cai em {dayMonth(month, o.day)}
                      {o.entry.end_month === null && ' · todo mês'}
                      {o.installment && ` · ${o.installment.n}/${o.installment.total}`}
                      {o.paid && <Badge tone="good">Recebido</Badge>}
                      {o.skipped && <Badge>Sem este mês</Badge>}
                    </span>
                  </span>
                  <Amount cents={o.amount} className={o.skipped ? 'text-faint' : undefined} />
                  <ChevronRight size={16} className="text-faint group-hover:text-fg" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="self-start p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lead font-semibold">Dia a dia</h2>
            <p className="mt-1 text-caption text-muted">
              Quanto você separa por mês pro que não é conta fixa: mercado, gasolina, lanche, farmácia.
            </p>
          </div>
          <Emoji name="coin" size={48} />
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            saveDaily()
          }}
        >
          <MoneyInput cents={daily} onChange={setDaily} large ariaLabel="Gasto do dia a dia por mês" />
          <Button type="submit" variant="primary" className="w-full" disabled={busy || daily === saved}>
            {busy ? 'Salvando…' : daily === saved ? 'Salvo' : 'Salvar'}
          </Button>
        </form>
        <p className="mt-3 text-xs text-faint">
          Esse valor sai do saldo previsto de todos os meses. Hoje: {brl(saved)}.
        </p>
      </Panel>
    </div>
  )
}
