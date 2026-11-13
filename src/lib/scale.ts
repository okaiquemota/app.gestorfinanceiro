// Escala da interface no computador.
//
// O layout foi desenhado para uma janela em torno de 1680×1080. Em vez de a
// página rolar numa tela baixa (notebook 1366×768) ou virar uma ilha pequena
// no meio de uma tela enorme (4K, ou zoom do navegador bem reduzido), a
// interface inteira encolhe ou cresce proporcionalmente via CSS `zoom`.
//
// Como `zoom` não mexe nas media queries nem nas unidades de viewport, este
// módulo também publica: a altura útil já convertida (--app-vh) e os modos de
// layout como atributos no <html> (data-fit, data-tight), usados pelas
// variantes `fit:` e `tight:` do CSS.

import { useSyncExternalStore } from 'react'

const DESKTOP = 1280 // abaixo disso (tablet, celular, zoom alto): sem escala
const DESIGN_W = 1680
const DESIGN_H = 1080
const FIT_MIN_H = 800 // altura mínima do layout para caber sem rolagem
const TIGHT_BELOW = 1070 // abaixo disso somem os detalhes (ver variante `tight`)
const TIGHT_H = 867 // altura em que o modo "tight" cabe inteiro, sem rolagem interna
const MIN_ZOOM = 0.75 // menos que isso o texto fica pequeno demais
const MAX_ZOOM = 2.5

export type LayoutMode = 'scroll' | 'tight' | 'fit'

let mode: LayoutMode = 'scroll'
const listeners = new Set<() => void>()

const compute = (w: number, h: number): number => {
  if (w < DESKTOP) return 1
  const grow = Math.min(w / DESIGN_W, h / DESIGN_H)
  if (grow > 1) return Math.min(grow, MAX_ZOOM)
  // tela baixa: encolhe só o necessário para o layout "fit" caber
  if (h < TIGHT_H) return Math.max(MIN_ZOOM, h / TIGHT_H)
  return 1
}

const apply = () => {
  const root = document.documentElement
  const w = window.innerWidth
  const h = window.innerHeight
  const zoom = Math.round(compute(w, h) * 100) / 100
  const layoutH = h / zoom

  root.style.zoom = zoom === 1 ? '' : String(zoom)
  root.style.setProperty('--app-vh', `${layoutH}px`)

  const next: LayoutMode = w >= DESKTOP && layoutH >= FIT_MIN_H ? (layoutH < TIGHT_BELOW ? 'tight' : 'fit') : 'scroll'
  root.toggleAttribute('data-fit', next !== 'scroll')
  root.toggleAttribute('data-tight', next === 'tight')
  if (next !== mode) {
    mode = next
    listeners.forEach((l) => l())
  }
}

export const startScaling = () => {
  apply()
  window.addEventListener('resize', apply)
}

/** Modo de layout atual, para o que precisa decidir em JS (ex.: quantas linhas mostrar). */
export const useLayoutMode = (): LayoutMode =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => mode,
  )
