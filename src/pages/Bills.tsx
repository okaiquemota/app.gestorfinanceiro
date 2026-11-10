import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { payables } from '../../shared/finance.ts'
import type { Payable } from '../../shared/finance.ts'
import { PayableRow, dueStatus } from '../components.tsx'
import { dd, monthLower, weekday } from '../lib/format.ts'
import { useStore } from '../store.tsx'
import { Amount, Button, EmptyState, Money, Panel, Segmented, cx } from '../ui.tsx'

type Filter = 'all' | 'open' | 'paid'

export function Bills() {
  const { state, month, openForm } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const list = useMemo(() => payables(state, month), [state, month])

  const total = list.reduce((s, p) => s + p.amount, 0)
  const paid = list.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)
  const overdue = list.filter((p) => dueStatus(p) === 'overdue')

  const groups = useMemo(() => {
    const shown = list.filter((p) => filter === 'all' || (filter === 'paid' ? p.paid : !p.paid))
    const map = new Map<number, Payable[]>()
    for (const p of shown) map.set(p.day, [...(map.get(p.day) ?? []), p])
    return [...map.entries()]
  }, [list, filter])

  const add = () => openForm({ type: 'entry', kind: 'expense' })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Falta pagar</p>
          <Money cents={total - paid} className="mt-1" />
          {overdue.length > 0 && (
            <p className="mt-1 text-[13px] font-semibold text-bad">
              {overdue.length === 1 ? '1 conta atrasada' : `${overdue.length} contas atrasadas`}
            </p>
          )}
        </Panel>
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Já pago</p>
          <Money cents={paid} className="mt-1" />
          <p className="mt-1 text-[13px] text-muted">
            {list.filter((p) => p.paid).length} de {list.length} contas
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Total de {monthLower(month)}</p>
          <Money cents={total} className="mt-1" />
        </Panel>
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Contas de {monthLower(month)}</h2>
          <div className="flex items-center gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'open', label: 'A pagar' },
                { value: 'paid', label: 'Pagas' },
              ]}
            />
            <Button variant="primary" onClick={add} className="max-sm:hidden">
              <Plus size={16} strokeWidth={2.5} /> Nova conta
            </Button>
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState
            emoji="receipt"
            title={`Nenhuma conta em ${monthLower(month)}`}
            action={
              <Button variant="primary" onClick={add}>
                Adicionar conta
              </Button>
            }
          >
            Cadastre aluguel, luz, internet, parcelas… As que se repetem aparecem sozinhas todo mês.
          </EmptyState>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-muted">
            {filter === 'paid' ? 'Nenhuma conta paga ainda.' : 'Tudo pago por aqui.'}
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {groups.map(([day, items]) => {
              const late = items.some((p) => dueStatus(p) === 'overdue')
              return (
                <section key={day}>
                  <header className="flex items-baseline justify-between border-b border-line pb-1.5">
                    <h3 className={cx('text-[13px] font-semibold', late ? 'text-bad' : 'text-muted')}>
                      <span className="tnum text-fg">Dia {dd(day)}</span> · {weekday(month, day)}
                    </h3>
                    <Amount cents={items.reduce((s, p) => s + p.amount, 0)} className="text-[13px] text-muted" />
                  </header>
                  <ul className="divide-y divide-line">
                    {items.map((p) => (
                      <PayableRow key={p.key} p={p} detailed />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
