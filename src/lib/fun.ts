// A parte divertida do app: som e toque, falas do Poupin, sequência e conquistas.
// Tudo calculado a partir dos dados que já existem — nada é gravado no servidor.

import { addMonths, dueDate, entryActive, goalBalance, payables, summarize, toISODate } from '../../shared/finance.ts'
import type { Payable, Summary } from '../../shared/finance.ts'
import type { AppState } from '../../shared/types.ts'
import { brl, currentMonth, monthLower, pct } from './format.ts'

// ---------- som e toque ----------

const SOUND_KEY = 'gf-sound'

export const soundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}
export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0')
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}

let audio: AudioContext | null = null

/** Uma nota curta e suave. Os sons são sintetizados, sem arquivo de áudio. */
const note = (freq: number, at: number, length: number, volume = 0.07) => {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const t = audio.currentTime + at
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(volume, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + length + 0.02)
  } catch {
    // navegador sem áudio: segue sem som
  }
}

const buzz = (pattern: number | number[]) => {
  try {
    // o navegador só deixa vibrar logo depois de um toque; fora disso, nem tenta
    if (navigator.userActivation && !navigator.userActivation.isActive) return
    navigator.vibrate?.(pattern)
  } catch {
    // sem vibração neste aparelho
  }
}

/** Moedinha: ao marcar uma conta como paga. */
export const playCoin = () => {
  if (!soundOn()) return
  note(1318.5, 0, 0.09)
  note(1760, 0.07, 0.22)
  buzz(12)
}

/** Fanfarra curta: nas comemorações. */
export const playFanfare = () => {
  if (!soundOn()) return
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.09, 0.28, 0.06))
  buzz([18, 40, 18])
}

// ---------- falas do Poupin ----------

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

/** O que o Poupin tem a dizer sobre o mês que está na tela (uma frase curta). */
export const poupinSays = (state: AppState, month: string, sum: Summary, list: Payable[]): string => {
  const now = currentMonth()
  if (sum.income === 0 && sum.expenses === 0) return 'Zzz… lança alguma coisa pra eu acordar.'
  if (sum.income === 0) return 'Me conta quanto você ganha pra eu fazer a conta.'

  if (month === now) {
    const today = toISODate(new Date())
    const open = list.filter((p) => !p.paid)
    const late = open.filter((p) => dueDate(p.month, p.day) < today).length
    if (late > 0) return `Tem ${plural(late, 'conta atrasada', 'contas atrasadas')}. Bora resolver?`
    const dueToday = open.filter((p) => dueDate(p.month, p.day) === today)
    if (dueToday.length > 0) return dueToday.length === 1 ? `Hoje vence ${dueToday[0].name}.` : `Hoje vencem ${dueToday.length} contas.`
    if (sum.leftover < 0) return `Do jeito que está, faltam ${brl(-sum.leftover)} no mês.`
    if (list.length > 0 && open.length === 0) return 'Tudo pago! Pode respirar.'
    if (open.length > 0 && open.length <= 2) return `${open.length === 1 ? 'Falta 1 conta' : 'Faltam 2 contas'} e o mês fecha.`

    // olha os próximos 3 meses atrás de um aperto
    for (let i = 1; i <= 3; i++) {
      const m = addMonths(month, i)
      const next = summarize(state, m)
      if (next.income > 0 && next.leftover < 0) return `Ó: ${monthLower(m)} não fecha. Faltam ${brl(-next.leftover)}.`
      if (next.income > 0 && next.leftover < sum.leftover * 0.5 && sum.leftover > 0) return `Fica de olho: ${monthLower(m)} vai apertar.`
    }
  } else if (sum.leftover < 0) {
    return `Em ${monthLower(month)} faltam ${brl(-sum.leftover)}.`
  }

  const ratio = sum.leftover / sum.income
  if (ratio >= 0.3) return `Sobram ${pct(sum.leftover, sum.income)} da renda. Que tal guardar um pouco?`
  if (ratio >= 0.1) return `Sobram ${pct(sum.leftover, sum.income)} da renda. Tá no azul.`
  return 'Fecha no azul, mas bem justinho.'
}

