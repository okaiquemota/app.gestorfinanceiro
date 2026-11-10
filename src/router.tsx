import { useSyncExternalStore } from 'react'
import type { AnchorHTMLAttributes, MouseEvent } from 'react'

// Roteador mínimo em cima da History API — o app só tem meia dúzia de telas.

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const subscribe = (l: () => void) => {
  listeners.add(l)
  window.addEventListener('popstate', l)
  return () => {
    listeners.delete(l)
    window.removeEventListener('popstate', l)
  }
}

export const usePath = (): string =>
  useSyncExternalStore(subscribe, () => window.location.pathname)

export const navigate = (to: string) => {
  if (to !== window.location.pathname) {
    window.history.pushState(null, '', to)
    emit()
  }
  window.scrollTo(0, 0)
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handle} {...rest} />
}
