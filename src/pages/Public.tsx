// Site público (sem login). Usa as mesmas peças do app (painéis, botões,
// valores, emojis 3D), pra quem chega pelo site já ver o app que vai usar.
// No meio, um mês de exemplo anda dia a dia conforme você rola a página.

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, Check, ChevronDown } from 'lucide-react'
import { brl } from '../lib/format.ts'
import { SITE, orTBD, ownerLine } from '../lib/site.ts'
import { Link } from '../router.tsx'
import { Amount, Badge, Emoji, Money, Panel, cx } from '../ui.tsx'

export type PublicPlan = { price_cents: number; annual_price_cents: number; trial_days: number; billing_enabled: boolean; email_enabled: boolean }

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** Link com cara de botão do app (mesmas cores e cantos do <Button>). */
export const linkButton = (variant: 'primary' | 'secondary' | 'ghost' = 'primary', size: 'md' | 'lg' = 'md') =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-colors',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-lead',
    variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-hover',
    variant === 'secondary' && 'border border-line-strong bg-surface text-fg hover:bg-sunken',
    variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-fg',
  )

/** Liga a classe .in nos blocos .reveal quando eles entram na tela. */
function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = root.current?.querySelectorAll('.reveal') ?? []
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return root
}

/** Moldura das telas públicas: o mesmo fundo e o mesmo tema do app. */
export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="relative min-h-(--app-vh) bg-bg text-fg">{children}</div>
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-xl py-1 pr-2" aria-label={`${SITE.name}: página inicial`}>
      <Emoji name="mascote" size={34} />
      <span className="text-lg font-semibold tracking-[-0.02em]">{SITE.name}</span>
    </Link>
  )
}

