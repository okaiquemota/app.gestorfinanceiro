import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../shared/types.ts'
import { Layout } from './Layout.tsx'
import { FormHost } from './forms.tsx'
import { ApiError, api } from './lib/api.ts'
import { Auth } from './pages/Auth.tsx'
import type { AuthStatus } from './pages/Auth.tsx'
import { Bills } from './pages/Bills.tsx'
import { Cards } from './pages/Cards.tsx'
import { CashFlow } from './pages/CashFlow.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Income } from './pages/Income.tsx'
import { Reserve } from './pages/Reserve.tsx'
import { Settings } from './pages/Settings.tsx'
import { usePath } from './router.tsx'
import { SetupWizard } from './Setup.tsx'
import { StoreProvider, useStore } from './store.tsx'
import { Button, Emoji } from './ui.tsx'

type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'auth'; status: AuthStatus }
  | { phase: 'ready'; state: AppState }

const PAGES: Record<string, () => React.JSX.Element> = {
  '/': Dashboard,
  '/contas': Bills,
  '/cartoes': Cards,
  '/fluxo': CashFlow,
  '/reserva': Reserve,
  '/renda': Income,
  '/ajustes': Settings,
}

/** A configuração inicial dá lugar a um formulário aberto (os dois são modais). */
function SetupHost() {
  const { setupOpen, form } = useStore()
  return setupOpen && !form ? <SetupWizard /> : null
}

export function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' })
  const path = usePath()

  const load = useCallback(async () => {
    try {
      const status = await api<AuthStatus>('GET', '/auth/status')
      if (!status.authenticated) return setBoot({ phase: 'auth', status })
      setBoot({ phase: 'ready', state: await api<AppState>('GET', '/state') })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return load()
      setBoot({ phase: 'error', message: e instanceof Error ? e.message : 'Não foi possível carregar.' })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (boot.phase === 'loading')
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Carregando">
        <Emoji name="money-bag" size={56} className="animate-pulse" />
      </div>
    )

  if (boot.phase === 'error')
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted">{boot.message}</p>
        <Button variant="primary" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )

  if (boot.phase === 'auth') return <Auth status={boot.status} onDone={load} />

  const Page = PAGES[path] ?? Dashboard
  return (
    <StoreProvider initial={boot.state} onSignedOut={load}>
      <Layout>
        <Page />
      </Layout>
      <FormHost />
      <SetupHost />
    </StoreProvider>
  )
}
