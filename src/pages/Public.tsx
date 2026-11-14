// Site público (sem login): apresentação do produto, termos e privacidade.
// Identidade própria: claro, lavanda e dourado, com o Poupin como guia.

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, Check, Minus, Plus } from 'lucide-react'
import { brl, pct } from '../lib/format.ts'
import { SITE, orTBD } from '../lib/site.ts'
import { Link } from '../router.tsx'
import { Emoji, cx } from '../ui.tsx'

export type PublicPlan = { price_cents: number; trial_days: number; billing_enabled: boolean; email_enabled: boolean }

const CTA =
  'group inline-flex h-13 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-primary px-6 text-base font-semibold text-on-primary shadow-[0_8px_20px_-6px_rgb(124_58_237/0.6)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary-hover'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

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

/** Moldura das telas públicas: sempre clara, com a paleta do site. */
export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="site relative min-h-(--app-vh) overflow-x-clip">{children}</div>
}

function Header({ authenticated }: { authenticated?: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5">
      <Link href="/" className="flex items-center gap-2.5">
        <Emoji name="mascote" size={44} />
        <span className="serif text-[28px]">{SITE.name}</span>
      </Link>
      <nav aria-label="Conta" className="flex items-center gap-1.5">
        {authenticated ? (
          <Link href="/" className={cx(CTA, '!h-11 !px-5 !text-sm')}>
            Abrir o app
          </Link>
        ) : (
          <>
            <Link href="/entrar" className="flex h-11 items-center rounded-2xl px-4 text-sm font-semibold hover:bg-primary-soft">
              Entrar
            </Link>
            <Link href="/criar-conta" className={cx(CTA, '!h-11 !px-5 !text-sm max-[380px]:hidden')}>
              Criar conta
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-8 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-caption text-muted">
        <span className="flex items-center gap-2">
          <Emoji name="mascote" size={24} />© {new Date().getFullYear()} {SITE.name}
        </span>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-1">
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

// ---------- calculadora do topo ----------

const SLIDERS = [
  { key: 'renda', label: 'Quanto você recebe', max: 2000000, step: 10000, color: '#16a34a' },
  { key: 'contas', label: 'Contas fixas (aluguel, luz, internet…)', max: 1000000, step: 5000, color: '#7c3aed' },
  { key: 'cartao', label: 'Fatura do cartão', max: 600000, step: 5000, color: '#f5b400' },
  { key: 'dia', label: 'Dia a dia (mercado, gasolina…)', max: 400000, step: 5000, color: '#e879a6' },
] as const

type Values = Record<(typeof SLIDERS)[number]['key'], number>

/** A conta do Poupin, ao vivo: a pessoa arrasta os valores e vê quanto sobra. */
function Calculator({ start, cta }: { start: string; cta: string }) {
  const [v, setV] = useState<Values>({ renda: 450000, contas: 190000, cartao: 80000, dia: 70000 })
  const id = useId()
  const out = v.contas + v.cartao + v.dia
  const left = v.renda - out
  const ratio = v.renda > 0 ? left / v.renda : -1
  const mood =
    left < 0
      ? { pose: 'mascote-preocupado', text: 'Opa. As saídas passaram da renda.', tone: 'text-bad' }
      : ratio >= 0.2
        ? { pose: 'mascote-festa', text: `Sobram ${pct(left, v.renda)} da renda. Dá até pra guardar.`, tone: 'text-good' }
        : { pose: 'mascote-moeda', text: `Sobram ${pct(left, v.renda)} da renda. No azul, mas justo.`, tone: 'text-accent' }
  const scale = Math.max(v.renda, out, 1)

  return (
    <div className="relative rounded-[28px] border border-line bg-surface p-5 shadow-pop sm:p-7">
      <Emoji
        key={mood.pose}
        name={mood.pose}
        size={112}
        className="mascot absolute -top-14 right-4 !h-auto !w-[clamp(84px,22vw,112px)] drop-shadow-[0_12px_16px_rgb(76_29_149/0.25)]"
      />
      <p className="pr-28 text-caption font-semibold uppercase tracking-[0.08em] text-accent">Faça a conta agora</p>
      <p className="mt-1 pr-28 text-muted">Arraste e veja o que o {SITE.name} te mostraria.</p>

      <div className="mt-5 space-y-3.5">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`${id}-${s.key}`} className="text-caption font-medium text-muted">
                {s.label}
              </label>
              <span className="tnum font-semibold">{brl(v[s.key])}</span>
            </div>
            <input
              id={`${id}-${s.key}`}
              type="range"
              min={0}
              max={s.max}
              step={s.step}
              value={v[s.key]}
              onChange={(e) => setV({ ...v, [s.key]: Number(e.target.value) })}
              aria-valuetext={brl(v[s.key])}
              style={{ '--track': s.color, '--fill': `${(v[s.key] / s.max) * 100}%` } as CSSProperties}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-sunken p-4" role="status" aria-live="polite">
        <p className="text-caption text-muted">{left < 0 ? 'Falta no mês' : 'Sobra no mês'}</p>
        <p className={cx('serif tnum text-[clamp(2.25rem,9vw,3.25rem)]', left < 0 && 'text-bad')}>{brl(Math.abs(left))}</p>
        <div aria-hidden className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
          {SLIDERS.slice(1).map((s) => (
            <span key={s.key} className="bar-seg rounded-[2px]" style={{ flexGrow: v[s.key] / scale, background: s.color }} />
          ))}
          {left > 0 && <span className="bar-seg rounded-[2px] bg-good-fill" style={{ flexGrow: left / scale }} />}
        </div>
        <p className={cx('mt-2.5 text-caption font-semibold', mood.tone)}>{mood.text}</p>
      </div>

      <Link href={start} className={cx(CTA, 'mt-4 w-full')}>
        {cta}
        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  )
}

// ---------- pedaços de interface usados como ilustração ----------

function Mock({ children, tint }: { children: ReactNode; tint: string }) {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-3 rotate-2 rounded-[32px] sm:-inset-5" style={{ background: tint }} />
      <div aria-hidden className="relative rounded-3xl border border-line bg-surface p-5 shadow-pop sm:p-6">
        {children}
      </div>
    </div>
  )
}

function MockBills() {
  const rows: [string, string, string, boolean][] = [
    ['05', 'Aluguel', 'R$ 1.800,00', true],
    ['10', 'Internet', 'R$ 119,90', true],
    ['12', 'Fatura do cartão', 'R$ 842,30', false],
    ['15', 'Academia', 'R$ 99,90', false],
  ]
  return (
    <>
      <p className="text-caption text-muted">Contas a pagar</p>
      <p className="serif tnum text-4xl">R$ 942,20</p>
      <p className="mt-1 text-caption font-semibold text-muted">2 de 4 pagas</p>
      <ul className="mt-3 divide-y divide-line">
        {rows.map(([day, name, value, paid]) => (
          <li key={name} className="flex items-center gap-3 py-2.5 text-sm">
            <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]', paid ? 'border-good-fill bg-good-fill text-white' : 'border-control')}>
              {paid && <Check size={12} strokeWidth={3.5} />}
            </span>
            <span className="tnum w-6 text-caption text-faint">{day}</span>
            <span className={cx('flex-1 truncate', paid && 'text-faint line-through')}>{name}</span>
            <span className={cx('tnum font-semibold', paid && 'text-faint')}>{value}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function MockCard() {
  return (
    <>
      <div className="flex aspect-[1.6] w-[78%] max-w-[280px] flex-col justify-between rounded-2xl bg-[linear-gradient(135deg,#8a3df2,#5a17c9)] p-4 text-white shadow-pop">
        <span className="flex justify-between text-sm font-semibold">
          Meu cartão <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">Aberta</span>
        </span>
        <span className="flex items-end justify-between">
          <span>
            <span className="block text-[9px] font-semibold tracking-[0.1em] text-white/70">VENCE</span>
            <span className="tnum text-sm font-semibold">12/12</span>
          </span>
          <span className="text-right">
            <span className="block text-[9px] font-semibold tracking-[0.1em] text-white/70">FATURA</span>
            <span className="tnum text-sm font-semibold">R$ 842,30</span>
          </span>
        </span>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {[
          ['Notebook', 'parcela 3 de 12', 'R$ 350,00'],
          ['Mercado', 'à vista', 'R$ 436,40'],
          ['Streaming', 'assinatura', 'R$ 55,90'],
        ].map(([name, kind, value]) => (
          <li key={name} className="flex items-baseline justify-between gap-3">
            <span>
              {name} <span className="text-caption text-faint">· {kind}</span>
            </span>
            <span className="tnum font-semibold">{value}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function MockFlow() {
  const months = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
  const left = [38, 22, 46, 52, 52, 60]
  return (
    <>
      <p className="text-caption text-muted">Sobra prevista, mês a mês</p>
      <div className="mt-4 flex h-36 items-end gap-2.5">
        {left.map((h, i) => (
          <span key={months[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className={cx('w-full rounded-t-lg', i === 1 ? 'bg-[#f5b400]' : 'bg-primary')} style={{ height: `${h * 1.1}px` }} />
            <span className="text-micro text-faint">{months[i]}</span>
          </span>
        ))}
      </div>
      <p className="mt-3 rounded-xl bg-[#fff3cc] px-3 py-2 text-caption font-semibold text-[#6b4a00]">Janeiro aperta: é o mês do IPVA.</p>
    </>
  )
}

function MockGoal() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Emoji name="umbrella" size={44} />
        <div>
          <p className="font-semibold">Reserva de emergência</p>
          <p className="tnum text-caption text-muted">R$ 6.200,00 de R$ 10.000,00</p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-sunken">
        <div className="h-full w-[62%] rounded-full bg-good-fill" />
      </div>
      <p className="mt-3 text-sm text-muted">
        Faltam R$ 3.800,00. Guardando <strong className="text-fg">R$ 475,00 por mês</strong>, você chega lá em julho.
      </p>
    </>
  )
}

const ROWS: { tag: string; title: string; text: string; mock: ReactNode; tint: string }[] = [
  {
    tag: 'Contas a pagar',
    title: 'Nenhuma conta te pega de surpresa.',
    text: 'Tudo organizado pelo dia do vencimento. Você marca o que pagou, vê o que falta e o que atrasou. As contas que se repetem aparecem sozinhas no mês seguinte.',
    mock: <MockBills />,
    tint: '#efe7fe',
  },
  {
    tag: 'Cartões',
    title: 'A fatura deixa de ser um susto.',
    text: 'Cada compra cai na fatura certa pelo dia de fechamento do cartão. Parcelas e assinaturas já aparecem nos meses seguintes, antes de a fatura chegar.',
    mock: <MockCard />,
    tint: '#fff3cc',
  },
  {
    tag: 'Fluxo de caixa',
    title: 'Você enxerga o aperto meses antes.',
    text: 'Uma projeção dos próximos 12 meses, com o que entra, o que sai e quanto sobra em cada um. Dá tempo de se preparar para o mês difícil.',
    mock: <MockFlow />,
    tint: '#e3f6ea',
  },
  {
    tag: 'Reserva',
    title: 'Guardar vira um plano, não uma intenção.',
    text: 'Crie metas com valor e prazo. O Poupin calcula quanto guardar por mês e acompanha o progresso de cada uma.',
    mock: <MockGoal />,
    tint: '#fde8f0',
  },
]

const MOODS: [string, string, string][] = [
  ['mascote-moeda', 'Sobrando', 'Tem dinheiro livre no mês.'],
  ['mascote-festa', 'Tudo pago', 'Nenhuma conta em aberto.'],
  ['mascote-preocupado', 'Apertou', 'As saídas passaram da renda.'],
  ['mascote-dormindo', 'Mês vazio', 'Ainda não tem nada lançado.'],
]

const FAQ: [string, string][] = [
  [
    'O Poupin se conecta ao meu banco?',
    'Não. Você mesmo cadastra renda, contas e cartões. O Poupin nunca pede senha de banco nem acesso à sua conta bancária.',
  ],
  [
    'Meus dados ficam seguros?',
    'Seus dados ficam na sua conta, protegida por senha, e a conexão é sempre criptografada. Você pode baixar uma cópia de tudo ou excluir a conta quando quiser, direto nos Ajustes.',
  ],
  ['Preciso de cartão de crédito pra testar?', 'Não. O teste começa quando você cria a conta, sem informar nenhum meio de pagamento.'],
  [
    'E se eu não quiser continuar?',
    'Você não é cobrado. Ao fim do teste a conta fica só para consulta: dá pra ver e exportar tudo, mas não lançar coisas novas, até você assinar ou excluir a conta.',
  ],
  ['Funciona no celular?', 'Funciona. O Poupin abre no navegador do celular e do computador, sem instalar nada, e os dados são os mesmos nos dois.'],
]

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lead font-semibold"
        >
          {q}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-accent">
            {open ? <Minus size={16} /> : <Plus size={16} />}
          </span>
        </button>
      </h3>
      <p id={id} hidden={!open} className="px-5 pb-5 text-muted">
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
        <Header authenticated={authenticated} />
        <main>
          {/* ---------- abertura: promessa + calculadora ---------- */}
          <section className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-16 px-5 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-12">
            <div className="reveal">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#fff3cc] px-3.5 py-1.5 text-caption font-semibold text-[#6b4a00]">
                <Emoji name="coin" size={18} /> Finanças pessoais, sem planilha
              </p>
              <h1 className="serif mt-5 text-[clamp(2.75rem,8.5vw,5.25rem)]">
                Quanto vai <em className="text-accent">sobrar</em> este mês?
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">
                O {SITE.name} junta sua renda, suas contas e as faturas dos cartões e responde essa pergunta todo dia, antes de
                o mês acabar.
              </p>
              <ul className="mt-6 space-y-2 text-muted">
                {[`${plan.trial_days} dias grátis, sem cartão de crédito`, 'Sem conectar banco nem pedir senha', 'No celular e no computador'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-good">
                      <Check size={13} strokeWidth={3.5} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal" style={delay(120)}>
              <Calculator start={start} cta={startLabel} />
            </div>
          </section>

          {/* ---------- o app ---------- */}
          <section aria-labelledby="app-titulo" className="bg-[linear-gradient(to_bottom,transparent,#efe7fe_30%,#efe7fe_70%,transparent)] py-12">
            <div className="mx-auto max-w-6xl px-5">
              <div className="reveal mx-auto max-w-2xl text-center">
                <h2 id="app-titulo" className="serif text-[clamp(2rem,5.5vw,3.25rem)]">
                  A sua conta do mês, sempre pronta.
                </h2>
                <p className="mt-3 text-lg text-muted">
                  A mesma conta que você acabou de fazer, com os seus números de verdade, atualizada a cada coisa que você lança
                  ou paga.
                </p>
              </div>
              <div className="reveal mt-9 rounded-[28px] border border-line bg-surface p-2 shadow-pop sm:p-3" style={delay(100)}>
                <img
                  src="/tela.webp"
                  alt={`Tela de visão geral do ${SITE.name}: saldo previsto, contas a pagar, categorias de gasto e cartões`}
                  width={1440}
                  height={900}
                  loading="lazy"
                  className="w-full rounded-[20px]"
                />
              </div>
            </div>
          </section>

          {/* ---------- recursos, um por vez ---------- */}
          <section aria-label="Recursos" className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:space-y-28 sm:py-24">
            {ROWS.map((row, i) => (
              <div key={row.tag} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
                <div className={cx('reveal', i % 2 === 1 && 'md:order-2')}>
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-accent">{row.tag}</p>
                  <h2 className="serif mt-2 text-[clamp(1.9rem,4.6vw,3rem)]">{row.title}</h2>
                  <p className="mt-4 max-w-md text-lg text-muted">{row.text}</p>
                </div>
                <div className="reveal px-3 sm:px-5" style={delay(100)}>
                  <Mock tint={row.tint}>{row.mock}</Mock>
                </div>
              </div>
            ))}
          </section>

          {/* ---------- o mascote ---------- */}
          <section aria-labelledby="mascote-titulo" className="bg-surface py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-5">
              <div className="reveal mx-auto max-w-2xl text-center">
                <h2 id="mascote-titulo" className="serif text-[clamp(2rem,5.5vw,3.25rem)]">
                  O {SITE.name} sente o mês com você.
                </h2>
                <p className="mt-3 text-lg text-muted">
                  O porquinho da tela inicial muda de humor conforme o seu mês. Uma olhada e você já sabe como está.
                </p>
              </div>
              <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
                {MOODS.map(([pose, title, text], i) => (
                  <li key={pose} className="reveal rounded-3xl bg-bg p-5 text-center" style={delay(i * 70)}>
                    <Emoji name={pose} size={128} className="mascot mx-auto !h-auto !w-[min(128px,80%)]" />
                    <h3 className="serif mt-4 text-2xl">{title}</h3>
                    <p className="mt-1 text-caption text-muted">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- como começar ---------- */}
          <section aria-labelledby="como-titulo" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
            <h2 id="como-titulo" className="serif reveal max-w-2xl text-[clamp(2rem,5.5vw,3.25rem)]">
              Do zero ao “quanto sobra” em três passos.
            </h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                ['banknote', 'Conte quanto entra', 'Seu salário e o que mais cair na conta todo mês.'],
                ['receipt', 'Cadastre contas e cartões', 'Aluguel, luz, internet, parcelas. O Poupin já sugere as mais comuns.'],
                ['mascote-moeda', 'Veja quanto sobra', 'O saldo aparece na hora e muda a cada conta que você marca como paga.'],
              ].map(([emoji, title, text], i) => (
                <li key={title} className="reveal relative rounded-3xl border border-line bg-surface p-6" style={delay(i * 90)}>
                  <span className="serif absolute right-5 top-3 text-6xl text-primary-soft">{i + 1}</span>
                  <Emoji name={emoji} size={56} />
                  <h3 className="serif mt-4 text-2xl">{title}</h3>
                  <p className="mt-2 text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ---------- preço ---------- */}
          <section id="preco" aria-labelledby="preco-titulo" className="mx-auto max-w-6xl scroll-mt-6 px-5">
            <div className="reveal grid overflow-hidden rounded-[32px] border border-line bg-surface shadow-pop md:grid-cols-[1.1fr_0.9fr]">
              <div className="p-7 sm:p-10">
                <h2 id="preco-titulo" className="serif text-[clamp(2rem,5.5vw,3.25rem)]">
                  Um plano só, com tudo.
                </h2>
                <ul className="mt-6 space-y-3 text-lg">
                  {[
                    'Contas, rendas e cartões sem limite',
                    'Projeção dos próximos 12 meses',
                    'Metas de reserva com prazo',
                    'Celular e computador',
                    'Cópia dos seus dados quando quiser',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-good">
                        <Check size={13} strokeWidth={3.5} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col justify-center bg-primary-soft p-7 sm:p-10">
                <p className="font-semibold text-accent">{plan.trial_days} dias grátis pra testar</p>
                {plan.billing_enabled ? (
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="serif tnum text-[clamp(3rem,9vw,4.5rem)]">{brl(plan.price_cents)}</span>
                    <span className="text-muted">por mês</span>
                  </p>
                ) : (
                  <p className="serif mt-2 text-[clamp(2.25rem,6vw,3.25rem)]">Grátis no lançamento</p>
                )}
                <p className="mt-2 text-muted">
                  {plan.billing_enabled
                    ? 'Depois do teste, pague por Pix, cartão ou boleto pelo Mercado Pago. Cancele quando quiser, sem multa.'
                    : 'A assinatura ainda não foi aberta. Enquanto isso, o uso é gratuito.'}
                </p>
                <Link href={start} className={cx(CTA, 'mt-6')}>
                  {authenticated ? 'Abrir o app' : 'Começar agora'}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </section>

          {/* ---------- dúvidas ---------- */}
          <section aria-labelledby="duvidas-titulo" className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
            <h2 id="duvidas-titulo" className="serif reveal text-center text-[clamp(2rem,5.5vw,3.25rem)]">
              Antes de você perguntar
            </h2>
            <div className="reveal mt-8 space-y-3" style={delay(80)}>
              {FAQ.map(([q, a]) => (
                <Question key={q} q={q} a={a} />
              ))}
            </div>
          </section>

          {/* ---------- chamada final ---------- */}
          <section className="mx-auto max-w-6xl px-5">
            <div className="reveal relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#7c3aed,#4c1d95)] px-6 py-14 text-center text-white sm:py-20">
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {[8, 22, 37, 55, 70, 86].map((x, i) => (
                  <span key={x} className="coin absolute top-0" style={{ left: `${x}%`, '--t': `${8 + (i % 3) * 2}s`, '--delay': `${-i * 1.7}s` } as CSSProperties}>
                    <Emoji name="coin" size={30 + (i % 2) * 10} className="opacity-70" />
                  </span>
                ))}
              </div>
              <div className="relative">
                <Emoji name="mascote-festa" size={150} className="mascot mx-auto !h-auto !w-[clamp(104px,20vw,150px)]" />
                <h2 className="serif mx-auto mt-5 max-w-3xl text-[clamp(2.25rem,7vw,4.25rem)]">
                  Descubra hoje quanto sobra no seu mês.
                </h2>
                <Link
                  href={start}
                  className="group mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-8 text-lg font-semibold text-[#4c1d95] transition-transform hover:-translate-y-0.5"
                >
                  {startLabel}
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                </Link>
                {!authenticated && <p className="mt-3 text-caption text-white/80">Sem cartão de crédito. Cancele quando quiser.</p>}
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
      <Header authenticated={authenticated} />
      <main className="mx-auto max-w-3xl px-5 pb-8 pt-6">
        <h1 className="serif text-[clamp(2.25rem,7vw,3.5rem)]">{title}</h1>
        <p className="mt-2 text-caption text-muted">Última atualização: {SITE.legalUpdatedAt}</p>
        <div className="mt-7 space-y-7 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_p]:text-muted [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:text-muted">
          {children}
        </div>
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
          O {SITE.name} é um aplicativo de organização financeira pessoal oferecido por {orTBD(SITE.owner)}, inscrito sob o nº{' '}
          {orTBD(SITE.ownerDocument)} (“nós”). Ele permite cadastrar rendas, contas, cartões de crédito e metas, e calcula
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
          do teste, para continuar cadastrando e alterando dados é preciso assinar o plano mensal, cobrado por meio do Mercado
          Pago no valor informado na página de preços no momento da contratação.
        </p>
        <p>
          A assinatura se renova automaticamente a cada mês até ser cancelada. Você pode cancelar a qualquer momento nos
          Ajustes; o acesso continua até o fim do período já pago e não há cobrança de multa. Sem assinatura ativa, a conta
          fica disponível apenas para consulta e exportação dos dados.
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
          Dúvidas e solicitações: {contact()}. Estes termos são regidos pelas leis brasileiras. Fica eleito o foro de{' '}
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
          O controlador dos dados pessoais tratados no {SITE.name} é {orTBD(SITE.owner)}, inscrito sob o nº{' '}
          {orTBD(SITE.ownerDocument)}. Contato para assuntos de privacidade (encarregado): {contact()}.
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
            <strong className="text-fg">Assinatura:</strong> situação do plano e identificador da assinatura no Mercado Pago.
            Os dados de pagamento (cartão, Pix, boleto) são informados diretamente ao Mercado Pago e não passam por nós.
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
            <strong className="text-fg">Mercado Pago:</strong> processamento dos pagamentos da assinatura.
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