// ---------- sequência e conquistas ----------

/** Meses seguidos fechando no azul, contando pra trás a partir do mês passado. */
export const streak = (state: AppState): number => {
  let n = 0
  for (let m = addMonths(currentMonth(), -1); n < 36; m = addMonths(m, -1)) {
    const s = summarize(state, m)
    if (s.income <= 0 || s.leftover < 0) break
    n++
  }
  return n
}

/** `secret`: fica escondida ("???") até ser conquistada. */
export type Achievement = { id: string; title: string; text: string; emoji: string; done: boolean; secret?: boolean }

export const achievements = (state: AppState): Achievement[] => {
  const now = currentMonth()
  const expenses = state.entries.filter((e) => e.kind === 'expense').length
  const run = streak(state)
  const monthAllPaid = [0, -1, -2, -3, -4, -5].some((i) => {
    const list = payables(state, addMonths(now, i))
    return list.length > 0 && list.every((p) => p.paid)
  })
  return [
    {
      id: 'renda',
      title: 'Ponto de partida',
      text: 'Cadastrou a primeira renda.',
      emoji: 'banknote',
      done: state.entries.some((e) => e.kind === 'income'),
    },
    { id: 'contas-3', title: 'Casa em ordem', text: 'Cadastrou 3 contas.', emoji: 'receipt', done: expenses >= 3 },
    { id: 'mes-pago', title: 'Mês zerado', text: 'Pagou todas as contas de um mês.', emoji: 'mascote-festa', done: monthAllPaid },
    {
      id: 'reserva',
      title: 'Primeira moeda',
      text: 'Guardou dinheiro numa meta.',
      emoji: 'coin',
      done: state.goalMoves.some((m) => m.amount_cents > 0),
    },
    {
      id: 'meta',
      title: 'Meta batida',
      text: 'Chegou no valor de uma meta.',
      emoji: 'target',
      done: state.goals.some((g) => g.target_cents > 0 && goalBalance(state, g) >= g.target_cents),
    },
    { id: 'azul-3', title: 'Três no azul', text: '3 meses seguidos fechando no azul.', emoji: 'chart-up', done: run >= 3 },
    { id: 'azul-6', title: 'Meio ano no azul', text: '6 meses seguidos fechando no azul.', emoji: 'rocket', done: run >= 6 },
    ...secretAchievements(state, run),
  ]
}

