import { useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api.ts'
import { Link, navigate } from '../router.tsx'
import { PublicShell } from './Public.tsx'
import { Emoji, Field, TextInput } from '../ui.tsx'

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'

const COPY: Record<AuthMode, { title: string; lead: string; action: string; busy: string }> = {
  login: { title: 'Entrar no Poupin', lead: 'Entre pra ver suas contas.', action: 'Entrar', busy: 'Entrando…' },
  signup: { title: 'Criar sua conta', lead: '', action: 'Criar conta', busy: 'Criando…' },
  forgot: {
    title: 'Esqueci a senha',
    lead: 'Digite o e-mail da sua conta. Se ela existir, enviamos um link pra criar uma senha nova.',
    action: 'Enviar link',
    busy: 'Enviando…',
  },
  reset: { title: 'Criar nova senha', lead: 'Escolha a nova senha da sua conta.', action: 'Salvar nova senha', busy: 'Salvando…' },
}

export function Auth({ mode, trialDays, onDone }: { mode: AuthMode; trialDays: number; onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const copy = COPY[mode]

  const submit = async () => {
    if (mode === 'signup' && !accept) return setError('Para criar a conta é preciso aceitar os termos e a política de privacidade.')
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await api('POST', '/auth/login', { email, password })
      else if (mode === 'signup') await api('POST', '/auth/signup', { name, email, password, accept_terms: true })
      else if (mode === 'forgot') {
        await api('POST', '/auth/forgot', { email })
        setSent(true)
        setBusy(false)
        return
      } else {
        const token = new URLSearchParams(window.location.search).get('token') ?? ''
        await api('POST', '/auth/reset', { token, password })
      }
      navigate('/')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo deu errado.')
      setBusy(false)
    }
  }

  let footer: ReactNode
  if (mode === 'login')
    footer = (
      <>
        Ainda não tem conta?{' '}
        <Link href="/criar-conta" className="font-semibold text-accent">
          Criar conta grátis
        </Link>
      </>
    )
  else
    footer = (
      <>
        Já tem conta?{' '}
        <Link href="/entrar" className="font-semibold text-accent">
          Entrar
        </Link>
      </>
    )

  return (
    <PublicShell>
    <main className="flex min-h-(--app-vh) items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <Link href="/" aria-label="Poupin: página inicial">
            <Emoji name="mascote" size={96} className="mascot drop-shadow-[0_12px_14px_rgb(0_0_0/0.16)]" />
          </Link>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.04em]">{copy.title}</h1>
          <p className="mt-1 text-muted">
            {mode === 'signup' ? `${trialDays} dias grátis, sem cartão. Leva menos de um minuto.` : copy.lead}
          </p>
        </div>

        {sent ? (
          <div role="status" className="mt-6 rounded-panel border border-line bg-surface p-5 text-center shadow-card sm:p-6">
            <p className="font-semibold">Confira seu e-mail</p>
            <p className="mt-1 text-muted">
              Se existir uma conta com <strong className="text-fg">{email}</strong>, o link chega em instantes e vale por 1 hora.
            </p>
          </div>
        ) : (
          <form
            className="box mt-6 space-y-4 p-5 shadow-[6px_6px_0_var(--ink)] sm:p-6"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            {mode === 'signup' && (
              <Field label="Seu nome">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} autoFocus />
              </Field>
            )}
            {mode !== 'reset' && (
              <Field label="E-mail">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus={mode !== 'signup'}
                />
              </Field>
            )}
            {mode !== 'forgot' && (
              <Field label={mode === 'reset' ? 'Nova senha' : 'Senha'} hint={mode === 'login' ? undefined : 'Pelo menos 8 caracteres.'}>
                <TextInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'login' ? undefined : 8}
                  autoFocus={mode === 'reset'}
                />
              </Field>
            )}
            {mode === 'login' && (
              <p className="-mt-1 text-right text-caption">
                <Link href="/recuperar-senha" className="font-semibold text-accent">
                  Esqueci a senha
                </Link>
              </p>
            )}
            {mode === 'signup' && (
              <label className="flex cursor-pointer items-start gap-2.5 text-caption text-muted">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-(--primary)"
                />
                <span>
                  Li e aceito os{' '}
                  <a href="/termos" target="_blank" rel="noreferrer" className="font-semibold text-accent">
                    termos de uso
                  </a>{' '}
                  e a{' '}
                  <a href="/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-accent">
                    política de privacidade
                  </a>
                  .
                </span>
              </label>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
                {error}
              </p>
            )}
            <button type="submit" className="btn-ink h-13 w-full text-base disabled:opacity-60" disabled={busy}>
              {busy ? copy.busy : copy.action}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-muted">{footer}</p>
      </div>
    </main>
    </PublicShell>
  )
}
