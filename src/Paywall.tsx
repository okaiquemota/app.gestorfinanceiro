// Assinatura: o aviso que aparece quando o teste acaba e os controles do plano.

import { useState } from 'react'
import { Check } from 'lucide-react'
import { api } from './lib/api.ts'
import { brl, dateBR } from './lib/format.ts'
import { useStore } from './store.tsx'
import { Button, Emoji, Field, Modal, TextInput } from './ui.tsx'

/** Abre o checkout do Mercado Pago para a conta logada. */
export const useCheckout = () => {
  const { state, notify } = useStore()
  const [busy, setBusy] = useState(false)
  // o Mercado Pago cobra da conta dele com este e-mail, que pode não ser o do Poupin
  const [email, setEmail] = useState(state.user.email)
  const start = async () => {
    setBusy(true)
    try {
      const { url } = await api<{ url: string }>('POST', '/billing/checkout', { payer_email: email })
      window.location.href = url
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.')
      setBusy(false)
    }
  }
  return { busy, start, email, setEmail }
}

export function PayerEmail({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <Field label="E-mail da sua conta no Mercado Pago" hint="É com ele que você entra pra pagar. Pode ser diferente do e-mail do Poupin.">
      <TextInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
    </Field>
  )
}

export const planLabel = (b: { status: string; trial_days_left: number; paid_until: string | null }): string =>
  b.status === 'lifetime'
    ? 'Acesso vitalício'
    : b.status === 'active'
      ? 'Assinatura ativa'
      : b.status === 'cancelled'
        ? `Cancelada · vale até ${b.paid_until ? dateBR(b.paid_until.slice(0, 10)) : ''}`
        : b.status === 'trial'
          ? `Teste grátis · ${b.trial_days_left === 1 ? 'último dia' : `${b.trial_days_left} dias restantes`}`
          : 'Teste encerrado'

export function Paywall() {
  const { state, paywall, closePaywall } = useStore()
  const { busy, start, email, setEmail } = useCheckout()
  if (!paywall) return null
  const b = state.user.billing
  return (
    <Modal
      title="Seu teste grátis terminou"
      onClose={closePaywall}
      onSubmit={start}
      footer={
        <>
          <Button variant="ghost" onClick={closePaywall} className="mr-auto">
            Agora não
          </Button>
          <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Abrindo…' : 'Assinar pelo Mercado Pago'}
          </Button>
        </>
      }
    >
      <div className="text-center">
        <Emoji name="mascote-moeda" size={104} className="mascot mx-auto" />
        <p className="mt-3 text-muted">
          Tudo que você cadastrou continua aqui, e dá pra consultar e exportar à vontade. Pra voltar a lançar e editar, assine
          o Poupin.
        </p>
        <p className="mt-4">
          <span className="tnum text-4xl font-semibold tracking-[-0.03em]">{brl(b.price_cents)}</span>
          <span className="text-muted"> por mês</span>
        </p>
      </div>
      <ul className="space-y-2">
        {['Pix, cartão ou boleto', 'Cancele quando quiser, sem multa', 'Seus dados continuam seus'].map((t) => (
          <li key={t} className="flex items-center gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-good">
              <Check size={13} strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <PayerEmail email={email} setEmail={setEmail} />
    </Modal>
  )
}
