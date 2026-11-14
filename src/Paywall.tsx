// Assinatura: abrir o pagamento, o rótulo do plano e o aviso de acesso vencido.

import { useState } from 'react'
import type { Billing } from '../shared/types.ts'
import { api } from './lib/api.ts'
import { dateBR } from './lib/format.ts'
import { navigate } from './router.tsx'
import { useStore } from './store.tsx'
import { Button, Emoji, Modal } from './ui.tsx'

export type PayChoice = { period: 'month' | 'year'; method: 'card' | 'pix' }

/** Leva a pessoa para a página do Mercado Pago, no plano e na forma de pagar escolhidos. */
export const useCheckout = () => {
  const { notify } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const start = async (choice: PayChoice) => {
    setBusy(`${choice.period}-${choice.method}`)
    try {
      const { url } = await api<{ url: string }>('POST', '/billing/checkout', choice)
      window.location.href = url
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.')
      setBusy(null)
    }
  }
  return { busy, start }
}

export const paidUntil = (b: Billing): string => (b.paid_until ? dateBR(b.paid_until.slice(0, 10)) : '')

export const planLabel = (b: Billing): string =>
  b.status === 'lifetime'
    ? 'Acesso vitalício'
    : b.status === 'active'
      ? 'Assinatura mensal ativa'
      : b.status === 'prepaid'
        ? `Pago até ${paidUntil(b)}`
        : b.status === 'cancelled'
          ? `Cancelada · vale até ${paidUntil(b)}`
          : b.status === 'trial'
            ? `Teste grátis · ${b.trial_days_left === 1 ? 'último dia' : `${b.trial_days_left} dias restantes`}`
            : 'Teste encerrado'

/** Aparece quando a pessoa tenta lançar ou editar algo com o acesso vencido. */
export function Paywall() {
  const { state, paywall, closePaywall } = useStore()
  if (!paywall) return null
  const b = state.user.billing
  const go = () => {
    closePaywall()
    navigate('/assinatura')
  }
  return (
    <Modal
      title={b.paid_until ? 'Seu acesso venceu' : 'Seu teste grátis terminou'}
      onClose={closePaywall}
      onSubmit={go}
      footer={
        <>
          <Button variant="ghost" onClick={closePaywall} className="mr-auto">
            Agora não
          </Button>
          <Button type="submit" variant="primary">
            Ver planos
          </Button>
        </>
      }
    >
      <div className="text-center">
        <Emoji name="mascote-moeda" size={104} className="mascot mx-auto" />
        <p className="mt-3 text-muted">
          Tudo que você cadastrou continua aqui, e dá pra consultar e exportar à vontade. Pra voltar a lançar e editar, escolha
          um plano.
        </p>
      </div>
    </Modal>
  )
}
