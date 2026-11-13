import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'
import { Check, CircleAlert, X } from 'lucide-react'
import { monthNames, monthParts, splitBRL } from './lib/format.ts'

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ')

// ---------- dinheiro ----------

const MONEY_SIZES = {
  // cresce com a tela, mas nunca estoura um celular de 320px
  hero: { int: 'text-[clamp(2.25rem,10.5vw,3.25rem)] leading-none tracking-[-0.035em]', small: 'text-lg sm:text-xl' },
  xl: { int: 'text-[30px] sm:text-[34px] leading-none tracking-[-0.03em]', small: 'text-sm' },
  lg: { int: 'text-2xl leading-none tracking-[-0.02em]', small: 'text-xs' },
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Anima um valor em centavos do que estava na tela até o novo, em ~0,5s. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    if (reducedMotion()) {
      from.current = target
      setShown(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 500)
      const eased = 1 - (1 - p) ** 3
      const value = Math.round(start + (target - start) * eased)
      from.current = value
      setShown(value)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

/** Valor em destaque: "R$" apagado, inteiro forte, centavos pequenos. */
export function Money({
  cents,
  size = 'xl',
  approx,
  className,
}: {
  cents: number
  size?: keyof typeof MONEY_SIZES
  approx?: boolean
  className?: string
}) {
  // o número "corre" até o valor novo quando ele muda (troca de mês, conta paga…)
  const { neg, int, dec } = splitBRL(useCountUp(cents))
  const s = MONEY_SIZES[size]
  return (
    <span className={cx('tnum inline-flex items-baseline whitespace-nowrap font-semibold', className)}>
      <span className={cx(s.int, 'mr-[0.18em] text-ghost')}>
        {approx ? '≈ ' : ''}
        {neg ? '−' : ''}R$
      </span>
      <span className={s.int}>{int}</span>
      <span className={cx(s.small, 'font-medium text-faint')}>,{dec}</span>
    </span>
  )
}

/** Valor em linha de lista. */
export function Amount({ cents, approx, className }: { cents: number; approx?: boolean; className?: string }) {
  const { neg, int, dec } = splitBRL(cents)
  return (
    <span className={cx('tnum whitespace-nowrap font-semibold', className)}>
      {approx && <span className="font-normal text-faint">≈ </span>}
      {neg ? '−' : ''}R$ {int},{dec}
    </span>
  )
}

// ---------- superfícies ----------

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('min-w-0 rounded-panel border border-line bg-surface shadow-card', className)}>
      {children}
    </section>
  )
}

