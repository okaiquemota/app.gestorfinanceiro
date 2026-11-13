import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState, Card, Entry, EntryKind, Goal, Purchase } from '../shared/types.ts'
import { ApiError, api } from './lib/api.ts'
import { currentMonth } from './lib/format.ts'
import { setupSeen } from './Setup.tsx'
import type { ToastData } from './ui.tsx'

export type FormSpec =
  | { type: 'entry'; kind: EntryKind; entry?: Entry; preset?: Partial<Entry> }
  | { type: 'occurrence'; entryId: string; month: string }
  | { type: 'card'; card?: Card }
  | { type: 'purchase'; purchase?: Purchase; cardId?: string }
  | { type: 'invoice'; cardId: string; month: string }
  | { type: 'goal'; goal?: Goal }
  | { type: 'move'; goalId: string; direction: 'in' | 'out' }

export type Theme = 'light' | 'dark'

type Store = {
  state: AppState
  month: string
  setMonth: (m: string) => void
  /**
   * Executa uma escrita na API e recarrega os dados. `patch` aplica a mudança
   * na tela na hora (ex.: marcar conta paga) antes da resposta chegar.
   */
  run: (
    fn: () => Promise<unknown>,
    opts?: { patch?: (s: AppState) => AppState; success?: string },
  ) => Promise<boolean>
  form: FormSpec | null
  openForm: (f: FormSpec) => void
  closeForm: () => void
  /** Configuração inicial (passo a passo do primeiro acesso). */
  setupOpen: boolean
  openSetup: () => void
  closeSetup: () => void
  theme: Theme
  setTheme: (t: Theme) => void
  toast: ToastData | null
  notify: (message: string, tone?: ToastData['tone']) => void
  dismissToast: () => void
  logout: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export const useStore = (): Store => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}

export function StoreProvider({
  initial,
  onSignedOut,
  children,
}: {
  initial: AppState
  onSignedOut: () => void
  children: ReactNode
}) {
  const [state, setState] = useState(initial)
  const [month, setMonth] = useState(currentMonth)
  const [form, setForm] = useState<FormSpec | null>(null)
  // Abre sozinha só no primeiro acesso: nada cadastrado e ainda não vista neste aparelho.
  const [setupOpen, setSetupOpen] = useState(() => initial.entries.length === 0 && !setupSeen())
  const [toast, setToast] = useState<ToastData | null>(null)
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? 'light',
  )
  const timer = useRef<number | undefined>(undefined)

  const notify = useCallback<Store['notify']>((message, tone = 'error') => {
    setToast({ message, tone })
    window.clearTimeout(timer.current)
    // erro fica mais tempo: precisa ser lido e entendido
    timer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 7000 : 3000)
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  const reload = useCallback(async () => {
    try {
      setState(await api<AppState>('GET', '/state'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSignedOut()
      else throw e
    }
  }, [onSignedOut])

  const run = useCallback<Store['run']>(
    async (fn, { patch, success } = {}) => {
      if (patch) setState(patch)
      try {
        await fn()
        await reload()
        if (success) notify(success, 'success')
        return true
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          onSignedOut()
          return false
        }
        notify(e instanceof Error ? e.message : 'Algo deu errado.')
        // desfaz o que foi aplicado na tela, voltando ao que o servidor tem
        if (patch) await reload().catch(() => {})
        return false
      }
    },
    [reload, notify, onSignedOut],
  )

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem('gf-theme', t)
    } catch {
      // sem localStorage (aba privada): o tema vale só nesta sessão
    }
    setThemeState(t)
  }, [])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#0b0c0f' : '#f2f3f6')
  }, [theme])

  // ao voltar pra aba (ex.: mexeu pelo celular), busca os dados de novo
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const logout = useCallback(async () => {
    await api('POST', '/auth/logout').catch(() => {})
    onSignedOut()
  }, [onSignedOut])

  const value = useMemo<Store>(
    () => ({
      state,
      month,
      setMonth,
      run,
      form,
      openForm: setForm,
      closeForm: () => setForm(null),
      setupOpen,
      openSetup: () => setSetupOpen(true),
      closeSetup: () => setSetupOpen(false),
      theme,
      setTheme,
      toast,
      notify,
      dismissToast,
      logout,
    }),
    [state, month, run, form, setupOpen, theme, setTheme, toast, notify, dismissToast, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
