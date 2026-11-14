import { useEffect, useState } from 'react'
import { ChevronRight, Download, LogOut } from 'lucide-react'
import { PayerEmail, useCheckout, planLabel } from '../Paywall.tsx'
import { api } from '../lib/api.ts'
import { brl } from '../lib/format.ts'
import { playCoin, setSoundOn, soundOn } from '../lib/fun.ts'
import { Link } from '../router.tsx'
import { useStore } from '../store.tsx'
import { Badge, Button, Emoji, Field, Panel, Segmented, TextInput, Toggle } from '../ui.tsx'

export function Settings() {
  const { state, run, theme, setTheme, logout, notify, openSetup } = useStore()
  const [name, setName] = useState(state.user.name)
  const [sound, setSound] = useState(soundOn)
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
        <div className="border-t border-line pt-4">
          <Toggle
            checked={sound}
            onChange={(on) => {
              setSound(on)
              setSoundOn(on)
              if (on) playCoin()
            }}
            label="Sons e vibração"
            hint="Moedinha ao pagar uma conta e fanfarra nas comemorações."
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

        <PlanPanel />

        <Panel className="p-5 sm:p-6">
          <h2 className="text-lead font-semibold">Configuração inicial</h2>
          <p className="mt-1 text-caption text-muted">
            O passo a passo de renda, contas, cartões e dia a dia. Nada do que já está cadastrado é apagado.
          </p>
          <Button className="mt-4" onClick={openSetup}>
            Abrir configuração inicial
          </Button>
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

        <DeleteAccountPanel />

        <p className="px-1 text-caption text-muted">
          <a href="/termos" target="_blank" rel="noreferrer" className="inline-block py-1.5 font-semibold text-accent">
            Termos de uso
          </a>{' '}
          ·{' '}
          <a href="/privacidade" target="_blank" rel="noreferrer" className="inline-block py-1.5 font-semibold text-accent">
            Política de privacidade
          </a>
        </p>
      </div>
    </div>
  )
}

function PlanPanel() {
  const { state, run, reload, notify } = useStore()
  const { busy, start, email, setEmail } = useCheckout()
  const [confirming, setConfirming] = useState(false)
  const b = state.user.billing

  // voltando do Mercado Pago: confere a assinatura sem esperar o aviso automático
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('assinatura')) return
    window.history.replaceState(null, '', '/ajustes')
    api('POST', '/billing/sync')
      .then(reload)
      .then(() => notify('Pagamento recebido? A situação da assinatura foi atualizada.', 'success'))
      .catch(() => {})
  }, [reload, notify])

  const tone = b.status === 'expired' ? 'bad' : b.status === 'trial' || b.status === 'cancelled' ? 'warn' : 'good'
  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lead font-semibold">Assinatura</h2>
        <Badge tone={tone}>{planLabel(b)}</Badge>
      </div>
      {b.status === 'lifetime' ? (
        <p className="mt-2 text-caption text-muted">Sua conta tem acesso completo, sem cobrança.</p>
      ) : !b.enabled ? (
        <p className="mt-2 text-caption text-muted">
          A assinatura ainda não foi aberta. Enquanto isso, o uso do Poupin é gratuito e nada é cobrado.
        </p>
      ) : b.status === 'active' ? (
        <>
          <p className="mt-2 text-caption text-muted">
            {brl(b.price_cents)} por mês, cobrados pelo Mercado Pago. Cancelando, o acesso continua até o fim do período já pago.
          </p>
          {confirming ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span role="alert" className="mr-auto text-sm font-semibold">
                Cancelar a assinatura?
              </span>
              <Button onClick={() => setConfirming(false)}>Não</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await run(() => api('POST', '/billing/cancel'), { success: 'Assinatura cancelada.' })
                  setConfirming(false)
                }}
              >
                Sim, cancelar
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="mt-3 !px-0 hover:!bg-transparent" onClick={() => setConfirming(true)}>
              Cancelar assinatura
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-caption text-muted">
            {b.status === 'trial'
              ? `Depois do teste, o Poupin custa ${brl(b.price_cents)} por mês. Você pode assinar agora ou quando o teste acabar.`
              : b.status === 'cancelled'
                ? 'Você pode reativar a assinatura quando quiser.'
                : `Assine por ${brl(b.price_cents)} por mês pra voltar a lançar e editar. Seus dados continuam aqui.`}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              start()
            }}
          >
            <PayerEmail email={email} setEmail={setEmail} />
            <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
              {busy ? 'Abrindo…' : 'Assinar pelo Mercado Pago'}
            </Button>
          </form>
        </>
      )}
    </Panel>
  )
}

function DeleteAccountPanel() {
  const { notify, logout } = useStore()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await api('POST', '/account/delete', { password })
      await logout()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível excluir a conta.')
      setBusy(false)
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-lead font-semibold">Excluir conta</h2>
      <p className="mt-1 text-caption text-muted">
        Apaga de vez sua conta e tudo que está cadastrado nela, e cancela a assinatura se houver. Não dá pra desfazer; baixe um
        backup antes se quiser guardar os dados.
      </p>
      {open ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            remove()
          }}
        >
          <Field label="Confirme com a sua senha">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={busy || !password}>
              {busy ? 'Excluindo…' : 'Excluir minha conta de vez'}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="danger" className="mt-3 !px-0 hover:!bg-transparent" onClick={() => setOpen(true)}>
          Quero excluir minha conta
        </Button>
      )}
    </Panel>
  )
}
