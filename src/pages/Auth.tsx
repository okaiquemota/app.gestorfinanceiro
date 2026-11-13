import { useState } from 'react'
import { api } from '../lib/api.ts'
import { Button, Emoji, Field, TextInput } from '../ui.tsx'

export type AuthStatus = { authenticated: boolean; needsSetup: boolean; setupCodeRequired: boolean }

export function Auth({ status, onDone }: { status: AuthStatus; onDone: () => void }) {
  const setup = status.needsSetup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (setup) await api('POST', '/auth/signup', { name, email, password, setup_code: code })
      else await api('POST', '/auth/login', { email, password })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo deu errado.')
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <Emoji name="mascote" size={104} className="drop-shadow-[0_12px_14px_rgb(0_0_0/0.16)]" />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
            {setup ? 'Bem-vindo ao Poupin' : 'Poupin'}
          </h1>
          <p className="mt-1 text-muted">
            {setup ? 'Primeiro acesso: crie a conta que vai ser a dona deste Poupin.' : 'Entre pra ver suas contas.'}
          </p>
        </div>
        <form
          className="mt-6 space-y-4 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {setup && (
            <Field label="Seu nome">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} autoFocus />
            </Field>
          )}
          <Field label="E-mail">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus={!setup}
            />
          </Field>
          <Field label="Senha" hint={setup ? 'Pelo menos 8 caracteres.' : undefined}>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={setup ? 'new-password' : 'current-password'}
              required
              minLength={setup ? 8 : undefined}
            />
          </Field>
          {setup && status.setupCodeRequired && (
            <Field label="Código de primeiro acesso" hint="O código definido na publicação do app.">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
            </Field>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Entrando…' : setup ? 'Criar conta e entrar' : 'Entrar'}
          </Button>
        </form>
      </div>
    </main>
  )
}