export function Emoji({
  name,
  size = 48,
  className,
  alt = '',
}: {
  name: string
  size?: number
  className?: string
  /** Só quando a imagem diz algo que o texto ao redor não diz. */
  alt?: string
}) {
  return (
    <img
      src={`/emoji/${name}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={cx('shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function EmptyState({
  emoji,
  title,
  children,
  action,
}: {
  emoji: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Emoji name={emoji} size={emoji.startsWith('mascote') ? 96 : 64} className={emoji.startsWith('mascote') ? 'mascot' : undefined} />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------- botões ----------

const BTN = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-sunken active:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-fg active:bg-sunken',
  danger: 'text-bad hover:bg-bad-soft active:bg-bad-soft',
  destructive: 'bg-bad text-white hover:opacity-90',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-9 px-3 text-caption',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-lead',
        BTN[variant],
        className,
      )}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-fg active:bg-sunken disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Bolinha de "pago". */
export function CheckCircle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  // o "pop" só acontece quando a pessoa marca, não quando a lista aparece já marcada
  const [justChanged, setJustChanged] = useState(false)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        setJustChanged(true)
        onChange(!checked)
      }}
      // área de toque maior que o círculo
      className="group -m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <span
        className={cx(
          'flex size-[22px] items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-150 group-active:scale-90',
          checked && justChanged && 'check-pop',
          checked
            ? 'border-good-fill bg-good-fill text-white'
            : 'border-control text-transparent group-hover:border-accent',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
  /** Nome do grupo para leitores de tela, quando não há rótulo visível por perto. */
  label?: string
}) {
  // Grupo de rádio de verdade: Tab entra na opção marcada, setas trocam.
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + dir + options.length) % options.length]
    onChange(next.value)
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons[options.indexOf(next)]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={move} className={cx('flex rounded-xl bg-sunken p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-caption font-semibold transition-colors',
            o.value === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'primary'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-semibold',
        tone === 'neutral' && 'bg-sunken text-muted',
        tone === 'good' && 'bg-good-soft text-good',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'primary' && 'bg-primary-soft text-accent',
      )}
    >
      {children}
    </span>
  )
}

// ---------- formulários ----------

// 16px no texto: abaixo disso o Safari do iPhone dá zoom na página ao focar o campo.
const INPUT =
  'h-11 w-full min-w-0 rounded-xl border border-control bg-surface px-3 text-base text-fg transition-[border-color,box-shadow] placeholder:text-faint hover:border-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:border-line-strong'

/**
 * Rótulo + controle. Com `group`, o conteúdo tem vários controles (botões de
 * escolha, dois selects): vira um grupo nomeado em vez de um <label>, que
 * roubaria o nome e o clique do primeiro controle.
 */
export function Field({
  label,
  hint,
  group,
  children,
}: {
  label: string
  hint?: ReactNode
  group?: boolean
  children: ReactNode
}) {
  const body = (
    <>
      <span className="mb-1.5 block text-caption font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </>
  )
  return group ? (
    <div role="group" aria-label={label}>
      {body}
    </div>
  ) : (
    <label className="block">{body}</label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(INPUT, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(INPUT, 'field', props.className)} />
}

/**
 * Campo de valor no estilo de app de banco: os dígitos entram pelos centavos.
 * O cursor fica sempre no fim — é por lá que se digita e se apaga.
 */
export function MoneyInput({
  cents,
  onChange,
  autoFocus,
  large,
  ariaLabel,
}: {
  cents: number
  onChange: (cents: number) => void
  autoFocus?: boolean
  large?: boolean
  /** Só quando o campo não está dentro de um <Field> com rótulo visível. */
  ariaLabel?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const { int, dec } = splitBRL(cents)
  const value = `${int},${dec}`

  const caretToEnd = () => {
    const el = ref.current
    if (!el || document.activeElement !== el) return
    const end = el.value.length
    // selecionar tudo (Ctrl+A) é permitido: digitar por cima substitui o valor
    if (el.selectionStart === 0 && el.selectionEnd === end) return
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end)
  }
  useLayoutEffect(caretToEnd)

  return (
    <div className="relative">
      <span
        className={cx(
          'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-faint',
          large ? 'text-xl' : 'text-lead',
        )}
      >
        R$
      </span>
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
          onChange(digits ? parseInt(digits, 10) : 0)
        }}
        onFocus={caretToEnd}
        onSelect={caretToEnd}
        className={cx(INPUT, 'tnum font-semibold', large ? 'h-14 pl-12 text-2xl' : 'pl-10')}
      />
    </div>
  )
}

export function DaySelect({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
        <option key={d} value={d}>
          Dia {d}
        </option>
      ))}
    </Select>
  )
}

/** Mês + ano em dois selects (o <input type="month"> não funciona em todo navegador). */
export function MonthSelect({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const { year, index } = monthParts(value)
  const thisYear = new Date().getFullYear()
  const from = Math.min(year, thisYear - 5)
  const to = Math.max(year, thisYear + 15)
  const set = (y: number, i: number) => onChange(`${y}-${String(i + 1).padStart(2, '0')}`)
  return (
    <div className="flex gap-2">
      <Select aria-label="Mês" value={index} onChange={(e) => set(year, Number(e.target.value))}>
        {monthNames.map((n, i) => (
          <option key={n} value={i}>
            {n}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Ano"
        value={year}
        onChange={(e) => set(Number(e.target.value), index)}
        className="!w-28"
      >
        {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-faint">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-control',
        )}
      >
        <span
          className={cx(
            'absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}

// ---------- modal ----------

export function Modal({
  title,
  onClose,
  children,
  footer,
  onSubmit,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  onSubmit?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // Depois que a pessoa mexe em algo, tocar fora não fecha mais: evita perder
  // o que foi digitado por um toque sem querer. Esc, "Cancelar" e o X continuam valendo.
  const touched = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
    return () => el?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onInput={() => (touched.current = true)}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          // clique no fundo escuro (fora do conteúdo)
          if (!touched.current) onClose()
        } else if ((e.target as HTMLElement).closest('.sheet-body button')) {
          touched.current = true
        }
      }}
    >
      <form
        className="sheet-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit?.()
        }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-4">
          <h2 id={titleId} className="truncate text-lg font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          <IconButton label="Fechar" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </header>
        <div className="sheet-body space-y-4 px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </form>
    </dialog>
  )
}

// ---------- confirmação e avisos ----------

/** Ação destrutiva em dois toques: o primeiro pede confirmação no próprio lugar. */
export function ConfirmButton({
  label,
  confirmLabel = 'Excluir?',
  onConfirm,
  children,
}: {
  label: string
  confirmLabel?: string
  onConfirm: () => void
  children: ReactNode
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  return armed ? (
    <Button variant="destructive" size="sm" onClick={onConfirm} onBlur={() => setArmed(false)} autoFocus>
      {confirmLabel}
    </Button>
  ) : (
    <IconButton label={label} onClick={() => setArmed(true)}>
      {children}
    </IconButton>
  )
}

export type ToastData = { message: string; tone: 'error' | 'success' }

export function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const error = toast.tone === 'error'
  return (
    <div
      // erro interrompe o leitor de tela; sucesso espera a vez
      role={error ? 'alert' : 'status'}
      className="fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm animate-[toast-in_0.18s_ease-out] items-center gap-2.5 rounded-2xl bg-fg py-2 pl-3.5 pr-1.5 text-sm font-semibold text-surface shadow-pop lg:bottom-6"
    >
      {error ? <CircleAlert size={18} className="shrink-0" /> : <Check size={18} strokeWidth={3} className="shrink-0" />}
      <span className="min-w-0 flex-1 py-1.5">{toast.message}</span>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={onClose}
        className="flex size-9 shrink-0 items-center justify-center rounded-xl opacity-70 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  )
}