/** As escondidas: só aparecem (nome, ícone e texto) depois de conquistadas. */
const secretAchievements = (state: AppState, run: number): Achievement[] => {
  const now = currentMonth()
  const saved = state.goals.reduce((s, g) => s + Math.max(0, goalBalance(state, g)), 0)
  const goalsHit = state.goals.filter((g) => g.target_cents > 0 && goalBalance(state, g) >= g.target_cents).length
  const last12 = Array.from({ length: 12 }, (_, i) => addMonths(now, -i))
  const monthsAllPaid = last12.filter((m) => {
    const list = payables(state, m)
    return list.length > 0 && list.every((p) => p.paid)
  }).length
  // um mês já fechado em que sobraram 30% ou mais da renda
  const thrifty = last12.slice(1).some((m) => {
    const s = summarize(state, m)
    return s.income > 0 && s.leftover >= s.income * 0.3
  })
  const entryById = new Map(state.entries.map((e) => [e.id, e]))
  // pagou alguma conta antes do dia do vencimento
  const early = state.entryMonths.some((om) => {
    const e = entryById.get(om.entry_id)
    return !!om.paid_at && !!e && e.kind === 'expense' && om.paid_at.slice(0, 10) < dueDate(om.month, e.due_day)
  })
  const incomesNow = state.entries.filter((e) => e.kind === 'income' && entryActive(e, now)).length
  const done = (id: string, title: string, text: string, emoji: string, ok: boolean): Achievement => ({
    id,
    title,
    text,
    emoji,
    done: ok,
    secret: true,
  })
  return [
    done('cartao', 'Plástico na mão', 'Cadastrou o primeiro cartão.', 'card', state.cards.length > 0),
    done('cartoes-3', 'Carteira recheada', 'Tem 3 cartões cadastrados.', 'wallet', state.cards.length >= 3),
    done('parcelado', 'Em suaves parcelas', 'Lançou uma compra parcelada.', 'shopping', state.purchases.some((p) => p.installments > 1)),
    done('recorrente', 'Piloto automático', 'Lançou uma assinatura no cartão.', 'tv', state.purchases.some((p) => p.recurring)),
    done('fatura-paga', 'Fatura quitada', 'Marcou uma fatura como paga.', 'lock', state.invoices.some((i) => !!i.paid_at)),
    done('contas-10', 'Mestre das contas', 'Cadastrou 10 contas.', 'calendar', state.entries.filter((e) => e.kind === 'expense').length >= 10),
    done('rendas-2', 'Renda extra', 'Tem duas fontes de renda no mesmo mês.', 'briefcase', incomesNow >= 2),
    done('dia-a-dia', 'Pé no chão', 'Definiu quanto gasta no dia a dia.', 'cart', state.user.daily_budget_cents > 0),
    done('adiantado', 'Adiantado', 'Pagou uma conta antes do vencimento.', 'bulb', early),
    done('metas-3', 'Sonhador', 'Criou 3 metas.', 'sparkles', state.goals.length >= 3),
    done('meta-prazo', 'Com data marcada', 'Criou uma meta com prazo.', 'calendar-spiral', state.goals.some((g) => !!g.deadline)),
    done('viajante', 'Pé na estrada', 'Tem uma meta de viagem.', 'plane', state.goals.some((g) => g.icon === 'plane' || g.icon === 'beach')),
    done('guardou-1k', 'Primeiro milhar', 'Juntou R$ 1.000 nas metas.', 'money-bag', saved >= 100_000),
    done('guardou-10k', 'Cinco dígitos', 'Juntou R$ 10.000 nas metas.', 'gem', saved >= 1_000_000),
    done('guardou-100k', 'Seis dígitos', 'Juntou R$ 100.000 nas metas.', 'bank', saved >= 10_000_000),
    done('metas-batidas-3', 'Colecionador', 'Bateu 3 metas.', 'chart-bar', goalsHit >= 3),
    done('retirada', 'Pra isso que serve', 'Usou o dinheiro de uma meta quando precisou.', 'umbrella', state.goalMoves.some((m) => m.amount_cents < 0)),
    done('formiguinha', 'Formiguinha', 'Fechou um mês com 30% da renda sobrando.', 'seedling', thrifty),
    done('meses-zerados-3', 'Trinca perfeita', 'Pagou todas as contas em 3 meses.', 'key', monthsAllPaid >= 3),
    done('azul-12', 'Um ano no azul', '12 meses seguidos fechando no azul.', 'money-wings', run >= 12),
    done('desafio', 'Do meu jeito', 'Criou uma conquista própria.', 'gift', state.challenges.length > 0),
    done('desafio-ok', 'Promessa cumprida', 'Concluiu uma conquista própria.', 'party', state.challenges.some((c) => !!c.done_at)),
  ]
}

/** Conquistas que acabaram de ser desbloqueadas desde a última vez neste aparelho (por conta). */
export const newlyUnlocked = (userId: string, list: Achievement[]): Achievement[] => {
  // v2: entraram as secretas; quem já cumpria alguma não ganha uma enxurrada de festas
  const key = `gf-conquistas-v2:${userId}`
  const done = list.filter((a) => a.done)
  try {
    const raw = localStorage.getItem(key)
    localStorage.setItem(key, JSON.stringify(done.map((a) => a.id)))
    // primeira vez: só registra, sem comemorar tudo de uma vez
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    const seen = new Set(Array.isArray(parsed) ? parsed : [])
    return done.filter((a) => !seen.has(a.id))
  } catch {
    return []
  }
}
