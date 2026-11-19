// Site público (sem login). Uma tela só: um mês de exemplo que dá pra mexer,
// e o Poupin andando por ela, explicando cada parte e reagindo ao que você faz.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { ArrowDown, ArrowRight, Check, Plus } from 'lucide-react'
import { brl, brlRound, splitBRL } from '../lib/format.ts'
import { SITE, orTBD, ownerLine } from '../lib/site.ts'
import { Link } from '../router.tsx'
import { Emoji, Panel, cx } from '../ui.tsx'

export type PublicPlan = { price_cents: number; annual_price_cents: number; trial_days: number; billing_enabled: boolean; email_enabled: boolean }

/** Link com cara de botão do app (mesmas cores e cantos do <Button>). */
export const linkButton = (variant: 'primary' | 'secondary' | 'ghost' = 'primary', size: 'md' | 'lg' = 'md') =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-colors',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-lead',
    variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-hover',
    variant === 'secondary' && 'border border-line-strong bg-surface text-fg hover:bg-sunken',
    variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-fg',
  )

/** Moldura das telas públicas: o mesmo fundo e o mesmo tema do app. */
export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="relative min-h-(--app-vh) bg-bg text-fg">{children}</div>
}

function Header({ authenticated, narrow }: { authenticated?: boolean; narrow?: boolean }) {
  return (
    <header className="relative z-30 w-full">
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
    <footer className="mx-auto max-w-6xl px-5 pb-8 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-caption text-muted">
        <span className="flex items-center gap-2 font-medium">
          <Emoji name="mascote" size={22} />© {new Date().getFullYear()} {SITE.name}
        </span>
        <FooterLinks />
      </div>
    </footer>
  )
}

function FooterLinks({ children, compact }: { children?: ReactNode; compact?: boolean }) {
  return (
    <nav aria-label="Rodapé" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-caption font-medium text-muted">
      {children}
      <Link href="/termos" className="py-1 hover:text-fg">
        Termos de uso
      </Link>
      <Link href="/privacidade" className="py-1 hover:text-fg">
        Privacidade
      </Link>
      {SITE.supportEmail && !compact && (
        <a href={`mailto:${SITE.supportEmail}`} className="py-1 hover:text-fg">
          Contato
        </a>
      )}
    </nav>
  )
}

// ---------- o mês de exemplo ----------

type Item = { id: string; name: string; cents: number; emoji: string; day?: number; note?: string; on: boolean }

const BILLS: Item[] = [
  { id: 'aluguel', name: 'Aluguel', cents: 180000, emoji: 'house', day: 5, on: true },
  { id: 'luz', name: 'Luz', cents: 18990, emoji: 'bulb', day: 10, on: true },
  { id: 'internet', name: 'Internet', cents: 11990, emoji: 'phone', day: 10, on: true },
  { id: 'mercado', name: 'Mercado', cents: 43600, emoji: 'cart', day: 15, on: true },
  { id: 'academia', name: 'Academia', cents: 9990, emoji: 'target', day: 20, on: true },
  { id: 'gasolina', name: 'Gasolina', cents: 22000, emoji: 'car', day: 27, on: true },
  { id: 'farmacia', name: 'Farmácia', cents: 28000, emoji: 'pill', day: 23, on: false },
]

const PURCHASES: Item[] = [
  { id: 'notebook', name: 'Notebook', note: 'parcela 3 de 10', cents: 35000, emoji: 'receipt', on: true },
  { id: 'streaming', name: 'Streaming', note: 'assinatura', cents: 5590, emoji: 'tv', on: true },
  { id: 'delivery', name: 'Delivery', note: 'no mês', cents: 32000, emoji: 'food', on: true },
  { id: 'viagem', name: 'Passagem', note: 'parcela 1 de 6', cents: 60000, emoji: 'plane', on: false },
]

type Mood = { pose: string; tone: 'bad' | 'warn' | 'ok' | 'good' }

