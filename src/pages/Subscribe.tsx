// Tela de assinatura: escolher entre mensal e anual, e como pagar.

import { useState } from 'react'
import { Check, Barcode, CreditCard, ShieldCheck } from 'lucide-react'
import type { Billing } from '../../shared/types.ts'
import { paidUntil, planLabel, useCheckout } from '../Paywall.tsx'
import type { PayChoice } from '../Paywall.tsx'
import { api } from '../lib/api.ts'
import { brl } from '../lib/format.ts'
import { useStore } from '../store.tsx'
import { Badge, Button, Emoji, Panel, cx } from '../ui.tsx'

const FEATURES = [
  'Contas, rendas e cartões sem limite',
  'Projeção dos próximos 12 meses',
  'Metas de reserva e conquistas',
  'No celular e no computador',
  'Cópia dos seus dados quando quiser',
]

const INSTALLMENTS = 12

export function Subscribe() {
  const { state } = useStore()
  const b = state.user.billing
  const tone = b.status === 'expired' ? 'bad' : b.status === 'trial' || b.status === 'cancelled' ? 'warn' : 'good'
  const pose = b.status === 'expired' ? 'mascote-preocupado' : b.status === 'active' || b.status === 'prepaid' || b.status === 'lifetime' ? 'mascote-festa' : 'mascote-moeda'

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Panel className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5 sm:p-6">
        <Emoji name={pose} size={88} className="mascot" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Assinatura</h2>
            <Badge tone={tone}>{planLabel(b)}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-muted">{headline(b)}</p>
        </div>
      </Panel>

      {b.status === 'lifetime' || !b.enabled ? null : b.status === 'active' ? <ManageCard b={b} /> : <Plans b={b} />}
    </div>
  )
}

const headline = (b: Billing): string => {
  if (b.status === 'lifetime') return 'Sua conta tem acesso completo, pra sempre, sem cobrança.'
  if (!b.enabled) return 'A assinatura ainda não foi aberta. Enquanto isso, o uso do Poupin é gratuito e nada é cobrado.'
  if (b.status === 'active') return 'Tudo liberado. A cobrança é feita todo mês no seu cartão.'
  if (b.status === 'prepaid')
    return `Tudo liberado até ${paidUntil(b)} (${b.paid_days_left === 1 ? 'falta 1 dia' : `faltam ${b.paid_days_left} dias`}). Não há renovação automática: pagando de novo, o período novo soma ao que já está pago.`
  if (b.status === 'cancelled') return `Você cancelou, e o acesso continua até ${paidUntil(b)}. Dá pra voltar quando quiser.`
  if (b.status === 'trial')
    return `Você está no teste grátis, com tudo liberado (${b.trial_days_left === 1 ? 'último dia' : `faltam ${b.trial_days_left} dias`}). Pode escolher um plano agora ou quando o teste acabar. Pagando agora, o período pago começa a contar de hoje.`
  return 'Seus dados continuam aqui, só para consulta. Escolha um plano pra voltar a lançar e editar.'
}

