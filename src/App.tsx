import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../shared/types.ts'
import { Layout } from './Layout.tsx'
import { Paywall } from './Paywall.tsx'
import { SetupWizard } from './Setup.tsx'
import { FormHost } from './forms.tsx'
import { ApiError, api } from './lib/api.ts'
import { Auth } from './pages/Auth.tsx'
import type { AuthMode } from './pages/Auth.tsx'
import { Bills } from './pages/Bills.tsx'
import { Cards } from './pages/Cards.tsx'
import { CashFlow } from './pages/CashFlow.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Income } from './pages/Income.tsx'
import { Landing, Privacy, Terms } from './pages/Public.tsx'
import type { PublicPlan } from './pages/Public.tsx'
import { Reserve } from './pages/Reserve.tsx'
import { Settings } from './pages/Settings.tsx'
import { setScaling } from './lib/scale.ts'
import { navigate, usePath } from './router.tsx'
import { StoreProvider, useStore } from './store.tsx'
import { Button, Emoji } from './ui.tsx'

type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'public'; plan: PublicPlan }
  | { phase: 'ready'; state: AppState; plan: PublicPlan }

const PAGES: Record<string, () => React.JSX.Element> = {
  '/': Dashboard,
  '/contas': Bills,
  '/cartoes': Cards,
  '/fluxo': CashFlow,
  '/reserva': Reserve,
  '/renda': Income,
  '/ajustes': Settings,
}

const AUTH_ROUTES: Record<string, AuthMode> = {
  '/entrar': 'login',
  '/criar-conta': 'signup',
  '/recuperar-senha': 'forgot',
  '/nova-senha': 'reset',
}

/** A configuração inicial dá lugar a um formulário aberto (os dois são modais). */
function SetupHost() {
  const { setupOpen, form, paywall } = useStore()
  return setupOpen && !form && !paywall ? <SetupWizard /> : null
}

export function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' })
  const path = usePath()

  const load = useCallback(async () => {
    try {
      const [status, plan] = await Promise.all([
        api<{ authenticated: boolean }>('GET', '/auth/status'),
        api<PublicPlan>('GET', '/public/plan'),
      ])
      if (!status.authenticated) return setBoot({ phase: 'public', plan })
      setBoot({ phase: 'ready', state: await api<AppState>('GET', '/state'), plan })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return load()
      setBoot({ phase: 'error', message: e instanceof Error ? e.message : 'Não foi possível carregar.' })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // a escala proporcional é só do app; o site público rola normalmente
  const legal = path === '/termos' || path === '/privacidade'
  useEffect(() => setScaling(boot.phase === 'ready' && !legal), [boot.phase, legal])

  // fora do app, o título da aba acompanha a tela pública
  useEffect(() => {
    if (boot.phase !== 'public') return
    document.title =
      path === '/termos' ? 'Termos de uso · Poupin' : path === '/privacidade' ? 'Privacidade · Poupin' : 'Poupin · Quanto vai sobrar este mês?'
  }, [boot.phase, path])

  if (boot.phase === 'loading')
    return (
      <div className="flex min-h-(--app-vh) items-center justify-center" role="status" aria-label="Carregando">
        <Emoji name="mascote" size={72} className="animate-pulse" />
      </div>
    )

  if (boot.phase === 'error')
    return (
      <div className="flex min-h-(--app-vh) flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted">{boot.message}</p>
        <Button variant="primary" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )

  const authenticated = boot.phase === 'ready'
  if (path === '/termos') return <Terms plan={boot.plan} authenticated={authenticated} />
  if (path === '/privacidade') return <Privacy authenticated={authenticated} />

  if (boot.phase === 'public') {
    const mode = AUTH_ROUTES[path]
    if (mode) return <Auth key={mode} mode={mode} trialDays={boot.plan.trial_days} onDone={load} />
    return <Landing plan={boot.plan} />
  }

  // já logado e numa rota de login/cadastro: vai pro app
  if (AUTH_ROUTES[path]) navigate('/')

  const Page = PAGES[path] ?? Dashboard
  return (
    <StoreProvider
      initial={boot.state}
      onSignedOut={() => {
        navigate('/')
        load()
      }}
    >
      <Layout>
        <Page />
      </Layout>
      <FormHost />
      <SetupHost />
      <Paywall />
    </StoreProvider>
  )
}
