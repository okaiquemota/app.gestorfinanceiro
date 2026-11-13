import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { addMonths, summarize } from '../../shared/finance.ts'
import { brl, brlShort, monthLong, monthLongTitle, monthShort } from '../lib/format.ts'
import { navigate } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Amount, Money, Panel, cx } from '../ui.tsx'

const MONTHS = 12

const NARROW = '(max-width: 639px)'
const useNarrow = (): boolean => {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

/** Teto "redondo" pro eixo: 1, 2, 2,5 ou 5 × potência de 10. */
const niceMax = (v: number): number => {
  if (v <= 0) return 100
  const pow = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((m) => m >= v)!
}

export function CashFlow() {
  const { state, month, setMonth } = useStore()
  const [hover, setHover] = useState<number | null>(null)
  // No celular o gráfico mostra 6 meses: com 12, cada coluna ficaria estreita demais pra tocar.
  const narrow = useNarrow()
  const shown = narrow ? 6 : MONTHS

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
          <p className="text-caption text-muted">Sobra somada em {MONTHS} meses</p>
          <Money cents={total} className={cx('mt-1', total < 0 && 'text-bad')} />
        </Panel>
        <Panel className="p-5">
          <p className="text-caption text-muted">Mês mais apertado</p>
          <Money cents={tight.leftover} className={cx('mt-1', tight.leftover < 0 && 'text-bad')} />
          <p className="mt-1 text-caption text-muted">{monthLong(tight.month)}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-caption text-muted">Média de saídas por mês</p>
          <Money cents={avgOut} className="mt-1" />
        </Panel>
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lead font-semibold">
            Entradas e saídas previstas <span className="font-normal text-muted sm:hidden">· 6 meses</span>
          </h2>
          <ul className="flex gap-4 text-caption text-muted">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--s-in)' }} /> Entradas
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--s-out)' }} /> Saídas
            </li>
          </ul>
        </div>

        <div className="mt-5 flex gap-2">
          <div className="tnum flex h-56 w-14 shrink-0 flex-col justify-between text-right text-micro text-faint" aria-hidden>
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
              {rows.slice(0, shown).map((r, i) => (
                <button
                  key={r.month}
                  type="button"
                  aria-label={`${monthLong(r.month)}: entradas ${brl(r.income)}, saídas ${brl(r.expenses)}, sobra ${brl(r.leftover)}`}
                  aria-pressed={hover === i}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  // toque: mostra o detalhe do mês (pra abrir o mês, use a tabela abaixo)
                  onClick={() => setHover(i)}
                  className={cx(
                    'relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md px-[2px]',
                    hover === i && 'bg-sunken',
                  )}
                >
                  <span
                    className="bar-y w-full max-w-4 rounded-t-[4px]"
                    style={{ height: `${(r.income / top) * 100}%`, background: 'var(--s-in)', animationDelay: `${i * 35}ms` }}
                  />
                  <span
                    className="bar-y w-full max-w-4 rounded-t-[4px]"
                    style={{ height: `${(r.expenses / top) * 100}%`, background: 'var(--s-out)', animationDelay: `${i * 35 + 60}ms` }}
                  />
                </button>
              ))}
            </div>
            {hover !== null && hover < shown && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-caption shadow-pop"
                style={{ left: `clamp(96px, ${((hover + 0.5) / shown) * 100}%, calc(100% - 96px))` }}
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
            {rows.slice(0, shown).map((r, i) => (
              <span key={r.month} className={cx('flex-1 truncate text-center text-micro', i === 0 ? 'font-semibold text-fg' : 'text-faint')}>
                {monthShort(r.month)}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <h2 className="px-5 pt-5 text-lead font-semibold sm:px-6">Mês a mês</h2>
        <p className="px-5 text-caption text-muted sm:px-6">Toque no mês pra abrir ele na visão geral.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="tnum w-full whitespace-nowrap text-right text-caption md:min-w-[680px]">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-5 py-2 text-left font-semibold sm:px-6">Mês</th>
                <th className="px-2 py-2 font-semibold sm:px-3">Renda</th>
                <th className="px-2 py-2 font-semibold sm:px-3 md:hidden">Saídas</th>
                <th className="px-2 py-2 font-semibold sm:px-3 max-md:hidden">Contas</th>
                <th className="px-2 py-2 font-semibold sm:px-3 max-md:hidden">Cartões</th>
                <th className="px-2 py-2 font-semibold sm:px-3 max-md:hidden">Dia a dia</th>
                <th className="px-2 py-2 font-semibold max-sm:pr-5 sm:px-3">Sobra</th>
                <th className="px-5 py-2 font-semibold max-sm:hidden sm:px-6">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-line last:border-0 hover:bg-sunken">
                  <th scope="row" className="py-1 pl-3 pr-0 text-left font-semibold sm:px-4">
                    <button
                      type="button"
                      onClick={() => open(r.month)}
                      aria-label={`Abrir ${monthLong(r.month)} na visão geral`}
                      className="flex h-9 items-center gap-1 rounded-lg px-2 text-accent hover:bg-primary-soft"
                    >
                      {monthShort(r.month)}
                      <ChevronRight size={14} />
                    </button>
                  </th>
                  <td className="px-2 py-2.5 sm:px-3">{brl(r.income)}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-muted md:hidden">{brl(r.expenses)}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-muted max-md:hidden">{brl(r.housing + r.bills + r.savings)}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-muted max-md:hidden">{brl(r.cards)}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-muted max-md:hidden">{brl(r.daily)}</td>
                  <td className={cx('px-2 py-2.5 font-semibold max-sm:pr-5 sm:px-3', r.leftover < 0 ? 'text-bad' : 'text-good')}>
                    {brl(r.leftover)}
                  </td>
                  <td className={cx('px-5 py-2.5 font-semibold max-sm:hidden sm:px-6', r.acc < 0 && 'text-bad')}>{brl(r.acc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
