// Site público (sem login). A página conta um mês inteiro conforme você rola:
// do dia 1 ao 30, o dinheiro entra, as contas saem e o Poupin reage.
// O visual é o do app (painéis, botões, valores), com um pouco mais de palco.

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowDown, ArrowRight, ChevronDown } from 'lucide-react'
import { brl, splitBRL } from '../lib/format.ts'
import { SITE, orTBD, ownerLine } from '../lib/site.ts'
import { Link } from '../router.tsx'
import { Emoji, Panel, cx } from '../ui.tsx'

export type PublicPlan = { price_cents: number; annual_price_cents: number; trial_days: number; billing_enabled: boolean; email_enabled: boolean }

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** Link com cara de botão do app (mesmas cores e cantos do <Button>). */
export const linkButton = (variant: 'primary' | 'secondary' | 'ghost' = 'primary', size: 'md' | 'lg' = 'md') =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-colors',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-13 px-6 text-lead',
    variant === 'primary' && 'bg-primary text-on-primary shadow-[0_8px_24px_rgb(124_58_237/0.3)] hover:bg-primary-hover',
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

function Header({ authenticated, floating, narrow }: { authenticated?: boolean; floating?: boolean; narrow?: boolean }) {
  return (
    <header className={cx('z-30 w-full', floating ? 'fixed top-0 border-b border-line bg-bg/80 backdrop-blur-md' : 'relative')}>
      <div className={cx('mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-5', narrow ? 'max-w-3xl' : 'max-w-6xl')}>
        <Link href="/" className="flex items-center gap-2 rounded-xl py-1 pr-2" aria-label={`${SITE.name}: página inicial`}>
          <Emoji name="mascote" size={34} />
          <span className="text-lg font-semibold tracking-[-0.02em]">{SITE.name}</span>
        </Link>
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
    <footer className="mx-auto max-w-6xl px-5 pb-8 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-caption text-muted">
        <span className="flex items-center gap-2 font-medium">
          <Emoji name="mascote" size={24} />© {new Date().getFullYear()} {SITE.name}
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

/** Rótulo pequeno em cima das seções. */
const KICKER = 'text-caption font-semibold uppercase tracking-[0.1em] text-accent'

/** Valor grande no padrão do app: "R$" apagado, inteiro forte, centavos menores. */
function BigMoney({ cents, className }: { cents: number; className?: string }) {
  const { neg, int, dec } = splitBRL(cents)
  return (
    <span className={cx('tnum inline-flex items-baseline whitespace-nowrap font-semibold', className)}>
      <span className="mr-[0.15em] text-ghost">
        {neg ? '−' : ''}R$
      </span>
      {int}
      <span className="text-[0.4em] font-medium text-faint">,{dec}</span>
    </span>
  )
}

// ---------- o mês ----------

type Beat = { day: number; label: string; amount: number; say: string; pose: string }

/** Um mês de exemplo. O saldo começa em R$ 320 e os lançamentos somam até o dia 30. */
const START = 32000
const MONTH: Beat[] = [
  { day: 1, label: 'Começa o mês', amount: 0, say: 'Dia 1. Tem R$ 320 na conta e um mês inteiro pela frente.', pose: 'mascote' },
  { day: 5, label: 'Salário', amount: 450000, say: 'Caiu o salário! Rico por algumas horas.', pose: 'mascote-festa' },
  { day: 6, label: 'Aluguel', amount: -180000, say: 'O aluguel já deu a primeira mordida.', pose: 'mascote' },
  { day: 10, label: 'Luz e internet', amount: -30980, say: 'Luz e internet. Até aqui, normal.', pose: 'mascote' },
  { day: 12, label: 'Fatura do cartão', amount: -84230, say: 'A fatura. Sempre maior do que você lembrava.', pose: 'mascote-preocupado' },
  { day: 15, label: 'Mercado', amount: -43600, say: 'Mercado do mês. Metade do caminho.', pose: 'mascote' },
  { day: 18, label: 'Parcela do notebook', amount: -35000, say: 'Aquela parcela que você tinha esquecido.', pose: 'mascote-preocupado' },
  { day: 20, label: 'Academia', amount: -9990, say: 'Academia. Essa pelo menos faz bem.', pose: 'mascote' },
  { day: 23, label: 'Farmácia', amount: -28000, say: 'Imprevisto. Sempre tem um.', pose: 'mascote-preocupado' },
  { day: 27, label: 'Gasolina', amount: -22000, say: 'Reta final. Será que dá?', pose: 'mascote-preocupado' },
  { day: 30, label: 'Fim do mês', amount: 0, say: 'Deu. Sobraram R$ 482. Ufa.', pose: 'mascote-moeda' },
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

/** Número que "corre" até o valor novo. */
function useCount(target: number): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target
      return setShown(target)
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 380)
      const v = Math.round(start + (target - start) * (1 - (1 - p) ** 3))
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
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
  const shown = useCount(balance)
  const tense = balance < 80000 && day > 5 && day < DAYS
  const byDay = new Map(MONTH.filter((b) => b.amount !== 0).map((b) => [b.day, b]))

  return (
    <section ref={track} aria-label="Um mês de exemplo, dia a dia" className="relative" style={{ height: `${DAYS * 26}vh` }}>
      <div className="sticky top-0 flex h-(--app-vh) flex-col overflow-hidden border-y border-line pt-16">
        {/* brilho de fundo: violeta no caminho, vermelho quando aperta, verde no fim */}
        <div
          aria-hidden
          className={cx(
            'pointer-events-none absolute left-1/2 top-1/2 h-[75%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] transition-colors duration-700',
            tense ? 'bg-[rgb(239_68_68/0.2)]' : day === DAYS ? 'bg-[rgb(22_163_74/0.2)]' : 'bg-[rgb(124_58_237/0.18)]',
          )}
        />
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />

        {/* avanço do mês */}
        <div aria-hidden className="absolute inset-x-0 top-16 h-1 bg-line">
          <div
            className="h-full bg-[linear-gradient(90deg,#7c3aed,#c026d3)] transition-[width] duration-200"
            style={{ width: `${((day - 1) / (DAYS - 1)) * 100}%` }}
          />
        </div>

        <div className="relative mx-auto grid min-h-0 w-full max-w-6xl flex-1 items-center gap-x-10 gap-y-3 px-4 pb-4 sm:px-5 lg:grid-cols-[1.05fr_0.95fr]">
          {/* calendário */}
          <Panel className="mx-auto w-full max-w-[560px] p-2.5 shadow-pop sm:p-4 lg:order-2">
            <div aria-hidden className="grid grid-cols-7 gap-1 text-center text-micro font-semibold text-faint sm:gap-1.5">
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
                const done = d < day
                const today = d === day
                return (
                  <li
                    key={d}
                    className={cx(
                      'relative flex aspect-square flex-col rounded-lg p-1 transition-colors max-sm:aspect-[1/0.82] sm:rounded-xl sm:p-1.5',
                      today
                        ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgb(124_58_237/0.4)]'
                        : done
                          ? 'bg-sunken text-faint'
                          : 'border border-line bg-surface',
                    )}
                  >
                    <span className={cx('tnum text-micro font-semibold leading-none sm:text-caption', done && 'line-through')}>{d}</span>
                    {ev && d <= day && (
                      <span
                        className={cx(
                          'stamp tnum mt-auto rounded-full px-0.5 text-center text-[9px] font-semibold leading-tight sm:py-0.5 sm:text-micro',
                          ev.amount > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad',
                          today && 'bg-white/90',
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

          {/* o que está acontecendo */}
          <div className="lg:order-1" aria-live="polite">
            <p className={KICKER}>
              Dia <span className="tnum">{String(day).padStart(2, '0')}</span>
              <span className="text-faint"> · {beat.label}</span>
            </p>
            <p className="mt-1 text-caption font-medium text-muted lg:mt-3">Na conta</p>
            <BigMoney
              cents={shown}
              className={cx('text-[clamp(2.5rem,10vw,5.5rem)] leading-[0.95] tracking-[-0.045em]', tense && 'text-bad')}
            />
            <div className="mt-3 flex items-end gap-3 lg:mt-7">
              <Emoji
                key={beat.pose}
                name={beat.pose}
                size={120}
                className="pop-in !h-auto !w-[clamp(64px,13vw,120px)] shrink-0 drop-shadow-[0_14px_18px_rgb(0_0_0/0.18)]"
              />
              <p
                key={beat.day}
                className="pop-in relative mb-3 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-[15px] font-medium leading-snug shadow-pop sm:text-lg"
              >
                {beat.say}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const INSIDE: [string, string, string][] = [
  ['Saldo previsto', 'Renda menos contas, cartões e dia a dia. O número que importa, já calculado.', 'money-bag'],
  ['Contas por vencimento', 'O que vence em cada dia, o que foi pago e o que atrasou.', 'calendar'],
  ['Cartões e parcelas', 'Cada compra na fatura certa, e as próximas faturas antes de chegarem.', 'card'],
  ['Os próximos 12 meses', 'Onde vai apertar, com tempo de se preparar.', 'chart-up'],
  ['Reserva com metas', 'Quanto guardar por mês pra chegar no valor que você quer.', 'target'],
]

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
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg font-semibold hover:bg-sunken sm:px-6"
        >
          {q}
          <ChevronDown aria-hidden size={20} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
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
          {/* ---------- convite ---------- */}
          <section className="relative overflow-hidden">
            <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
            <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
            <div className="hero-in relative mx-auto flex min-h-(--app-vh) max-w-6xl flex-col justify-center px-5 pb-10 pt-24">
              <Emoji name="mascote-oi" size={150} className="mascot !h-auto !w-[clamp(96px,18vw,150px)] drop-shadow-[0_18px_24px_rgb(124_58_237/0.3)]" />
              <h1 className="mt-5 max-w-4xl text-[clamp(2.75rem,10vw,7rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
                Um mês na vida do seu <span className="text-gradient">dinheiro.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
                Role a página. Cada rolada é um dia: o salário cai, as contas chegam, e no fim você descobre quanto sobrou.
              </p>
              <p className="mt-8">
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-2 text-caption font-semibold uppercase tracking-[0.1em] shadow-card backdrop-blur">
                  <ArrowDown size={16} className="nudge text-accent" /> Começa no dia 1
                </span>
              </p>
            </div>
          </section>

          <MonthStory />

          {/* ---------- a virada ---------- */}
          <section className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-40 top-1/3 size-[36rem] rounded-full bg-primary/15 blur-[120px]" />
            <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
              <p className="reveal text-[clamp(2rem,6.5vw,4.5rem)] font-semibold leading-[1] tracking-[-0.045em]">
                Sobraram {brl(LEFTOVER)}.
                <br />
                <span className="text-faint">Mas você só descobriu no dia 30.</span>
              </p>
              <div className="mt-14 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="reveal">
                  <h2 className="text-[clamp(1.9rem,5vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
                    No {SITE.name}, esse número aparece no <span className="text-gradient">dia 1.</span>
                  </h2>
                  <p className="mt-4 max-w-md text-lg text-muted">
                    Você cadastra o que entra e o que vence. Ele faz a conta do mês inteiro e refaz a cada coisa que você paga.
                  </p>
                  <Link href={start} className={cx(linkButton('primary', 'lg'), 'mt-7')}>
                    {startLabel} <ArrowRight size={20} />
                  </Link>
                  {!authenticated && <p className="mt-3 text-caption text-muted">Sem cartão de crédito.</p>}
                </div>
                <div className="reveal relative" style={delay(100)}>
                  <div aria-hidden className="absolute inset-6 rounded-full bg-primary/30 blur-3xl" />
                  <div className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-pop ring-8 ring-surface/60">
                    <img
                      src="/tela.webp"
                      alt={`Tela de visão geral do ${SITE.name}: saldo previsto, contas a pagar, categorias de gasto e cartões`}
                      width={1440}
                      height={900}
                      loading="lazy"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- o que tem dentro ---------- */}
          <section aria-labelledby="dentro" className="border-y border-line bg-surface">
            <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
              <h2 id="dentro" className={cx('reveal', KICKER)}>
                O que tem dentro
              </h2>
              <ul className="mt-4">
                {INSIDE.map(([title, text, emoji], i) => (
                  <li
                    key={title}
                    className="reveal group grid gap-x-8 gap-y-1 border-t border-line py-6 first:border-t-0 md:grid-cols-[1fr_1fr] md:items-center"
                    style={delay(i * 50)}
                  >
                    <h3 className="flex items-center gap-4 text-[clamp(1.5rem,4vw,2.5rem)] font-semibold leading-tight tracking-[-0.035em]">
                      <Emoji
                        name={emoji}
                        size={56}
                        className="!h-auto !w-[clamp(40px,6vw,56px)] drop-shadow-[0_8px_10px_rgb(0_0_0/0.12)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                      />
                      {title}
                    </h3>
                    <p className="text-lg text-muted md:pl-0 max-md:pl-[calc(clamp(40px,6vw,56px)+1rem)]">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- preço ---------- */}
          <section id="preco" aria-labelledby="preco-titulo" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-24">
            <Panel className="reveal relative grid gap-6 overflow-hidden p-6 shadow-pop sm:p-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative">
                <h2 id="preco-titulo" className={KICKER}>
                  Quanto custa
                </h2>
                {plan.billing_enabled ? (
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
                    <BigMoney cents={plan.price_cents} className="text-[clamp(3.25rem,11vw,6rem)] leading-none tracking-[-0.05em]" />
                    <span className="text-xl font-medium text-muted">por mês</span>
                  </p>
                ) : (
                  <p className="mt-2 text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-none tracking-[-0.045em]">
                    <span className="text-gradient">Grátis</span> no lançamento.
                  </p>
                )}
                <p className="mt-4 max-w-lg text-lg text-muted">
                  {plan.billing_enabled
                    ? `Ou ${brl(plan.annual_price_cents)} no plano anual, em até 12× no cartão. Os primeiros ${plan.trial_days} dias são grátis, e você paga com cartão ou boleto.`
                    : `A assinatura ainda não foi aberta. Enquanto isso, o uso é gratuito e tem tudo liberado.`}
                </p>
              </div>
              <div className="relative md:text-right">
                <Link href={start} className={linkButton('primary', 'lg')}>
                  {authenticated ? 'Abrir o app' : 'Começar agora'} <ArrowRight size={20} />
                </Link>
              </div>
            </Panel>
          </section>

          {/* ---------- dúvidas ---------- */}
          <section aria-labelledby="duvidas-titulo" className="mx-auto max-w-6xl px-5 pb-8">
            <h2 id="duvidas-titulo" className={cx('reveal', KICKER)}>
              Dúvidas
            </h2>
            <Panel className="reveal mt-4 divide-y divide-line overflow-hidden">
              {FAQ.map(([q, a]) => (
                <Question key={q} q={q} a={a} />
              ))}
            </Panel>
          </section>

          {/* ---------- fecho ---------- */}
          <section className="relative overflow-hidden">
            <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
            <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:py-24">
              <Emoji
                name="mascote-moeda"
                size={160}
                className="mascot reveal mx-auto !h-auto !w-[clamp(110px,22vw,160px)] drop-shadow-[0_18px_24px_rgb(124_58_237/0.3)]"
              />
              <h2 className="reveal mx-auto mt-5 max-w-4xl text-[clamp(2.5rem,9vw,6rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
                E o seu mês, <span className="text-gradient">como termina?</span>
              </h2>
              <div className="reveal mt-8" style={delay(80)}>
                <Link href={start} className={linkButton('primary', 'lg')}>
                  {startLabel} <ArrowRight size={20} />
                </Link>
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
