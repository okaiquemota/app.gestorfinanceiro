// A parte divertida do app: som e toque, falas do Poupin, sequência e conquistas.
// Tudo calculado a partir dos dados que já existem — nada é gravado no servidor.

import { addMonths, dueDate, goalBalance, payables, summarize, toISODate } from '../../shared/finance.ts'
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

export type Achievement = { id: string; title: string; text: string; emoji: string; done: boolean }

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
  ]
}

const SEEN_KEY = 'gf-conquistas'

/** Conquistas que acabaram de ser desbloqueadas desde a última vez neste aparelho. */
export const newlyUnlocked = (list: Achievement[]): Achievement[] => {
  const done = list.filter((a) => a.done)
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    localStorage.setItem(SEEN_KEY, JSON.stringify(done.map((a) => a.id)))
    // primeira vez: só registra, sem comemorar tudo de uma vez
    if (raw === null) return []
    const seen = new Set(JSON.parse(raw) as string[])
    return done.filter((a) => !seen.has(a.id))
  } catch {
    return []
  }
}
