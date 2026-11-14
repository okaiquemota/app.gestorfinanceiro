// Assinatura: as duas formas de pagar, o aviso de teste encerrado e o rótulo do plano.

import { useState } from 'react'
import { CreditCard, QrCode } from 'lucide-react'
import type { Billing } from '../shared/types.ts'
import { api } from './lib/api.ts'
import { brl, dateBR } from './lib/format.ts'
import { useStore } from './store.tsx'
import { Button, Emoji, Modal, cx } from './ui.tsx'

type Method = 'card' | 'pix'

/** Leva a pessoa para a página do Mercado Pago, na forma de pagar escolhida. */
export const useCheckout = () => {
  const { notify } = useStore()
  const [busy, setBusy] = useState<Method | null>(null)
  const start = async (method: Method) => {
    setBusy(method)
    try {
      const { url } = await api<{ url: string }>('POST', '/billing/checkout', { method })
      window.location.href = url
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.')
      setBusy(null)
    }
  }
  return { busy, start }
}

const until = (b: Billing) => (b.paid_until ? dateBR(b.paid_until.slice(0, 10)) : '')

export const planLabel = (b: Billing): string =>
  b.status === 'lifetime'
    ? 'Acesso vitalício'
    : b.status === 'active'
      ? 'Assinatura ativa'
      : b.status === 'prepaid'
        ? `Pago até ${until(b)}`
        : b.status === 'cancelled'
          ? `Cancelada · vale até ${until(b)}`
          : b.status === 'trial'
            ? `Teste grátis · ${b.trial_days_left === 1 ? 'último dia' : `${b.trial_days_left} dias restantes`}`
            : 'Teste encerrado'

/** As duas formas de pagar, lado a lado. A conta do Mercado Pago é informada lá. */
export function PayOptions({ price, renew }: { price: number; renew?: boolean }) {
  const { busy, start } = useCheckout()
  const options: { method: Method; icon: typeof QrCode; title: string; text: string; cta: string }[] = [
    {
      method: 'card',
      icon: CreditCard,
      title: 'Cartão de crédito',
      text: `${brl(price)} por mês. Renova sozinho, e você cancela quando quiser.`,
      cta: 'Assinar no cartão',
    },
    {
      method: 'pix',
      icon: QrCode,
      title: 'Pix ou boleto',
      text: `${brl(price)} por 30 dias. Sem renovação automática: você paga de novo quando quiser continuar.`,
      cta: renew ? 'Pagar mais 30 dias' : 'Pagar 30 dias',
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map(({ method, icon: Icon, title, text, cta }) => (
        <div key={method} className="flex flex-col rounded-2xl border border-line p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Icon size={18} className="text-accent" /> {title}
          </p>
          <p className="mt-1 flex-1 text-caption text-muted">{text}</p>
          <Button
            variant={method === 'card' ? 'primary' : 'secondary'}
            className={cx('mt-3 w-full')}
            onClick={() => start(method)}
            disabled={busy !== null}
            aria-busy={busy === method}
          >
            {busy === method ? 'Abrindo…' : cta}
          </Button>
        </div>
      ))}
      <p className="text-xs text-faint sm:col-span-2">O pagamento é feito na página do Mercado Pago.</p>
    </div>
  )
}

export function Paywall() {
  const { state, paywall, closePaywall } = useStore()
  if (!paywall) return null
  const b = state.user.billing
  return (
    <Modal
      title={b.paid_until ? 'Seu acesso venceu' : 'Seu teste grátis terminou'}
      onClose={closePaywall}
      footer={
        <Button variant="ghost" onClick={closePaywall} className="ml-auto">
          Agora não
        </Button>
      }
    >
      <div className="text-center">
        <Emoji name="mascote-moeda" size={96} className="mascot mx-auto" />
        <p className="mt-3 text-muted">
          Tudo que você cadastrou continua aqui, e dá pra consultar e exportar à vontade. Pra voltar a lançar e editar, escolha
          como pagar.
        </p>
      </div>
      <PayOptions price={b.price_cents} />
    </Modal>
  )
}
