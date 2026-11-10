import { useEffect, useRef, useState } from 'react'
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
import { currentMonth, monthParts, monthTitle } from './lib/format.ts'
import { Link, usePath } from './router.tsx'
import { useStore } from './store.tsx'
import type { FormSpec } from './store.tsx'
import { Emoji, IconButton, cx } from './ui.tsx'

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
      <Icon size={17} className={active ? 'text-primary' : undefined} />
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
    <aside className="sticky top-4 hidden h-[calc(100dvh-32px)] w-[232px] shrink-0 flex-col rounded-[20px] border border-line bg-surface p-3 shadow-card lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2 pb-4 pt-2">
        <Emoji name="money-bag" size={34} />
        <span>
          <span className="block text-[15px] font-semibold leading-tight">Gestor</span>
          <span className="block text-xs text-muted">Minhas finanças</span>
        </span>
      </Link>

      <p className="px-3 pb-1.5 pt-3 text-xs text-faint">Menu</p>
      <nav className="space-y-0.5">
        {NAV.map((n) => (
          <NavItem key={n.href} {...n} active={path === n.href} />
        ))}
      </nav>

      <p className="px-3 pb-1.5 pt-6 text-xs text-faint">Ajustes</p>
      <nav className="space-y-0.5">
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
          className="flex items-center gap-3 rounded-xl border-t border-line px-2 pb-1 pt-3 hover:text-primary"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-on-primary">
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

function AddMenu() {
  const { state, openForm } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

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
        className="flex h-10 items-center gap-1.5 rounded-l-xl bg-primary pl-3.5 pr-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span className="max-sm:sr-only">Adicionar</span>
      </button>
      <button
        type="button"
        aria-label="Mais opções para adicionar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-9 items-center justify-center rounded-r-xl border-l border-white/25 bg-primary text-on-primary transition-colors hover:bg-primary-hover"
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
        >
          {items.map((i) => (
            <button
              key={i.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                openForm(i.form)
              }}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-medium hover:bg-sunken"
            >
              <Emoji name={i.emoji} size={24} />
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TopBar() {
  const { month, setMonth, state } = useStore()
  const { year } = monthParts(month)
  const isNow = month === currentMonth()
  return (
    <header className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur sm:gap-2 lg:top-4 lg:mx-0 lg:rounded-[20px] lg:border lg:px-4 lg:py-3 lg:shadow-card">
      <IconButton label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
        <ChevronLeft size={18} />
      </IconButton>
      <IconButton label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
        <ChevronRight size={18} />
      </IconButton>
      <h1 className="ml-1 truncate text-xl font-semibold tracking-[-0.02em] sm:text-[26px]">
        {monthTitle(month)} <span className="font-normal text-faint">{year}</span>
      </h1>
      {!isNow && (
        <button
          type="button"
          onClick={() => setMonth(currentMonth())}
          className="ml-1 hidden h-8 rounded-lg px-2.5 text-[13px] font-semibold text-primary hover:bg-primary-soft sm:block"
        >
          Voltar pra hoje
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <AddMenu />
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="flex size-10 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-on-primary lg:hidden"
        >
          {initials(state.user.name)}
        </Link>
      </div>
    </header>
  )
}

function BottomNav({ path }: { path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {NAV.map(({ href, short, icon: Icon }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex h-[58px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold',
              active ? 'text-primary' : 'text-faint',
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

export function Layout({ children }: { children: ReactNode }) {
  const path = usePath()
  const { toast } = useStore()
  return (
    <div className="mx-auto flex max-w-[1680px] gap-5 px-4 lg:py-4">
      <Sidebar path={path} />
      <div className="min-w-0 flex-1 pb-24 lg:pb-4">
        <TopBar />
        <main className="pt-4 lg:pt-5">{children}</main>
      </div>
      <BottomNav path={path} />
      {toast && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm rounded-2xl bg-fg px-4 py-3 text-center text-sm font-semibold text-surface shadow-pop lg:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
