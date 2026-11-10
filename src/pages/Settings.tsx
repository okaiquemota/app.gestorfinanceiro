import { useEffect, useState } from 'react'
import { Download, LogOut } from 'lucide-react'
import { api } from '../lib/api.ts'
import { Link } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Button, Field, Panel, Segmented, TextInput } from '../ui.tsx'

export function Settings() {
  const { state, run, theme, setTheme, logout, notify } = useStore()
  const [name, setName] = useState(state.user.name)
  useEffect(() => setName(state.user.name), [state.user.name])

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)

  const changePassword = async () => {
    setBusy(true)
    const ok = await run(() => api('POST', '/auth/password', { current, next }))
    setBusy(false)
    if (ok) {
      setCurrent('')
      setNext('')
      notify('Senha alterada.')
    }
  }

  return (
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      <Panel className="space-y-4 p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold">Perfil</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => api('PUT', '/me', { name, daily_budget_cents: state.user.daily_budget_cents }))
          }}
        >
          <Field label="Nome">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="E-mail">
            <TextInput value={state.user.email} disabled className="!bg-sunken !text-muted" />
          </Field>
          <Button type="submit" variant="primary" disabled={!name.trim() || name === state.user.name}>
            Salvar
          </Button>
        </form>
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-[13px] font-semibold text-muted">Tema</p>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </div>
        <Link href="/renda" className="block font-semibold text-primary lg:hidden">
          Minha renda e gasto do dia a dia →
        </Link>
      </Panel>

      <div className="space-y-4">
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Trocar senha</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              changePassword()
            }}
          >
            <Field label="Senha atual">
              <TextInput type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="Nova senha" hint="Pelo menos 8 caracteres. Trocar a senha desconecta os outros aparelhos.">
              <TextInput type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} />
            </Field>
            <Button type="submit" disabled={busy || !current || next.length < 8}>
              {busy ? 'Trocando…' : 'Trocar senha'}
            </Button>
          </form>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Seus dados</h2>
          <p className="mt-1 text-[13px] text-muted">Baixe uma cópia de tudo que está cadastrado, em JSON.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/api/export"
              download
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-4 text-sm font-semibold hover:bg-sunken"
            >
              <Download size={16} /> Baixar backup
            </a>
            <Button variant="danger" onClick={logout}>
              <LogOut size={16} /> Sair
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
