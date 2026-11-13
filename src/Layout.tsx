import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutGrid,
  Moon,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Sun,
} from 'lucide-react'
import { addMonths } from '../shared/finance.ts'
import { currentMonth, monthNames, monthParts, monthTitle } from './lib/format.ts'
import { Link, usePath } from './router.tsx'
import { useStore } from './store.tsx'
import type { FormSpec } from './store.tsx'
import { Emoji, IconButton, Toast, cx } from './ui.tsx'

const NAV = [
  { href: '/', label: 'Visão geral', short: 'Início', icon: LayoutGrid },
  { href: '/contas', label: 'Contas a pagar', short: 'Contas', icon: ReceiptText },
  { href: '/cartoes', label: 'Cartões', short: 'Cartões', icon: CreditCard },
  { href: '/fluxo', label: 'Fluxo de caixa', short: 'Fluxo', icon: ArrowLeftRight },
  { href: '/reserva', label: 'Reserva', short: 'Reserva', icon: PiggyBank },
]
const SETTINGS_NAV = [
  { href: '/renda', label: 'Minha renda', icon: Banknote },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutGrid; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
        active ? 'bg-sunken font-semibold text-fg' : 'text-muted hover:bg-sunken hover:text-fg',
      )}
    >
      <Icon size={17} className={active ? 'text-accent' : undefined} />
      {label}
    </Link>
  )
}

