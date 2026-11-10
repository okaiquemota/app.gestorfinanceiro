import { toMonth } from '../../shared/finance.ts'

const nf = new Intl.NumberFormat('pt-BR')

/** Parte inteira (com pontos) e centavos, separados pra estilizar. */
export const splitBRL = (cents: number): { neg: boolean; int: string; dec: string } => {
  const abs = Math.abs(Math.round(cents))
  return {
    neg: cents < 0,
    int: nf.format(Math.floor(abs / 100)),
    dec: String(abs % 100).padStart(2, '0'),
  }
}

export const brl = (cents: number): string => {
  const { neg, int, dec } = splitBRL(cents)
  return `${neg ? '−' : ''}R$ ${int},${dec}`
}

/** Sem centavos, pra espaços apertados (eixos, chips). */
export const brlShort = (cents: number): string => {
  const abs = Math.abs(cents) / 100
  const sign = cents < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `${sign}R$ ${nf.format(Math.round(abs))}`
}

export const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '0%'

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export const monthNames = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1))

export const monthParts = (m: string): { year: number; index: number } => {
  const [y, mo] = m.split('-').map(Number)
  return { year: y, index: mo - 1 }
}

/** "dezembro" */
export const monthLower = (m: string): string => MONTHS[monthParts(m).index]
/** "Dezembro" */
export const monthTitle = (m: string): string => monthNames[monthParts(m).index]
/** "Dez" no ano corrente, "Jan 27" nos demais */
export const monthShort = (m: string): string => {
  const { year, index } = monthParts(m)
  const name = monthNames[index].slice(0, 3)
  return year === new Date().getFullYear() ? name : `${name} ${String(year).slice(2)}`
}
/** "Dezembro de 2026" */
export const monthLongTitle = (m: string): string => `${monthTitle(m)} de ${monthParts(m).year}`
/** "dezembro de 2026" */
export const monthLong = (m: string): string => `${monthLower(m)} de ${monthParts(m).year}`

export const dd = (day: number): string => String(day).padStart(2, '0')
/** "05/12" */
export const dayMonth = (m: string, day: number): string => `${dd(day)}/${m.slice(5)}`
/** '2026-12-05' -> "05/12/2026" */
export const dateBR = (iso: string): string => iso.split('-').reverse().join('/')

export const currentMonth = (): string => toMonth(new Date())

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const weekday = (m: string, day: number): string => {
  const { year, index } = monthParts(m)
  return WEEKDAYS[new Date(year, index, day).getDay()]
}