function Plans({ b }: { b: Billing }) {
  const [period, setPeriod] = useState<'month' | 'year'>('year')
  const { busy, start } = useCheckout()
  const yearly = period === 'year'
  const saving = b.price_cents * 12 - b.annual_price_cents
  const perMonth = Math.round(b.annual_price_cents / 12)
  const pay = (choice: PayChoice) => start(choice)
  const is = (c: PayChoice) => busy === `${c.period}-${c.method}`

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <Panel className="p-5 sm:p-7">
        {/* mensal ou anual */}
        <div role="radiogroup" aria-label="Período do plano" className="grid grid-cols-2 gap-2 rounded-2xl bg-sunken p-1.5">
          {(
            [
              ['month', 'Mensal', null],
              ['year', 'Anual', saving > 0 ? `economize ${brl(saving)}` : null],
            ] as const
          ).map(([value, label, note]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => setPeriod(value)}
              className={cx(
                'flex min-h-14 flex-col items-center justify-center rounded-xl px-3 py-2 font-semibold transition-colors',
                period === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
              )}
            >
              {label}
              {note && <span className={cx('text-xs font-semibold', period === value ? 'text-good' : 'text-faint')}>{note}</span>}
            </button>
          ))}
        </div>

        {/* preço */}
        <div className="mt-7" aria-live="polite">
          {yearly ? (
            <>
              <p className="text-caption font-semibold text-accent">Plano anual</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="tnum text-[clamp(2.75rem,9vw,4rem)] font-semibold leading-none tracking-[-0.04em]">
                  {INSTALLMENTS}× {brl(perMonth)}
                </span>
              </p>
              <p className="mt-2 text-muted">
                ou <strong className="text-fg">{brl(b.annual_price_cents)}</strong> à vista. Vale por 12 meses
                {saving > 0 && <>, {brl(saving)} a menos que pagar mês a mês</>}.
              </p>
            </>
          ) : (
            <>
              <p className="text-caption font-semibold text-accent">Plano mensal</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="tnum text-[clamp(2.75rem,9vw,4rem)] font-semibold leading-none tracking-[-0.04em]">{brl(b.price_cents)}</span>
                <span className="text-lg text-muted">por mês</span>
              </p>
              <p className="mt-2 text-muted">Sem fidelidade. Cancele ou pare de pagar quando quiser.</p>
            </>
          )}
        </div>

        <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-good">
                <Check size={13} strokeWidth={3} />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </Panel>

      {/* como pagar */}
      <Panel className="flex flex-col p-5 sm:p-7">
        <h3 className="text-lead font-semibold">Como você quer pagar?</h3>
        <div className="mt-4 space-y-3">
          {yearly ? (
            <>
              <PayRow
                icon={CreditCard}
                title={`Cartão em até ${INSTALLMENTS}×`}
                text={`${INSTALLMENTS} parcelas de ${brl(perMonth)}. As opções de parcelamento do seu cartão aparecem na hora de pagar, antes de você confirmar.`}
                cta="Pagar no cartão"
                primary
                busy={is({ period: 'year', method: 'card' })}
                disabled={busy !== null}
                onClick={() => pay({ period: 'year', method: 'card' })}
              />
              <PayRow
                icon={Barcode}
                title="Boleto, à vista"
                text={`${brl(b.annual_price_cents)} de uma vez. O acesso é liberado quando o boleto compensa (até 2 dias úteis).`}
                cta="Gerar boleto"
                busy={is({ period: 'year', method: 'boleto' })}
                disabled={busy !== null}
                onClick={() => pay({ period: 'year', method: 'boleto' })}
              />
            </>
          ) : (
            <>
              <PayRow
                icon={CreditCard}
                title="Cartão, com renovação automática"
                text={`${brl(b.price_cents)} todo mês no cartão. Você cancela quando quiser, aqui mesmo.`}
                cta="Assinar no cartão"
                primary
                busy={is({ period: 'month', method: 'card' })}
                disabled={busy !== null}
                onClick={() => pay({ period: 'month', method: 'card' })}
              />
              <PayRow
                icon={Barcode}
                title="Boleto, mês a mês"
                text={`${brl(b.price_cents)} por 30 dias. Não renova sozinho: o Poupin avisa quando estiver perto de vencer.`}
                cta={b.status === 'prepaid' ? 'Pagar mais 30 dias' : 'Pagar 30 dias'}
                busy={is({ period: 'month', method: 'boleto' })}
                disabled={busy !== null}
                onClick={() => pay({ period: 'month', method: 'boleto' })}
              />
            </>
          )}
        </div>
        <p className="mt-auto flex items-start gap-2 pt-5 text-caption text-muted">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" />
          O pagamento é feito na página segura da Stripe. O Poupin não vê nem guarda os dados do seu cartão.
        </p>
      </Panel>
    </div>
  )
}

function PayRow({
  icon: Icon,
  title,
  text,
  cta,
  primary,
  busy,
  disabled,
  onClick,
}: {
  icon: typeof Barcode
  title: string
  text: string
  cta: string
  primary?: boolean
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className={cx('rounded-2xl border p-4', primary ? 'border-primary bg-primary-soft' : 'border-line')}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon size={18} className="text-accent" /> {title}
      </p>
      <p className="mt-1 text-caption text-muted">{text}</p>
      <Button variant={primary ? 'primary' : 'secondary'} className="mt-3 w-full" onClick={onClick} disabled={disabled} aria-busy={busy}>
        {busy ? 'Abrindo…' : cta}
      </Button>
    </div>
  )
}

/** Quem assina no cartão: situação e cancelamento. */
function ManageCard({ b }: { b: Billing }) {
  const { run } = useStore()
  const [confirming, setConfirming] = useState(false)
  return (
    <Panel className="p-5 sm:p-7">
      <h3 className="text-lead font-semibold">Plano mensal no cartão</h3>
      <p className="mt-1 text-muted">
        {brl(b.price_cents)} por mês, cobrados no seu cartão. Cancelando, o acesso continua até o fim do período já pago
        {b.paid_until && <> ({paidUntil(b)})</>}.
      </p>
      {confirming ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
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
        <Button variant="danger" className="mt-4 !px-0 hover:!bg-transparent" onClick={() => setConfirming(true)}>
          Cancelar assinatura
        </Button>
      )}
    </Panel>
  )
}