function ThemeSwitch() {
  const { theme, setTheme } = useStore()
  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-full bg-sunken p-0.5">
      {(
        [
          { id: 'light', label: 'Tema claro', icon: Sun },
          { id: 'dark', label: 'Tema escuro', icon: Moon },
        ] as const
      ).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          aria-label={label}
          title={label}
          onClick={() => setTheme(id)}
          className={cx(
            'flex size-7 items-center justify-center rounded-full transition-colors',
            theme === id ? 'bg-surface text-fg shadow-card' : 'text-faint hover:text-fg',
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}

function Sidebar({ path }: { path: string }) {
  const { state } = useStore()
  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-32px)] w-[232px] shrink-0 flex-col rounded-panel border border-line bg-surface p-3 shadow-card lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2 pb-4 pt-2">
        <Emoji name="mascote" size={40} />
        <span>
          <span className="block text-lead font-semibold leading-tight">Poupin</span>
          <span className="block text-xs text-muted">Minhas finanças</span>
        </span>
      </Link>

      <p aria-hidden className="px-3 pb-1.5 pt-3 text-xs text-faint">Menu</p>
      <nav aria-label="Principal" className="space-y-0.5">
        {NAV.map((n) => (
          <NavItem key={n.href} {...n} active={path === n.href} />
        ))}
      </nav>

      <p aria-hidden className="px-3 pb-1.5 pt-6 text-xs text-faint">Ajustes</p>
      <nav aria-label="Ajustes" className="space-y-0.5">
        {SETTINGS_NAV.map((n) => (
          <NavItem key={n.href} {...n} active={path === n.href} />
        ))}
      </nav>

      <div className="mt-auto">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="flex items-center gap-3 text-sm text-muted">
            <Sun size={16} /> Tema
          </span>
          <ThemeSwitch />
        </div>
        <Link
          href="/ajustes"
          className="flex items-center gap-3 rounded-xl border-t border-line px-2 pb-1 pt-3 hover:text-accent"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-on-primary">
            {initials(state.user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{state.user.name}</span>
            <span className="block truncate text-xs text-muted">{state.user.email}</span>
          </span>
        </Link>
      </div>
    </aside>
  )
}

/** Fecha um popover ao clicar fora ou apertar Esc (devolvendo o foco a quem abriu). */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      ref.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

function AddMenu() {
  const { state, openForm } = useStore()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)

  const items: { label: string; emoji: string; form: FormSpec }[] = [
    { label: 'Conta a pagar', emoji: 'receipt', form: { type: 'entry', kind: 'expense' } },
    { label: 'Renda', emoji: 'banknote', form: { type: 'entry', kind: 'income' } },
    ...(state.cards.length > 0
      ? [{ label: 'Compra no cartão', emoji: 'shopping', form: { type: 'purchase' } as FormSpec }]
      : []),
    { label: 'Cartão de crédito', emoji: 'card', form: { type: 'card' } },
    { label: 'Meta da reserva', emoji: 'target', form: { type: 'goal' } },
  ]

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => openForm({ type: 'entry', kind: 'expense' })}
        aria-label="Adicionar conta a pagar"
        className="flex h-10 items-center gap-1.5 rounded-l-xl bg-primary pl-3.5 pr-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span className="max-sm:sr-only">Adicionar</span>
      </button>
      <button
        type="button"
        aria-label="Escolher o que adicionar"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-r-xl border-l border-white/25 bg-primary text-on-primary transition-colors hover:bg-primary-hover"
      >
        <ChevronDown size={16} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="absolute right-0 top-12 z-30 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {items.map((i) => (
            <li key={i.label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  openForm(i.form)
                }}
                className="flex h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-medium hover:bg-sunken"
              >
                <Emoji name={i.emoji} size={24} />
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Título do mês: abre uma grade de meses pra pular direto, sem ir de seta em seta. */
function MonthPicker() {
  const { month, setMonth } = useStore()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const { year, index } = monthParts(month)
  const [viewYear, setViewYear] = useState(year)
  const now = currentMonth()
  const pick = (m: string) => {
    setMonth(m)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${monthTitle(month)} de ${year}. Escolher outro mês`}
        onClick={() => {
          setViewYear(year)
          setOpen((o) => !o)
        }}
        className="flex max-w-full items-center gap-1.5 rounded-xl px-2 py-1 hover:bg-sunken"
      >
        <span aria-hidden className="truncate text-xl font-semibold tracking-[-0.02em] sm:text-[26px]">
          <span className="sm:hidden">{monthNames[index].slice(0, 3)}</span>
          <span className="max-sm:hidden">{monthTitle(month)}</span> <span className="font-normal text-faint">{year}</span>
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[272px] rounded-2xl border border-line bg-surface p-3 shadow-pop">
          <div className="flex items-center justify-between">
            <IconButton label="Ano anterior" onClick={() => setViewYear((y) => y - 1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <span className="tnum text-lead font-semibold" aria-live="polite">
              {viewYear}
            </span>
            <IconButton label="Próximo ano" onClick={() => setViewYear((y) => y + 1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {monthNames.map((name, i) => {
              const m = `${viewYear}-${String(i + 1).padStart(2, '0')}`
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === month}
                  aria-label={`${name} de ${viewYear}`}
                  onClick={() => pick(m)}
                  className={cx(
                    'h-10 rounded-xl text-sm font-semibold transition-colors',
                    m === month
                      ? 'bg-primary text-on-primary'
                      : m === now
                        ? 'text-accent ring-1 ring-inset ring-accent hover:bg-primary-soft'
                        : 'hover:bg-sunken',
                  )}
                >
                  {name.slice(0, 3)}
                </button>
              )
            })}
          </div>
          {month !== now && (
            <button
              type="button"
              onClick={() => pick(now)}
              className="mt-2 h-10 w-full rounded-xl text-sm font-semibold text-accent hover:bg-primary-soft"
            >
              Voltar pro mês atual
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TopBar({ page }: { page: string }) {
  const { month, setMonth, state } = useStore()
  return (
    <header className="sticky top-0 z-20 -mx-4 flex items-center gap-0.5 border-b border-line bg-surface/90 px-2 py-2 backdrop-blur sm:gap-1 sm:px-3 lg:top-4 lg:mx-0 lg:rounded-panel lg:border lg:px-4 lg:py-3 lg:shadow-card">
      {/* abaixo de 360px as setas saem: o título do mês abre o seletor e faz o mesmo papel */}
      <IconButton label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))} className="max-[359px]:hidden">
        <ChevronLeft size={18} />
      </IconButton>
      <IconButton label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))} className="max-[359px]:hidden">
        <ChevronRight size={18} />
      </IconButton>
      {/* o nome da tela vai no h1 para leitores de tela; visualmente o menu já diz onde você está */}
      <h1 className="sr-only">
        {page}, {monthTitle(month)} de {monthParts(month).year}
      </h1>
      <MonthPicker />
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-1">
        <AddMenu />
        <Link
          href="/ajustes"
          aria-label="Ajustes e minha renda"
          className="flex size-10 items-center justify-center rounded-full bg-primary text-caption font-semibold text-on-primary lg:hidden"
        >
          {initials(state.user.name)}
        </Link>
      </div>
    </header>
  )
}

function BottomNav({ path }: { path: string }) {
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {NAV.map(({ href, short, icon: Icon }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex h-[58px] flex-1 flex-col items-center justify-center gap-1 text-micro font-semibold',
              active ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon size={20} />
            {short}
          </Link>
        )
      })}
    </nav>
  )
}

const PAGE_NAMES: Record<string, string> = Object.fromEntries(
  [...NAV, ...SETTINGS_NAV].map((n) => [n.href, n.label]),
)

export function Layout({ children }: { children: ReactNode }) {
  const path = usePath()
  const { toast, dismissToast } = useStore()
  const page = PAGE_NAMES[path] ?? 'Visão geral'
  const main = useRef<HTMLElement>(null)
  const shownPath = useRef(path)

  useEffect(() => {
    document.title = `${page} · Poupin`
    // ao trocar de tela (não na primeira carga), o foco vai pro conteúdo:
    // teclado e leitor de tela não ficam presos no menu
    if (shownPath.current !== path) {
      shownPath.current = path
      main.current?.focus({ preventScroll: true })
    }
  }, [page, path])

  return (
    <div className="mx-auto flex max-w-[1680px] gap-5 px-4 lg:py-4">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <Sidebar path={path} />
      <div className="min-w-0 flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-4">
        <TopBar page={page} />
        <main id="conteudo" ref={main} tabIndex={-1} className="pt-4 outline-none lg:pt-5">
          {children}
        </main>
      </div>
      <BottomNav path={path} />
      {toast && <Toast toast={toast} onClose={dismissToast} />}
    </div>
  )
}