function Header({ authenticated, floating, narrow }: { authenticated?: boolean; floating?: boolean; narrow?: boolean }) {
  return (
    <header className={cx('z-30 w-full', floating ? 'fixed top-0 border-b border-line bg-bg/85 backdrop-blur-md' : 'relative')}>
      <div className={cx('mx-auto flex h-16 items-center', narrow ? 'max-w-3xl' : 'max-w-6xl', 'justify-between gap-3 px-4 sm:px-5')}>
        <Logo />
        <nav aria-label="Conta" className="flex items-center gap-2">
          {authenticated ? (
            <Link href="/" className={linkButton('primary')}>
              Abrir o app
            </Link>
          ) : (
            <>
              <Link href="/entrar" className={linkButton('ghost')}>
                Entrar
              </Link>
              <Link href="/criar-conta" className={cx(linkButton('primary'), 'max-[360px]:hidden')}>
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-8 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-caption text-muted">
        <span className="flex items-center gap-2">
          <Emoji name="mascote" size={22} />© {new Date().getFullYear()} {SITE.name}
        </span>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-1 font-medium">
          <Link href="/termos" className="py-1 hover:text-fg">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="py-1 hover:text-fg">
            Privacidade
          </Link>
          {SITE.supportEmail && (
            <a href={`mailto:${SITE.supportEmail}`} className="py-1 hover:text-fg">
              Contato
            </a>
          )}
        </nav>
      </div>
    </footer>
  )
}

/** Título de seção no padrão do site: rótulo pequeno + frase. */
function SectionTitle({ id, kicker, children, center }: { id?: string; kicker: string; children: ReactNode; center?: boolean }) {
  return (
    <div className={cx('reveal', center && 'text-center')}>
      <p className="text-caption font-semibold text-accent">{kicker}</p>
      <h2 id={id} className={cx('mt-2 max-w-2xl text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]', center && 'mx-auto')}>
        {children}
      </h2>
    </div>
  )
}

// ---------- o mês ----------

type Beat = { day: number; label: string; amount: number; say: string; pose: string; emoji: string }

/** Um mês de exemplo. O saldo começa em R$ 320 e os lançamentos somam até o dia 30. */
const START = 32000
const MONTH: Beat[] = [
  { day: 1, label: 'Começa o mês', amount: 0, say: 'Dia 1. Tem R$ 320 na conta e um mês inteiro pela frente.', pose: 'mascote', emoji: 'wallet' },
  { day: 5, label: 'Salário', amount: 450000, say: 'Caiu o salário!', pose: 'mascote-festa', emoji: 'banknote' },
  { day: 6, label: 'Aluguel', amount: -180000, say: 'O aluguel já levou a maior parte.', pose: 'mascote', emoji: 'house' },
  { day: 10, label: 'Luz e internet', amount: -30980, say: 'Luz e internet. Até aqui, normal.', pose: 'mascote', emoji: 'bulb' },
  { day: 12, label: 'Fatura do cartão', amount: -84230, say: 'A fatura veio maior do que você lembrava.', pose: 'mascote-preocupado', emoji: 'card' },
  { day: 15, label: 'Mercado', amount: -43600, say: 'Mercado do mês. Metade do caminho.', pose: 'mascote', emoji: 'cart' },
  { day: 18, label: 'Parcela do notebook', amount: -35000, say: 'Aquela parcela que tinha ficado esquecida.', pose: 'mascote-preocupado', emoji: 'receipt' },
  { day: 20, label: 'Academia', amount: -9990, say: 'Academia, como todo mês.', pose: 'mascote', emoji: 'target' },
  { day: 23, label: 'Farmácia', amount: -28000, say: 'Um imprevisto. Sempre aparece um.', pose: 'mascote-preocupado', emoji: 'pill' },
  { day: 27, label: 'Gasolina', amount: -22000, say: 'Reta final. Será que fecha no azul?', pose: 'mascote-preocupado', emoji: 'car' },
  { day: 30, label: 'Fim do mês', amount: 0, say: 'Fechou. Sobraram R$ 482.', pose: 'mascote-moeda', emoji: 'money-bag' },
]
const LEFTOVER = START + MONTH.reduce((s, b) => s + b.amount, 0)
const DAYS = 30
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
/** O dia 1 cai numa terça neste mês de exemplo. */
const OFFSET = 1

const short = (cents: number): string => {
  const v = Math.abs(cents) / 100
  return `${cents > 0 ? '+' : '−'}${v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : Math.round(v)}`
}

/** A cena fica presa na tela enquanto a rolagem avança os dias. */
function MonthStory() {
  const track = useRef<HTMLDivElement>(null)
  const [day, setDay] = useState(1)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = track.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const span = rect.height - window.innerHeight
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0
      setDay(Math.min(DAYS, 1 + Math.floor(p * DAYS)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const past = MONTH.filter((b) => b.day <= day)
  const beat = past[past.length - 1]
  const balance = START + past.reduce((s, b) => s + b.amount, 0)
  const tense = balance < 80000 && day > 5 && day < DAYS
  const done = day === DAYS
  const byDay = new Map(MONTH.filter((b) => b.amount !== 0).map((b) => [b.day, b]))
  const recent = past.filter((b) => b.amount !== 0).slice(-4).reverse()

  return (
    <section id="mes" ref={track} aria-label="Um mês de exemplo, dia a dia" className="relative" style={{ height: `${DAYS * 22}vh` }}>
      <div className="sticky top-0 flex h-(--app-vh) flex-col overflow-hidden pt-16">
        {/* brilho atrás dos painéis: violeta no caminho, vermelho quando aperta, verde no fim */}
        <div
          aria-hidden
          className={cx(
            'pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] transition-colors duration-700',
            tense ? 'bg-[rgb(239_68_68/0.2)]' : done ? 'bg-[rgb(22_163_74/0.2)]' : 'bg-[rgb(124_58_237/0.16)]',
          )}
        />
        <div className="relative mx-auto grid min-h-0 w-full max-w-6xl flex-1 content-center items-stretch gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-5 lg:grid-cols-[1fr_1fr]">
          {/* o saldo e o que acabou de acontecer */}
          <Panel className="flex min-h-0 flex-col p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0" aria-live="polite">
                <h2 className="flex flex-wrap items-center gap-2 text-lead font-semibold">
                  Na conta
                  <Badge tone={done ? 'good' : tense ? 'bad' : 'primary'}>
                    Dia <span className="tnum">{String(day).padStart(2, '0')}</span> · {beat.label}
                  </Badge>
                </h2>
                <Money cents={balance} size="hero" className={cx('mt-3 sm:mt-4', tense && 'text-bad')} />
                <p
                  key={beat.day}
                  className="pop-in mt-3 inline-block max-w-[22rem] rounded-2xl rounded-bl-md bg-primary-soft px-3 py-1.5 text-caption font-medium leading-snug sm:text-sm"
                >
                  {beat.say}
                </p>
              </div>
              <Emoji
                key={beat.pose}
                name={beat.pose}
                size={96}
                className="mascot pop-in !h-auto !w-[clamp(56px,14vw,96px)] drop-shadow-[0_12px_14px_rgb(0_0_0/0.14)]"
              />
            </div>

            <div className="mt-4 sm:mt-6">
              <div className="flex justify-between text-caption text-muted">
                <span>Avanço do mês</span>
                <span className="tnum">
                  dia {day} de {DAYS}
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${((day - 1) / (DAYS - 1)) * 100}%` }}
                />
              </div>
            </div>

            <ul className="mt-4 hidden min-h-0 divide-y divide-line sm:block" aria-label="Últimos lançamentos">
              {recent.length === 0 && <li className="py-2.5 text-muted">Nenhum lançamento ainda.</li>}
              {recent.map((b) => (
                <li key={b.day} className="flex items-center gap-3 py-2.5">
                  <Emoji name={b.emoji} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium">{b.label}</span>
                  <span className="tnum text-caption text-faint">dia {String(b.day).padStart(2, '0')}</span>
                  <Amount cents={b.amount} className={cx('w-28 text-right', b.amount > 0 ? 'text-good' : 'text-fg')} />
                </li>
              ))}
            </ul>
          </Panel>

          {/* calendário */}
          <Panel className="p-3 sm:p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lead font-semibold">Calendário</h3>
              <span className="text-caption text-muted">entradas e saídas</span>
            </div>
            <div aria-hidden className="mt-3 grid grid-cols-7 gap-1 text-center text-micro font-semibold text-faint sm:gap-1.5">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <ol className="mt-1.5 grid grid-cols-7 gap-1 sm:gap-1.5" aria-hidden>
              {Array.from({ length: OFFSET }, (_, i) => (
                <li key={`v${i}`} />
              ))}
              {Array.from({ length: DAYS }, (_, i) => {
                const d = i + 1
                const ev = byDay.get(d)
                const isPast = d < day
                const today = d === day
                return (
                  <li
                    key={d}
                    className={cx(
                      'relative flex aspect-square flex-col rounded-lg p-1 transition-colors max-sm:aspect-[1/0.78] sm:rounded-xl sm:p-1.5',
                      today ? 'bg-primary text-on-primary' : isPast ? 'bg-sunken text-faint' : 'border border-line bg-surface',
                    )}
                  >
                    <span className="tnum text-micro font-semibold leading-none sm:text-caption">{d}</span>
                    {ev && d <= day && (
                      <span
                        className={cx(
                          'stamp tnum mt-auto rounded-full px-0.5 text-center text-[9px] font-semibold leading-tight sm:py-0.5 sm:text-micro',
                          ev.amount > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad',
                        )}
                      >
                        {short(ev.amount)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </Panel>
        </div>
      </div>
    </section>
  )
}

// ---------- peças visuais do site ----------

/** Barra colorida do "Saldo previsto", a mesma do app: cada cor é um destino do dinheiro. */
const SERIES: { label: string; color: string; value: number }[] = [
  { label: 'Moradia', color: 'var(--s-housing)', value: 348990 },
  { label: 'Contas', color: 'var(--s-bills)', value: 335990 },
  { label: 'Cartões', color: 'var(--s-cards)', value: 242790 },
  { label: 'Reserva', color: 'var(--s-savings)', value: 150000 },
  { label: 'Dia a dia', color: 'var(--s-daily)', value: 150000 },
  { label: 'Sobra', color: 'var(--s-left)', value: 402230 },
]

function SeriesBar({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx('flex h-2.5 gap-[2px] overflow-hidden rounded-full', className)}>
      {SERIES.map((s) => (
        <span key={s.label} style={{ flexGrow: s.value, background: s.color }} className="min-w-[3px] rounded-[2px]" />
      ))}
    </div>
  )
}

/** Cartão de crédito no mesmo desenho do app. */
function MiniCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      style={{ background: 'linear-gradient(135deg, #8a3df2 0%, #5a17c9 100%)' }}
      className={cx('relative flex aspect-[1.6] flex-col justify-between overflow-hidden rounded-2xl p-4 text-white shadow-pop', className)}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgb(255_255_255/0.12)_50%,transparent_60%)]" />
      <span className="relative flex items-start justify-between gap-2">
        <span className="font-semibold">Cartão roxo</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">Aberta</span>
      </span>
      <span className="relative grid h-7 w-9 grid-cols-3 gap-px overflow-hidden rounded-md bg-black/20 p-px">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="bg-white/80" />
        ))}
      </span>
      <span className="relative flex items-end justify-between gap-2">
        <span>
          <span className="block text-[9px] font-semibold tracking-[0.1em] text-white/60">FATURA</span>
          <span className="tnum text-sm font-semibold">R$ 842,30</span>
        </span>
        <span className="text-right">
          <span className="block text-[9px] font-semibold tracking-[0.1em] text-white/60">VENCE</span>
          <span className="tnum text-sm font-semibold">12/12</span>
        </span>
      </span>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[660px] pb-10 pt-6 lg:max-w-none">
      <div aria-hidden className="absolute inset-x-6 inset-y-10 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-pop ring-8 ring-surface/60">
        <img
          src="/tela.webp"
          alt={`Tela de visão geral do ${SITE.name}: saldo previsto, contas a pagar, categorias de gasto e cartões`}
          width={1440}
          height={900}
          className="w-full"
        />
      </div>

      {/* o número que importa, flutuando por cima do print */}
      <div className="float-a absolute -bottom-2 left-2 w-[min(270px,72%)] rounded-2xl border border-line bg-surface p-4 shadow-pop sm:-left-8">
        <p className="text-caption font-semibold text-muted">Saldo previsto</p>
        <p className="tnum mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em]">
          <span className="text-ghost">R$ </span>4.022<span className="text-sm font-medium text-faint">,30</span>
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-caption font-semibold text-good">
          <ArrowUpRight size={14} strokeWidth={2.5} /> 25% da renda livre
        </p>
        <SeriesBar className="mt-3 h-2" />
      </div>

      <div className="float-b absolute -right-2 -top-2 hidden w-[200px] rotate-3 sm:block lg:-right-8">
        <MiniCard />
      </div>

      <div className="float-b absolute -right-1 bottom-0 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface py-2.5 pl-2.5 pr-4 shadow-pop sm:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-good-fill text-white">
          <Check size={16} strokeWidth={3} />
        </span>
        <span>
          <span className="block text-caption font-semibold">Aluguel pago</span>
          <span className="block text-micro text-muted">a sobra foi recalculada</span>
        </span>
      </div>
    </div>
  )
}

/** 30 quadradinhos do mês, com um dia aceso. */
function DayStrip({ lit, tone }: { lit: number; tone: 'dim' | 'bright' }) {
  return (
    <div aria-hidden className="grid grid-cols-10 gap-1.5">
      {Array.from({ length: DAYS }, (_, i) => (
        <span
          key={i}
          className={cx(
            'aspect-square rounded-[5px]',
            i + 1 === lit ? (tone === 'bright' ? 'bg-[#a78bfa] shadow-[0_0_16px_rgb(167_139_250/0.8)]' : 'bg-white/70') : 'bg-white/[0.07]',
          )}
        />
      ))}
    </div>
  )
}

/** Cartão do bento de recursos: título, frase e uma mini tela do app embaixo. */
function Feature({ title, text, emoji, className, children }: { title: string; text: string; emoji: string; className?: string; children: ReactNode }) {
  return (
    <li className={cx('reveal', className)}>
      <Panel className="group flex h-full flex-col overflow-hidden p-5 transition-shadow hover:shadow-pop sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lead font-semibold">{title}</h3>
            <p className="mt-1 max-w-sm text-muted">{text}</p>
          </div>
          <Emoji name={emoji} size={52} className="-mr-1 -mt-1 drop-shadow-[0_8px_10px_rgb(0_0_0/0.12)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
        </div>
        <div className="mt-5 flex flex-1 flex-col justify-end">{children}</div>
      </Panel>
    </li>
  )
}

const FORECAST = [62, 48, 55, -12, 30, 44, 70, 58, 66, 40, 52, 80]
const FORECAST_MONTHS = ['dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov']

function Features() {
  return (
    <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Feature title="Saldo previsto" text="Renda menos contas, cartões e dia a dia. O número que importa, já calculado." emoji="money-bag" className="md:col-span-2">
        <div className="rounded-2xl bg-sunken p-4 sm:p-5">
          <Money cents={402230} size="xl" />
          <SeriesBar className="mt-4" />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-muted">
            {SERIES.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      </Feature>

      <Feature title="Contas por vencimento" text="O que vence em cada dia, o que foi pago e o que atrasou." emoji="calendar">
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {[
            { name: 'Aluguel', value: 'R$ 1.800', paid: true },
            { name: 'Luz', value: 'R$ 189,90', tag: 'hoje' },
            { name: 'Internet', value: 'R$ 119,90', tag: 'dia 15' },
          ].map((r) => (
            <li key={r.name} className="flex items-center gap-2.5 px-3 py-2.5">
              <span
                className={cx(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
                  r.paid ? 'border-good-fill bg-good-fill text-white' : 'border-control',
                )}
              >
                {r.paid && <Check size={12} strokeWidth={3} />}
              </span>
              <span className={cx('flex-1 font-medium', r.paid && 'text-faint line-through')}>{r.name}</span>
              {r.tag && <Badge tone={r.tag === 'hoje' ? 'warn' : 'neutral'}>{r.tag}</Badge>}
              <span className={cx('tnum font-semibold', r.paid && 'text-faint')}>{r.value}</span>
            </li>
          ))}
        </ul>
      </Feature>

      <Feature title="Cartões e parcelas" text="Cada compra na fatura certa, e as próximas faturas antes de chegarem." emoji="card">
        <div className="flex items-end gap-3">
          <MiniCard className="w-[62%] max-w-[220px] transition-transform duration-300 group-hover:-translate-y-1 group-hover:-rotate-2" />
          <div className="min-w-0 flex-1 pb-1 text-caption">
            <p className="text-muted">Notebook</p>
            <p className="font-semibold">parcela 3 de 10</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="h-full w-[30%] rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </Feature>

      <Feature title="Os próximos 12 meses" text="Onde o mês vai apertar, com tempo de se preparar." emoji="chart-up">
        <div className="flex h-28 items-center gap-1.5" aria-hidden>
          {FORECAST.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center">
              <div className="flex w-full flex-1 items-end">
                {v > 0 && <div className="w-full rounded-t-[4px] bg-[var(--s-in)] opacity-80 transition-opacity group-hover:opacity-100" style={{ height: `${v}%` }} />}
              </div>
              <div className="h-px w-full bg-line-strong" />
              <div className="flex w-full flex-[0.35] items-start">
                {v < 0 && <div className="w-full rounded-b-[4px] bg-bad" style={{ height: `${-v * 3}%` }} />}
              </div>
              <span className={cx('text-[9px] leading-none', v < 0 ? 'font-semibold text-bad' : 'text-faint')}>{FORECAST_MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </Feature>

      <Feature title="Reserva com metas" text="Quanto guardar por mês pra chegar no valor que você quer." emoji="target">
        <ul className="space-y-3">
          {[
            { name: 'Reserva de emergência', emoji: 'umbrella', pct: 64, color: 'var(--good-fill)' },
            { name: 'Viagem de férias', emoji: 'plane', pct: 27, color: 'var(--primary)' },
          ].map((g) => (
            <li key={g.name} className="flex items-center gap-3">
              <Emoji name={g.emoji} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-caption">
                  <span className="truncate font-medium">{g.name}</span>
                  <span className="tnum text-muted">{g.pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: g.color }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Feature>
    </ul>
  )
}

const FAQ: [string, string][] = [
  ['O Poupin se conecta ao meu banco?', 'Não. Você mesmo cadastra renda, contas e cartões. O Poupin nunca pede senha de banco nem acesso à sua conta bancária.'],
  [
    'Meus dados ficam seguros?',
    'Seus dados ficam na sua conta, protegida por senha, e a conexão é sempre criptografada. Você pode baixar uma cópia de tudo ou excluir a conta quando quiser, direto nos Ajustes.',
  ],
  ['Preciso de cartão de crédito pra testar?', 'Não. O teste começa quando você cria a conta, sem informar nenhum meio de pagamento.'],
  [
    'E se eu não quiser continuar?',
    'Você não é cobrado. Ao fim do teste a conta fica só para consulta: dá pra ver e exportar tudo, mas não lançar coisas novas, até você assinar ou excluir a conta.',
  ],
  ['Funciona no celular?', 'Funciona. Abre no navegador do celular e do computador, sem instalar nada, com os mesmos dados nos dois.'],
]

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold hover:bg-sunken sm:px-6"
        >
          {q}
          <ChevronDown aria-hidden size={18} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
        </button>
      </h3>
      <p id={id} hidden={!open} className="max-w-2xl px-5 pb-5 text-muted sm:px-6">
        {a}
      </p>
    </div>
  )
}

export function Landing({ plan, authenticated }: { plan: PublicPlan; authenticated?: boolean }) {
  const root = useReveal()
  const start = authenticated ? '/' : '/criar-conta'
  const startLabel = authenticated ? 'Abrir o app' : `Testar grátis por ${plan.trial_days} dias`
  return (
    <PublicShell>
      <div ref={root}>
        <Header authenticated={authenticated} floating />
        <main>
          {/* ---------- abertura ---------- */}
          <section className="relative overflow-hidden">
            <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
            <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
            <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-28 sm:pt-32 lg:min-h-(--app-vh) lg:grid-cols-[1fr_1.1fr] lg:pb-20">
              <div className="hero-in">
                {!authenticated && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pl-1 pr-3 text-caption font-medium shadow-card backdrop-blur">
                    <span className="rounded-full bg-primary px-2 py-0.5 text-micro font-semibold text-on-primary">{plan.trial_days} dias grátis</span>
                    sem cartão de crédito
                  </span>
                )}
                <h1 className="mt-5 text-balance text-[clamp(2.4rem,5vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.04em]">
                  Saiba hoje quanto vai <span className="text-gradient">sobrar</span> no fim do mês.
                </h1>
                <p className="mt-5 max-w-lg text-lg text-muted">
                  O {SITE.name} junta sua renda, suas contas e as faturas dos cartões numa tela só, e refaz a conta a cada coisa que você paga.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={start} className={cx(linkButton('primary', 'lg'), 'shadow-[0_8px_24px_rgb(124_58_237/0.35)]')}>
                    {startLabel} <ArrowRight size={18} />
                  </Link>
                  <a href="#mes" className={linkButton('secondary', 'lg')}>
                    Ver um mês de exemplo
                  </a>
                </div>
                <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-caption text-muted">
                  {['Sem conectar ao banco', 'Celular e computador', 'Cancele quando quiser'].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <Check size={15} strokeWidth={2.5} className="text-good" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <HeroVisual />
            </div>
          </section>

          {/* ---------- o mês de exemplo ---------- */}
          <div className="mx-auto max-w-6xl px-5 pt-10">
            <SectionTitle kicker="Um mês de exemplo">Role a página: cada rolada é um dia do mês.</SectionTitle>
            <p className="reveal mt-3 max-w-xl text-lg text-muted">O salário cai, as contas chegam, e no fim você descobre quanto sobrou.</p>
          </div>
          <MonthStory />

          {/* ---------- a virada: faixa escura ---------- */}
          <section className="relative overflow-hidden bg-[#110d22] text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_80%_20%,rgb(124_58_237/0.35),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgb(236_72_153/0.15),transparent_70%)]" />
            <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
              <div className="reveal">
                <p className="text-caption font-semibold text-[#b79cfb]">A diferença</p>
                <h2 className="mt-2 max-w-3xl text-balance text-[clamp(1.9rem,4.4vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.035em]">
                  Sobraram {brl(LEFTOVER)}. Mas você só descobriu no dia 30.
                </h2>
              </div>
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                <div className="reveal rounded-panel border border-white/10 bg-white/[0.04] p-6 sm:p-7">
                  <p className="text-caption font-semibold text-white/50">Sem planejar</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-white/50">Dia 30</p>
                  <p className="mt-2 max-w-sm text-white/60">Você descobre o que sobrou quando o mês já acabou e não dá mais pra ajustar nada.</p>
                  <div className="mt-6 max-w-xs">
                    <DayStrip lit={30} tone="dim" />
                  </div>
                </div>
                <div
                  className="reveal relative overflow-hidden rounded-panel border border-[#a78bfa]/40 bg-[linear-gradient(160deg,rgb(124_58_237/0.35),rgb(124_58_237/0.08))] p-6 shadow-[0_20px_60px_rgb(124_58_237/0.25)] sm:p-7"
                  style={delay(100)}
                >
                  <Emoji name="mascote-moeda" size={88} className="mascot absolute right-5 top-5 drop-shadow-[0_12px_18px_rgb(0_0_0/0.4)]" />
                  <p className="text-caption font-semibold text-[#c4b5fd]">Com o {SITE.name}</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.03em]">Dia 1</p>
                  <p className="mt-2 max-w-sm pr-16 text-white/75">
                    O saldo previsto aparece no começo do mês e se atualiza a cada conta paga. Dá tempo de cortar, adiar ou guardar.
                  </p>
                  <div className="mt-6 max-w-xs">
                    <DayStrip lit={1} tone="bright" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- o que tem dentro ---------- */}
          <section aria-labelledby="dentro" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <SectionTitle id="dentro" kicker="O que tem dentro">
              Tudo o que mexe no seu mês, num lugar só.
            </SectionTitle>
            <Features />
          </section>

          {/* ---------- preço ---------- */}
          <section id="preco" aria-labelledby="preco-titulo" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-20 sm:pb-24">
            <Panel className="reveal relative grid gap-6 overflow-hidden p-6 sm:p-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative">
                <h2 id="preco-titulo" className="text-caption font-semibold text-accent">
                  Quanto custa
                </h2>
                {plan.billing_enabled ? (
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                    <Money cents={plan.price_cents} size="hero" />
                    <span className="text-lg text-muted">por mês</span>
                  </p>
                ) : (
                  <p className="mt-3 text-[clamp(2.1rem,5vw,3rem)] font-semibold leading-tight tracking-[-0.035em]">
                    <span className="text-gradient">Grátis</span> no lançamento.
                  </p>
                )}
                <p className="mt-3 max-w-lg text-muted">
                  {plan.billing_enabled
                    ? `Ou ${brl(plan.annual_price_cents)} no plano anual, em até 12× no cartão. Os primeiros ${plan.trial_days} dias são grátis, e você paga com cartão ou boleto.`
                    : `A assinatura ainda não foi aberta. Enquanto isso, o uso é gratuito e tem tudo liberado.`}
                </p>
              </div>
              <div className="relative md:text-right">
                <Link href={start} className={linkButton('primary', 'lg')}>
                  {authenticated ? 'Abrir o app' : 'Começar agora'} <ArrowRight size={18} />
                </Link>
              </div>
            </Panel>
          </section>

          {/* ---------- dúvidas ---------- */}
          <section aria-labelledby="duvidas-titulo" className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 sm:pb-24 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <SectionTitle id="duvidas-titulo" kicker="Dúvidas">
                Perguntas frequentes
              </SectionTitle>
              <p className="reveal mt-3 max-w-sm text-muted">
                Não achou a sua?{' '}
                {SITE.supportEmail ? (
                  <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-accent">
                    Escreva pra gente.
                  </a>
                ) : (
                  'Escreva pra gente.'
                )}
              </p>
            </div>
            <Panel className="reveal divide-y divide-line overflow-hidden">
              {FAQ.map(([q, a]) => (
                <Question key={q} q={q} a={a} />
              ))}
            </Panel>
          </section>

          {/* ---------- fecho ---------- */}
          <section className="mx-auto max-w-6xl px-5 pb-10">
            <div className="reveal relative overflow-hidden rounded-panel bg-[linear-gradient(135deg,#7c3aed_0%,#5b21b6_60%,#4c1d95_100%)] px-6 py-14 text-center text-white shadow-[0_24px_60px_rgb(124_58_237/0.3)] sm:py-20">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_60%_at_15%_0%,rgb(255_255_255/0.18),transparent_70%),radial-gradient(35%_55%_at_90%_100%,rgb(236_72_153/0.35),transparent_70%)]" />
              <div className="relative flex flex-col items-center">
                <Emoji name="mascote-festa" size={104} className="mascot drop-shadow-[0_14px_20px_rgb(0_0_0/0.3)]" />
                <h2 className="mt-4 max-w-xl text-balance text-[clamp(2rem,4.4vw,3rem)] font-semibold leading-[1.06] tracking-[-0.035em]">
                  E o seu mês, como termina?
                </h2>
                <p className="mt-3 max-w-md text-white/80">Cadastre renda, contas e cartões em poucos minutos e veja a sobra do mês na hora.</p>
                <Link
                  href={start}
                  className="mt-8 inline-flex h-12 items-center gap-1.5 rounded-xl bg-white px-6 text-lead font-semibold text-[#5b21b6] shadow-[0_8px_24px_rgb(0_0_0/0.2)] transition-transform hover:-translate-y-0.5"
                >
                  {startLabel} <ArrowRight size={18} />
                </Link>
                {!authenticated && <p className="mt-3 text-caption text-white/70">Sem cartão de crédito.</p>}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </PublicShell>
  )
}

// ---------- textos legais ----------

function LegalPage({ title, children, authenticated }: { title: string; children: ReactNode; authenticated?: boolean }) {
  return (
    <PublicShell>
      <Header authenticated={authenticated} narrow />
      <main className="mx-auto max-w-3xl px-4 pb-4 pt-4 sm:px-5">
        <Panel className="p-5 sm:p-8">
          <h1 className="text-[clamp(1.9rem,5vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 text-caption text-muted">Última atualização: {SITE.legalUpdatedAt}</p>
          <div className="mt-7 space-y-7 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_p]:text-muted [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:text-muted">
            {children}
          </div>
        </Panel>
      </main>
      <Footer />
    </PublicShell>
  )
}

const contact = () =>
  SITE.supportEmail ? <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-accent">{SITE.supportEmail}</a> : '[e-mail de contato a definir]'

export function Terms({ plan, authenticated }: { plan: PublicPlan; authenticated?: boolean }) {
  return (
    <LegalPage title="Termos de uso" authenticated={authenticated}>
      <section>
        <h2>1. O serviço</h2>
        <p>
          O {SITE.name} é um aplicativo de organização financeira pessoal oferecido por {ownerLine()} (“nós”). Ele permite cadastrar rendas, contas, cartões de crédito e metas, e calcula
          estimativas a partir do que você informa.
        </p>
        <p>
          O {SITE.name} não é instituição financeira, não movimenta dinheiro, não se conecta a contas bancárias e não presta
          consultoria financeira, contábil ou de investimentos. Os valores mostrados são estimativas e dependem dos dados que
          você cadastra.
        </p>
      </section>
      <section>
        <h2>2. Sua conta</h2>
        <p>
          Para usar o serviço você cria uma conta com nome, e-mail e senha. Você é responsável por manter a senha em sigilo e
          por tudo que for feito na sua conta. É preciso ter 18 anos ou mais, ou a autorização de um responsável.
        </p>
      </section>
      <section>
        <h2>3. Teste grátis e assinatura</h2>
        <p>
          Toda conta nova tem {plan.trial_days} dias de teste gratuito, sem necessidade de informar meio de pagamento. Ao fim
          do teste, para continuar cadastrando e alterando dados é preciso pagar o plano mensal, por meio da Stripe, no
          valor informado na página de preços no momento da contratação.
        </p>
        <p>
          Há duas formas de pagar. No cartão de crédito, a assinatura se renova automaticamente a cada mês até ser cancelada;
          você pode cancelar a qualquer momento nos Ajustes, o acesso continua até o fim do período já pago e não há multa. Por
          boleto, cada pagamento libera 30 dias de uso e não há renovação automática: para continuar, é preciso pagar
          de novo. Sem período pago em vigor, a conta fica disponível apenas para consulta e exportação dos dados.
        </p>
        <p>
          Em contratações feitas pela internet você pode desistir em até 7 dias a contar da contratação, com devolução do
          valor pago, conforme o art. 49 do Código de Defesa do Consumidor. Para isso, fale conosco em {contact()}.
        </p>
        <p>Mudanças de preço serão avisadas com antecedência mínima de 30 dias e só valem para as cobranças seguintes.</p>
      </section>
      <section>
        <h2>4. Uso adequado</h2>
        <ul>
          <li>Não use o serviço para fins ilegais nem tente acessar dados de outras pessoas.</li>
          <li>Não tente burlar limites técnicos, sobrecarregar o serviço ou explorar falhas de segurança.</li>
          <li>Não revenda nem ofereça o serviço a terceiros sem a nossa autorização.</li>
        </ul>
        <p>Contas que descumprirem estes termos podem ser suspensas ou encerradas.</p>
      </section>
      <section>
        <h2>5. Seus dados</h2>
        <p>
          Os dados que você cadastra são seus. Você pode baixar uma cópia ou excluir a conta a qualquer momento nos Ajustes. O
          tratamento de dados pessoais segue a nossa{' '}
          <Link href="/privacidade" className="font-semibold text-accent">
            política de privacidade
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>6. Disponibilidade e responsabilidade</h2>
        <p>
          Trabalhamos para manter o serviço funcionando e os dados íntegros, mas ele é oferecido “como está”, e podem ocorrer
          interrupções, manutenções ou erros. Recomendamos conferir os valores com os documentos originais (faturas, boletos,
          extratos) antes de tomar decisões. Na medida permitida pela lei, não respondemos por prejuízos decorrentes de
          decisões tomadas com base nas estimativas do aplicativo, nem por dados cadastrados incorretamente.
        </p>
      </section>
      <section>
        <h2>7. Mudanças nestes termos</h2>
        <p>
          Podemos atualizar estes termos. Mudanças relevantes serão avisadas dentro do aplicativo ou por e-mail. Continuar
          usando o serviço depois do aviso significa que você concorda com a nova versão.
        </p>
      </section>
      <section>
        <h2>8. Contato e foro</h2>
        <p>
          Dúvidas e solicitações: {contact()}. Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de{' '}
          {orTBD(SITE.jurisdiction)}, sem prejuízo do direito do consumidor de acionar o foro do seu domicílio.
        </p>
      </section>
    </LegalPage>
  )
}

export function Privacy({ authenticated }: { authenticated?: boolean }) {
  return (
    <LegalPage title="Política de privacidade" authenticated={authenticated}>
      <section>
        <h2>1. Quem trata seus dados</h2>
        <p>
          O controlador dos dados pessoais tratados no {SITE.name} é {ownerLine()}. Os encarregados pelo tratamento de
          dados (DPO) são {orTBD(SITE.dpo)}, pelo e-mail {contact()}.
        </p>
      </section>
      <section>
        <h2>2. Quais dados tratamos</h2>
        <ul>
          <li>
            <strong className="text-fg">Cadastro:</strong> nome, e-mail e senha. A senha é guardada apenas em forma de código
            irreversível (hash); não temos como lê-la.
          </li>
          <li>
            <strong className="text-fg">Dados financeiros que você informa:</strong> rendas, contas, cartões (nome, limite,
            dias de fechamento e vencimento e, se você quiser, os 4 últimos dígitos), compras, faturas e metas. Não pedimos
            número completo de cartão, senha de banco nem acesso à sua conta bancária.
          </li>
          <li>
            <strong className="text-fg">Assinatura:</strong> situação do plano e identificadores do cliente e da assinatura na Stripe.
            Os dados de pagamento (cartão, boleto) são informados diretamente à Stripe e não passam por nós.
          </li>
          <li>
            <strong className="text-fg">Dados técnicos:</strong> endereço IP, usado para limitar tentativas de login e proteger
            o serviço, e registros de erro do servidor.
          </li>
        </ul>
      </section>
      <section>
        <h2>3. Para que usamos e com qual base legal</h2>
        <ul>
          <li>Prestar o serviço e manter sua conta: execução do contrato (LGPD, art. 7º, V).</li>
          <li>Cobrar a assinatura: execução do contrato e cumprimento de obrigações legais e fiscais (art. 7º, II e V).</li>
          <li>Segurança, prevenção a fraude e a abuso: legítimo interesse (art. 7º, IX).</li>
          <li>Enviar e-mails necessários ao serviço, como o de recuperação de senha: execução do contrato.</li>
        </ul>
        <p>Não vendemos seus dados e não os usamos para publicidade.</p>
      </section>
      <section>
        <h2>4. Com quem compartilhamos</h2>
        <ul>
          <li>
            <strong className="text-fg">Cloudflare:</strong> hospedagem do aplicativo e do banco de dados.
          </li>
          <li>
            <strong className="text-fg">Stripe:</strong> processamento dos pagamentos da assinatura.
          </li>
          <li>
            <strong className="text-fg">Resend:</strong> envio dos e-mails do serviço.
          </li>
        </ul>
        <p>
          Esses fornecedores tratam os dados apenas para prestar o serviço contratado. Parte deles armazena dados em servidores
          fora do Brasil (o banco de dados fica nos Estados Unidos), o que configura transferência internacional de dados,
          feita com base nas garantias contratuais oferecidas por esses fornecedores (LGPD, art. 33). Também podemos
          compartilhar dados quando a lei ou uma ordem de autoridade competente exigir.
        </p>
      </section>
      <section>
        <h2>5. Cookies e armazenamento no navegador</h2>
        <p>
          Usamos um único cookie, essencial, para manter você conectado. Guardamos no seu navegador a preferência de tema e se
          a configuração inicial já foi vista. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.
        </p>
      </section>
      <section>
        <h2>6. Por quanto tempo guardamos</h2>
        <p>
          Enquanto sua conta existir. Ao excluir a conta nos Ajustes, seus dados cadastrais e financeiros são apagados do banco
          de dados imediatamente. Registros que a lei obrigue a manter (por exemplo, dados fiscais de pagamentos) são guardados
          pelo prazo legal.
        </p>
      </section>
      <section>
        <h2>7. Seus direitos</h2>
        <p>Pela LGPD (art. 18) você pode, a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos ou desatualizados (direto no aplicativo);</li>
          <li>baixar uma cópia dos seus dados (Ajustes → Baixar backup);</li>
          <li>excluir sua conta e seus dados (Ajustes → Excluir conta);</li>
          <li>pedir informações sobre com quem compartilhamos os dados;</li>
          <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
        <p>Para qualquer um desses pedidos, escreva para {contact()}.</p>
      </section>
      <section>
        <h2>8. Segurança</h2>
        <p>
          A conexão com o aplicativo é sempre criptografada (HTTPS), as senhas são guardadas com hash e há limite de
          tentativas de login. Nenhum sistema é totalmente imune a falhas; se houver um incidente de segurança que possa
          causar risco relevante a você, avisaremos você e a ANPD, como a lei determina.
        </p>
      </section>
      <section>
        <h2>9. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política. A data no topo indica a última revisão, e mudanças relevantes serão avisadas dentro
          do aplicativo ou por e-mail.
        </p>
      </section>
    </LegalPage>
  )
}
