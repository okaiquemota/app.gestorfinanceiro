import { useEffect, useState } from 'react'
import { ChevronRight, Download, LogOut } from 'lucide-react'
import { api } from '../lib/api.ts'
import { Link } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Button, Emoji, Field, Panel, Segmented, TextInput } from '../ui.tsx'

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
      notify('Senha alterada.', 'success')
    }
  }

  return (
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      {/* no celular o menu de baixo não tem "Minha renda": o atalho fica aqui, em destaque */}
      <Link
        href="/renda"
        className="flex min-h-16 items-center gap-3 rounded-panel border border-line bg-surface p-4 shadow-card hover:border-line-strong md:col-span-2 lg:hidden"
      >
        <Emoji name="banknote" size={36} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Minha renda</span>
          <span className="block text-caption text-muted">Salário, outras entradas e o gasto do dia a dia.</span>
        </span>
        <ChevronRight size={18} className="text-faint" />
      </Link>
      <Panel className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lead font-semibold">Perfil</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => api('PUT', '/me', { name, daily_budget_cents: state.user.daily_budget_cents }), { success: 'Nome salvo.' })
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
          <p className="mb-2 text-caption font-semibold text-muted">Tema</p>
          <Segmented
            label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </div>

      </Panel>

      <div className="space-y-4">
        <Panel className="p-5 sm:p-6">
          <h2 className="text-lead font-semibold">Trocar senha</h2>
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
          <h2 className="text-lead font-semibold">Seus dados</h2>
          <p className="mt-1 text-caption text-muted">Baixe uma cópia de tudo que está cadastrado, em JSON.</p>
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
