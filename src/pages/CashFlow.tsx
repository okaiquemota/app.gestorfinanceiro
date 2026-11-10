import { useMemo, useState } from 'react'
import { addMonths, summarize } from '../../shared/finance.ts'
import { brl, brlShort, monthLong, monthLongTitle, monthShort } from '../lib/format.ts'
import { navigate } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Amount, Money, Panel, cx } from '../ui.tsx'

const MONTHS = 12

/** Teto "redondo" pro eixo: 1, 2, 2,5 ou 5 × potência de 10. */
const niceMax = (v: number): number => {
  if (v <= 0) return 100
  const pow = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((m) => m >= v)!
}

export function CashFlow() {
  const { state, month, setMonth } = useStore()
  const [hover, setHover] = useState<number | null>(null)

  const rows = useMemo(() => {
    let acc = 0
    return Array.from({ length: MONTHS }, (_, i) => {
      const s = summarize(state, addMonths(month, i))
      acc += s.leftover
      return { ...s, acc }
    })
  }, [state, month])

  const total = rows[rows.length - 1].acc
  const tight = rows.reduce((a, b) => (b.leftover < a.leftover ? b : a))
  const avgOut = Math.round(rows.reduce((s, r) => s + r.expenses, 0) / MONTHS)
  const top = niceMax(Math.max(...rows.map((r) => Math.max(r.income, r.expenses))))
  const ticks = [1, 0.75, 0.5, 0.25, 0]

  const open = (m: string) => {
    setMonth(m)
    navigate('/')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Sobra somada em {MONTHS} meses</p>
          <Money cents={total} className={cx('mt-1', total < 0 && 'text-bad')} />
        </Panel>
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Mês mais apertado</p>
          <Money cents={tight.leftover} className={cx('mt-1', tight.leftover < 0 && 'text-bad')} />
          <p className="mt-1 text-[13px] text-muted">{monthLong(tight.month)}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Média de saídas por mês</p>
          <Money cents={avgOut} className="mt-1" />
        </Panel>
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Entradas e saídas previstas</h2>
          <ul className="flex gap-4 text-[13px] text-muted">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--s-in)' }} /> Entradas
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--s-out)' }} /> Saídas
            </li>
          </ul>
        </div>

        <div className="mt-5 flex gap-2">
          <div className="tnum flex h-56 w-14 shrink-0 flex-col justify-between text-right text-[11px] text-faint" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="-translate-y-1/2 leading-none">
                {brlShort(top * t)}
              </span>
            ))}
          </div>
          <div className="relative h-56 min-w-0 flex-1" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <span
                key={t}
                aria-hidden
                className={cx('absolute inset-x-0 border-t', t === 0 ? 'border-line-strong' : 'border-line')}
                style={{ top: `${(1 - t) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex">
              {rows.map((r, i) => (
                <button
                  key={r.month}
                  type="button"
                  aria-label={`${monthLong(r.month)}: entradas ${brl(r.income)}, saídas ${brl(r.expenses)}, sobra ${brl(r.leftover)}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => open(r.month)}
                  className={cx(
                    'relative flex flex-1 items-end justify-center gap-[2px] rounded-t-md px-[2px]',
                    hover === i && 'bg-sunken',
                  )}
                >
                  <span
                    className="w-full max-w-4 rounded-t-[4px]"
                    style={{ height: `${(r.income / top) * 100}%`, background: 'var(--s-in)' }}
                  />
                  <span
                    className="w-full max-w-4 rounded-t-[4px]"
                    style={{ height: `${(r.expenses / top) * 100}%`, background: 'var(--s-out)' }}
                  />
                </button>
              ))}
            </div>
            {hover !== null && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-[13px] shadow-pop"
                style={{ left: `clamp(96px, ${((hover + 0.5) / MONTHS) * 100}%, calc(100% - 96px))` }}
              >
                <p className="font-semibold">{monthLongTitle(rows[hover].month)}</p>
                <p className="mt-1.5 flex justify-between gap-3 text-muted">
                  Entradas <Amount cents={rows[hover].income} className="text-fg" />
                </p>
                <p className="flex justify-between gap-3 text-muted">
                  Saídas <Amount cents={rows[hover].expenses} className="text-fg" />
                </p>
                <p className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
                  Sobra <Amount cents={rows[hover].leftover} className={rows[hover].leftover < 0 ? 'text-bad' : 'text-good'} />
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex gap-2" aria-hidden>
          <div className="w-14 shrink-0" />
          <div className="flex min-w-0 flex-1">
            {rows.map((r, i) => (
              <span key={r.month} className={cx('flex-1 truncate text-center text-[11px]', i === 0 ? 'font-semibold text-fg' : 'text-faint')}>
                {monthShort(r.month)}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <h2 className="px-5 pt-5 text-[15px] font-semibold sm:px-6">Mês a mês</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="tnum w-full min-w-[680px] text-right text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-5 py-2 text-left font-semibold sm:px-6">Mês</th>
                <th className="px-3 py-2 font-semibold">Renda</th>
                <th className="px-3 py-2 font-semibold">Contas</th>
                <th className="px-3 py-2 font-semibold">Cartões</th>
                <th className="px-3 py-2 font-semibold">Dia a dia</th>
                <th className="px-3 py-2 font-semibold">Sobra</th>
                <th className="px-5 py-2 font-semibold sm:px-6">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.month}
                  onClick={() => open(r.month)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken"
                >
                  <th scope="row" className="px-5 py-2.5 text-left font-semibold sm:px-6">
                    {monthShort(r.month)}
                  </th>
                  <td className="px-3 py-2.5">{brl(r.income)}</td>
                  <td className="px-3 py-2.5 text-muted">{brl(r.housing + r.bills + r.savings)}</td>
                  <td className="px-3 py-2.5 text-muted">{brl(r.cards)}</td>
                  <td className="px-3 py-2.5 text-muted">{brl(r.daily)}</td>
                  <td className={cx('px-3 py-2.5 font-semibold', r.leftover < 0 ? 'text-bad' : 'text-good')}>
                    {brl(r.leftover)}
                  </td>
                  <td className={cx('px-5 py-2.5 font-semibold sm:px-6', r.acc < 0 && 'text-bad')}>{brl(r.acc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