const moodOf = (income: number, left: number): Mood => {
  if (income <= 0) return { pose: 'mascote-dormindo', tone: 'warn' }
  const r = left / income
  if (left < 0) return { pose: 'mascote-preocupado', tone: 'bad' }
  if (r < 0.08) return { pose: 'mascote-preocupado', tone: 'warn' }
  if (r < 0.2) return { pose: 'mascote', tone: 'ok' }
  if (r < 0.35) return { pose: 'mascote-festa', tone: 'good' }
  return { pose: 'mascote-moeda', tone: 'good' }
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
      const p = Math.min(1, (now - t0) / 420)
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

function useDesktop() {
  const q = '(min-width: 1024px)'
  const [on, setOn] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return on
}

// ---------- o Poupin ----------

type Spot = 'hero' | 'salary' | 'bills' | 'card' | 'left' | 'cta' | 'faq'

type Line = {
  spot: Spot
  pose: string
  text: ReactNode
  /** Botões dentro do balão. */
  actions?: ReactNode
}

const MASCOT = 132

/**
 * Onde o Poupin para em cada parte, e pra que lado abre o balão: sempre pro
 * lado de fora do card que ele está explicando, pra não cobrir o que importa.
 */
const SPOTS: Record<Spot, { corner: 'tr' | 'tl' | 'present' | 'above'; side: 'left' | 'right'; up?: boolean; big?: boolean }> = {
  hero: { corner: 'present', side: 'right', up: true, big: true },
  left: { corner: 'tr', side: 'right' },
  salary: { corner: 'tr', side: 'right' },
  card: { corner: 'tr', side: 'right' },
  bills: { corner: 'tl', side: 'left' },
  cta: { corner: 'above', side: 'right', up: true },
  faq: { corner: 'above', side: 'left', up: true },
}

function anchor(spot: Spot, r: DOMRect, stage: DOMRect): { x: number; y: number } {
  const x = r.left - stage.left
  const y = r.top - stage.top
  const c = SPOTS[spot].corner
  // na abertura ele fica grande, na frente do canto de baixo do print, apresentando o app
  if (c === 'present') return { x: x - MASCOT * 0.15, y: y + r.height - MASCOT * 0.9 }
  if (c === 'above') return { x: x + r.width - MASCOT * 0.9, y: y - MASCOT + 26 }
  if (c === 'tl') return { x: x - MASCOT * 0.8, y: y - MASCOT * 0.74 }
  return { x: x + r.width - MASCOT * 0.72, y: y - MASCOT * 0.56 }
}

function Walker({
  stage,
  targets,
  line,
  desktop,
}: {
  stage: RefObject<HTMLDivElement | null>
  targets: Record<Spot, RefObject<HTMLElement | null>>
  line: Line
  desktop: boolean
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [walking, setWalking] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [duration, setDuration] = useState(1.1)
  const last = useRef<{ x: number; y: number } | null>(null)
  const entered = useRef(false)

  const place = useCallback(() => {
    const s = stage.current?.getBoundingClientRect()
    const t = targets[line.spot].current?.getBoundingClientRect()
    if (!s || !t) return
    const p = anchor(line.spot, t, s)
    p.x = Math.max(0, Math.min(s.width - MASCOT, p.x))
    p.y = Math.max(0, p.y)
    // na primeira vez ele entra andando pela esquerda
    if (!last.current && !entered.current) {
      entered.current = true
      last.current = { x: 0, y: p.y }
      setPos(last.current)
      requestAnimationFrame(() => requestAnimationFrame(() => place()))
      return
    }
    const prev = last.current
    if (prev && (Math.abs(prev.x - p.x) > 4 || Math.abs(prev.y - p.y) > 4)) {
      // caminho longo (descer da abertura pro mês) leva mais tempo
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y)
      setDuration(Math.min(1.9, Math.max(0.9, dist / 650)))
      if (Math.abs(p.x - prev.x) > 20) setFacingLeft(p.x < prev.x)
      setWalking(true)
    }
    last.current = p
    setPos(p)
  }, [stage, targets, line.spot])

  useLayoutEffect(() => {
    if (desktop) place()
  }, [desktop, place])

  useEffect(() => {
    if (!desktop) return
    const onResize = () => {
      last.current = null
      place()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [desktop, place])

  // no celular ele fica no canto e a tela rola até a parte que ele está explicando
  useEffect(() => {
    if (desktop || line.spot === 'hero') return
    targets[line.spot].current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [desktop, line.spot, targets])

  const bubble = (
    <div
      key={String(line.spot) + String(typeof line.text === 'string' ? line.text : '')}
      role="status"
      aria-live="polite"
      className="bubble-in rounded-2xl border border-line bg-surface p-4 text-[15px] leading-snug shadow-pop"
    >
      <div className="font-medium">{line.text}</div>
      {line.actions && <div className="mt-3 flex flex-wrap items-center gap-2">{line.actions}</div>}
    </div>
  )

  const body = (
    <div className={cx('relative', facingLeft && '-scale-x-100')}>
      <span aria-hidden className="absolute inset-x-5 bottom-1 h-3 rounded-full bg-black/15 blur-[6px]" />
      <div
        className="origin-bottom transition-transform duration-700"
        style={{ transform: desktop && SPOTS[line.spot].big ? 'scale(1.55)' : undefined }}
      >
        <div className={cx(walking && 'waddle')}>
          <Emoji key={line.pose} name={line.pose} size={MASCOT} alt="Poupin" className="pose-in relative drop-shadow-[0_10px_14px_rgb(0_0_0/0.18)]" />
        </div>
      </div>
    </div>
  )

  if (!desktop)
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end gap-1 px-3 pb-3">
        <div className="pointer-events-auto min-w-0 flex-1 pb-2">{bubble}</div>
        <div className="w-[92px] shrink-0 [&_img]:!h-auto [&_img]:!w-[92px]">{body}</div>
      </div>
    )

  if (!pos) return null
  const cfg = SPOTS[line.spot]
  const bubbleOnLeft = cfg.side === 'left' ? pos.x > 300 : pos.x > (stage.current?.clientWidth ?? 0) - MASCOT - 300
  return (
    <div
      className="walker pointer-events-none absolute left-0 top-0 z-40"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transitionDuration: `${duration}s`, width: MASCOT, height: MASCOT }}
      onTransitionEnd={() => setWalking(false)}
    >
      {body}
      <div
        className={cx(
          'pointer-events-auto absolute w-[300px]',
          cfg.big ? 'bottom-[150px] left-[60%] w-[330px]' : cfg.up ? 'bottom-6' : 'top-2',
          !cfg.big && (bubbleOnLeft ? 'right-[calc(100%-8px)]' : 'left-[calc(100%-8px)]'),
        )}
      >
        {bubble}
      </div>
    </div>
  )
}

// ---------- peças da tela ----------

function Toggle({ item, onToggle }: { item: Item; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.on}
        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sunken"
      >
        <span
          className={cx(
            'flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
            item.on ? 'border-primary bg-primary text-on-primary' : 'border-control text-transparent group-hover:text-faint',
          )}
        >
          {item.on ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
        </span>
        <Emoji name={item.emoji} size={26} className={cx('transition-opacity', !item.on && 'opacity-40 grayscale')} />
        <span className={cx('min-w-0 flex-1', !item.on && 'text-faint')}>
          <span className="block truncate font-medium">{item.name}</span>
          {(item.note || item.day) && (
            <span className="block text-micro text-faint">{item.note ?? `vence dia ${String(item.day).padStart(2, '0')}`}</span>
          )}
        </span>
        <span className={cx('tnum font-semibold', !item.on && 'text-faint line-through')}>{brl(item.cents)}</span>
      </button>
    </li>
  )
}

function bigMoney(cents: number) {
  const { neg, int, dec } = splitBRL(cents)
  return (
    <>
      <span className="mr-[0.15em] text-ghost">{neg ? '−' : ''}R$</span>
      {int}
      <span className="text-[0.38em] font-medium text-faint">,{dec}</span>
    </>
  )
}

const FAQ: [string, string][] = [
  ['Ele se conecta ao meu banco?', 'Não. Você mesmo cadastra renda, contas e cartões. Eu nunca peço senha de banco nem acesso à sua conta.'],
  ['Meus dados ficam seguros?', 'Ficam na sua conta, protegida por senha, com conexão criptografada. Dá pra baixar uma cópia ou excluir tudo quando quiser, nos Ajustes.'],
  ['Preciso de cartão pra testar?', 'Não. O teste começa quando você cria a conta, sem nenhum meio de pagamento.'],
  ['E se eu não quiser continuar?', 'Você não é cobrado. A conta fica só pra consulta: dá pra ver e exportar tudo, mas não lançar coisa nova.'],
  ['Funciona no celular?', 'Funciona. Abre no navegador do celular e do computador, com os mesmos dados nos dois.'],
]

export function Landing({ plan, authenticated }: { plan: PublicPlan; authenticated?: boolean }) {
  const desktop = useDesktop()
  const start = authenticated ? '/' : '/criar-conta'
  const offer = plan.billing_enabled
    ? `${plan.trial_days} dias grátis, sem cartão. Depois, ${brl(plan.price_cents)} por mês.`
    : 'De graça no lançamento, com tudo liberado.'

  const [salary, setSalary] = useState(450000)
  const [bills, setBills] = useState(BILLS)
  const [buys, setBuys] = useState(PURCHASES)
  const billsTotal = bills.reduce((s, b) => s + (b.on ? b.cents : 0), 0)
  const cardTotal = buys.reduce((s, b) => s + (b.on ? b.cents : 0), 0)
  const left = salary - billsTotal - cardTotal
  const shownLeft = useCount(left)
  const mood = moodOf(salary, left)

  const stage = useRef<HTMLDivElement>(null)
  const targets = {
    hero: useRef<HTMLElement>(null),
    salary: useRef<HTMLElement>(null),
    bills: useRef<HTMLElement>(null),
    card: useRef<HTMLElement>(null),
    left: useRef<HTMLElement>(null),
    cta: useRef<HTMLElement>(null),
    faq: useRef<HTMLElement>(null),
  }

  // ---- o roteiro do passeio ----
  const demo = useRef<HTMLElement>(null)
  const [step, setStep] = useState(0)
  const [intro, setIntro] = useState(0)
  const [reaction, setReaction] = useState<Line | null>(null)
  const touring = step < 6
  const next = () => {
    setReaction(null)
    setStep((s) => s + 1)
  }
  const skip = () => {
    setReaction(null)
    setStep(6)
  }
  /** Sai da abertura: a tela desce até o mês e ele vai junto. */
  const goDown = () => {
    setReaction(null)
    setStep((s) => Math.max(s, 1))
    demo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const replay = () => {
    setReaction(null)
    setIntro(0)
    setStep(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // a apresentação anda sozinha, uma fala a cada poucos segundos
  useEffect(() => {
    if (step !== 0 || intro >= 2) return
    const t = window.setTimeout(() => setIntro((i) => i + 1), intro === 0 ? 3800 : 4600)
    return () => window.clearTimeout(t)
  }, [step, intro])

  // se a pessoa rolar por conta própria até o mês, o passeio começa
  useEffect(() => {
    const el = demo.current
    if (!el || step !== 0) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStep(1), { threshold: 0.45 })
    io.observe(el)
    return () => io.disconnect()
  }, [step])

  const nextBtn = (label = 'Continuar') => (
    <>
      <button type="button" onClick={next} className={cx(linkButton('primary'), 'h-9 px-3.5')}>
        {label} <ArrowRight size={16} />
      </button>
      {step > 0 && step < 5 && (
        <button type="button" onClick={skip} className="h-9 px-2 text-caption font-medium text-muted hover:text-fg">
          Pular
        </button>
      )}
    </>
  )

  const leftText = left < 0 ? `falta ${brl(-left)}` : `sobram ${brl(left)}`
  const script: Line[] = [
    ([
      {
        spot: 'hero',
        pose: 'mascote-oi',
        text: `Oi! Eu sou o ${SITE.name}. Esse aqui é o app onde eu cuido do mês do seu dinheiro.`,
      },
      {
        spot: 'hero',
        pose: 'mascote-moeda',
        text: 'Eu junto o que entra, as contas e o cartão, e te conto quanto vai sobrar. Logo no dia 1, não no dia 30.',
      },
      {
        spot: 'hero',
        pose: 'mascote-festa',
        text: 'Quer ver funcionando? Desce comigo que eu te mostro.',
        actions: (
          <button type="button" onClick={goDown} className={cx(linkButton('primary'), 'h-9 px-3.5')}>
            Bora <ArrowDown size={16} />
          </button>
        ),
      },
    ] satisfies Line[])[intro],
    {
      spot: 'salary',
      pose: 'mascote-moeda',
      text: 'Tudo começa pelo que entra. Arrasta aí e coloca um salário parecido com o seu.',
      actions: nextBtn(),
    },
    {
      spot: 'bills',
      pose: 'mascote',
      text: 'Essas são as contas do mês, na ordem em que vencem. Toca numa pra tirar ou pôr de volta.',
      actions: nextBtn(),
    },
    {
      spot: 'card',
      pose: 'mascote-preocupado',
      text: 'O cartão eu separo compra por compra, parcela por parcela. A fatura não pega ninguém de surpresa.',
      actions: nextBtn(),
    },
    {
      spot: 'left',
      pose: mood.pose,
      text: (
        <>
          E esse é o número que importa: com esse mês, <strong>{leftText}</strong>. Você vê isso no dia 1, não no dia 30.
        </>
      ),
      actions: nextBtn(),
    },
    {
      spot: 'cta',
      pose: 'mascote-festa',
      text: `Gostou? Bora montar o seu mês de verdade. ${offer}`,
      actions: (
        <>
          <Link href={start} className={cx(linkButton('primary'), 'h-9 px-3.5')}>
            {authenticated ? 'Abrir o app' : 'Criar minha conta'} <ArrowRight size={16} />
          </Link>
          <button type="button" onClick={skip} className="h-9 px-2 text-caption font-medium text-muted hover:text-fg">
            Quero mexer mais
          </button>
        </>
      ),
    },
  ]
  const idle: Line = {
    spot: 'left',
    pose: mood.pose,
    text: left < 0 ? 'No vermelho. Tira alguma coisa ou aumenta o salário pra ver o que muda.' : 'Pode mexer à vontade, eu refaço a conta na hora.',
  }
  const line = reaction ?? (touring ? script[step] : idle)

  // ---- reações ----
  const timer = useRef(0)
  const react = (l: Line, keep = 4200) => {
    window.clearTimeout(timer.current)
    setReaction(
      touring
        ? {
            ...l,
            actions: (
              <button type="button" onClick={() => setReaction(null)} className={cx(linkButton('secondary'), 'h-9 px-3')}>
                Continuar o passeio <ArrowRight size={16} />
              </button>
            ),
          }
        : l,
    )
    timer.current = window.setTimeout(() => setReaction(null), keep)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const toggle = (list: 'bills' | 'card', id: string) => {
    const items = list === 'bills' ? bills : buys
    const item = items.find((i) => i.id === id)
    if (!item) return
    const after = left + (item.on ? item.cents : -item.cents)
    const m = moodOf(salary, after)
    const set = list === 'bills' ? setBills : setBuys
    set(items.map((i) => (i.id === id ? { ...i, on: !i.on } : i)))
    if (item.on)
      react({
        spot: list,
        pose: after >= 0 ? (m.pose === 'mascote-preocupado' ? 'mascote' : 'mascote-festa') : 'mascote-preocupado',
        text:
          after >= 0 && left < 0
            ? `Ufa! Sem ${item.name.toLowerCase()} o mês volta pro azul.`
            : `Sem ${item.name.toLowerCase()}, sobram mais ${brl(item.cents)}. Agora fica em ${brl(after)}.`,
      })
    else
      react({
        spot: list,
        pose: after < 0 ? 'mascote-preocupado' : m.pose === 'mascote-preocupado' ? 'mascote-preocupado' : 'mascote',
        text:
          after < 0 && left >= 0
            ? `Ih! Com ${item.name.toLowerCase()}, o mês fecha no vermelho: falta ${brl(-after)}.`
            : `${item.name} entrou: lá se vão ${brl(item.cents)}. Sobra ${after < 0 ? `negativa de ${brl(-after)}` : brl(after)}.`,
      })
  }

  const salaryTimer = useRef(0)
  const changeSalary = (v: number) => {
    setSalary(v)
    window.clearTimeout(salaryTimer.current)
    salaryTimer.current = window.setTimeout(() => {
      const l = v - billsTotal - cardTotal
      const m = moodOf(v, l)
      react({
        spot: 'salary',
        pose: m.pose,
        text:
          l < 0
            ? `Com ${brlRound(v)} entrando, faltam ${brl(-l)} no fim do mês. Melhor saber agora, né?`
            : m.tone === 'good'
              ? `Com ${brlRound(v)}, sobram ${brl(l)}. Dá até pra guardar um pouco!`
              : `Com ${brlRound(v)}, sobram ${brl(l)}. Apertadinho, mas fecha.`,
      })
    }, 350)
  }

  const askFaq = () => {
    window.clearTimeout(timer.current)
    setReaction({
      spot: 'faq',
      pose: 'mascote-oi',
      text: 'Pode perguntar! O que você quer saber?',
      actions: FAQ.map(([q, a]) => (
        <button
          key={q}
          type="button"
          onClick={() => {
            window.clearTimeout(timer.current)
            setReaction({
              spot: 'faq',
              pose: 'mascote',
              text: a,
              actions: (
                <>
                  <button type="button" onClick={askFaq} className={cx(linkButton('secondary'), 'h-9 px-3')}>
                    Outra dúvida
                  </button>
                  <button type="button" onClick={() => setReaction(null)} className="h-9 px-2 text-caption font-medium text-muted hover:text-fg">
                    Fechar
                  </button>
                </>
              ),
            })
          }}
          className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-caption font-medium hover:border-primary hover:text-accent"
        >
          {q}
        </button>
      )),
    })
  }

  // o card em foco fica aceso; os outros apagam um pouco durante o passeio
  const focus = (s: Spot) =>
    cx(
      'transition-[opacity,box-shadow,transform] duration-500',
      touring && !reaction && line.spot !== s && desktop && 'opacity-45',
      line.spot === s && 'ring-2 ring-primary/70 shadow-pop',
    )

  const tone = { bad: 'text-bad', warn: 'text-warn', ok: 'text-fg', good: 'text-good' }[mood.tone]
  const pct = salary > 0 ? Math.round((left / salary) * 100) : 0

  return (
    <PublicShell>
      <div ref={stage} className="relative overflow-x-clip">
        {/* ---------- abertura: o Poupin apresenta o app ---------- */}
        <section className="relative flex min-h-(--app-vh) flex-col overflow-hidden">
          <div aria-hidden className="intro-glow pointer-events-none absolute inset-0" />
          <Header authenticated={authenticated} />
          <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-20 pt-4 lg:grid-cols-[0.85fr_1.15fr] lg:pb-24">
            <div>
              <h1 className="text-balance text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1.03] tracking-[-0.04em]">
                O mês do seu dinheiro, <span className="text-accent">numa tela só.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg text-muted">
                Renda, contas e cartões juntos. Você sabe quanto vai sobrar no fim do mês logo no dia 1.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={goDown} className={linkButton('primary', 'lg')}>
                  Me mostra como funciona <ArrowDown size={18} />
                </button>
                <Link href={start} className={linkButton('secondary', 'lg')}>
                  {authenticated ? 'Abrir o app' : 'Criar conta'}
                </Link>
              </div>
              <p className="mt-4 text-caption text-muted">{offer}</p>
            </div>
            <div ref={targets.hero as RefObject<HTMLDivElement | null>} className="relative">
              <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-pop ring-8 ring-surface/60 lg:[transform:perspective(1600px)_rotateY(-9deg)_rotateX(3deg)]">
                <img src="/tela.webp" alt={`Tela de visão geral do ${SITE.name}`} width={1440} height={900} className="w-full" />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={goDown}
            className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-caption font-medium text-muted hover:text-fg"
          >
            role pra ver
            <ArrowDown size={18} className="nudge" />
          </button>
        </section>

        {/* ---------- o mês de exemplo, onde ele mostra cada parte ---------- */}
        <main ref={demo} className="relative isolate mx-auto flex max-w-6xl scroll-mt-0 flex-col px-4 pb-48 pt-6 sm:px-5 lg:h-(--app-vh) lg:pb-5">
          <div aria-hidden className="stage-dots pointer-events-none absolute inset-0 -z-10" />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Um mês de exemplo</h2>
            <p className="text-muted">Pode mexer em tudo: o {SITE.name} refaz a conta na hora.</p>
          </div>

        <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="flex min-h-0 flex-col gap-4 lg:col-span-7 lg:gap-5">
            {/* a sobra */}
            <Panel className={cx('relative flex flex-col justify-center p-5 sm:p-6 lg:flex-1', focus('left'))}>
              <section ref={targets.left} className="absolute inset-0" aria-hidden />
              <p className="text-lead font-semibold">Quanto sobra no fim do mês</p>
              <p className={cx('tnum mt-2 whitespace-nowrap text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-none tracking-[-0.045em]', tone)}>
                {bigMoney(shownLeft)}
              </p>
              <p className="mt-2 text-muted">
                {salary > 0 ? (left >= 0 ? `${pct}% do que entra fica livre` : 'as saídas passam do que entra') : 'sem renda, sem conta'}
              </p>
              <div aria-hidden className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-sunken">
                <span className="bar-seg rounded-[2px] bg-[var(--s-bills)]" style={{ flexGrow: billsTotal }} />
                <span className="bar-seg rounded-[2px] bg-[var(--s-cards)]" style={{ flexGrow: cardTotal }} />
                <span className="bar-seg rounded-[2px] bg-[var(--s-left)]" style={{ flexGrow: Math.max(0, left) }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 text-caption text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--s-bills)]" /> Contas {brlRound(billsTotal)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--s-cards)]" /> Cartão {brlRound(cardTotal)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--s-left)]" /> Sobra {brlRound(Math.max(0, left))}
                </span>
              </div>
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
              {/* o que entra */}
              <Panel className={cx('p-5', focus('salary'))}>
                <section ref={targets.salary}>
                  <p className="text-lead font-semibold">O que entra</p>
                  <p className="tnum mt-2 text-3xl font-semibold tracking-[-0.03em]">{bigMoney(salary)}</p>
                  <label className="mt-4 block">
                    <span className="sr-only">Salário do mês</span>
                    <input
                      type="range"
                      min={0}
                      max={1500000}
                      step={10000}
                      value={salary}
                      onChange={(e) => changeSalary(Number(e.target.value))}
                      className="range w-full"
                      style={{ '--p': `${(salary / 1500000) * 100}%` } as CSSProperties}
                    />
                  </label>
                  <div className="mt-1 flex justify-between text-micro text-faint">
                    <span>R$ 0</span>
                    <span>R$ 15 mil</span>
                  </div>
                </section>
              </Panel>

              {/* o cartão */}
              <Panel className={cx('p-5', focus('card'))}>
                <section ref={targets.card}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lead font-semibold">Fatura do cartão</p>
                    <p className="tnum font-semibold">{brl(cardTotal)}</p>
                  </div>
                  <ul className="-mx-2 mt-2">
                    {buys.map((b) => (
                      <Toggle key={b.id} item={b} onToggle={() => toggle('card', b.id)} />
                    ))}
                  </ul>
                </section>
              </Panel>
            </div>
          </div>

          {/* as contas */}
          <Panel className={cx('flex min-h-0 flex-col p-5 lg:col-span-5', focus('bills'))}>
            <section ref={targets.bills} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lead font-semibold">Contas do mês</p>
                <p className="tnum font-semibold">{brl(billsTotal)}</p>
              </div>
              <p className="text-caption text-muted">toque pra tirar ou pôr de volta</p>
              <ul className="no-scrollbar -mx-2 mt-2 min-h-0 flex-1 overflow-y-auto">
                {bills.map((b) => (
                  <Toggle key={b.id} item={b} onToggle={() => toggle('bills', b.id)} />
                ))}
              </ul>
            </section>
          </Panel>
        </div>

        {/* chamada e rodapé */}
        <div className="mt-4 flex flex-col gap-3 lg:mt-5 lg:flex-row lg:items-center lg:justify-between">
          <section ref={targets.cta} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-1 lg:flex-nowrap', focus('cta'))}>
            <Link href={start} className={linkButton('primary', 'lg')}>
              {authenticated ? 'Abrir o app' : 'Montar o meu mês de verdade'} <ArrowRight size={18} />
            </Link>
            <span className="text-caption text-muted">{offer}</span>
          </section>
          <section ref={targets.faq} className="rounded-panel">
            <FooterLinks compact>
              <button type="button" onClick={askFaq} className="py-1 font-semibold text-accent hover:underline">
                Perguntar ao {SITE.name}
              </button>
              {!touring && (
                <button type="button" onClick={replay} className="py-1 hover:text-fg">
                  Rever o passeio
                </button>
              )}
            </FooterLinks>
          </section>
        </div>

        </main>
        <Walker stage={stage} targets={targets} line={line} desktop={desktop} />
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
