// Configuração inicial: um passo a passo que aparece no primeiro acesso
// (e pode ser reaberto em Ajustes). Cada passo é opcional e salva ao avançar.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from './lib/api.ts'
import { brl } from './lib/format.ts'
import { useStore } from './store.tsx'
import { Amount, Button, DaySelect, Emoji, Field, IconButton, Modal, MoneyInput, TextInput, cx } from './ui.tsx'

const DONE_KEY = 'gf-setup-done'

/** Já passou (ou pulou) a configuração inicial neste aparelho? */
export const setupSeen = (): boolean => {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
export const markSetupSeen = () => {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    // sem localStorage: a configuração pode reaparecer num próximo acesso sem dados
  }
}

type BillRow = { key: number; name: string; category: string; amount: number; day: number; estimated: boolean }
type CardRow = { key: number; name: string; closing: number; due: number }

const SUGGESTIONS: Omit<BillRow, 'key' | 'amount'>[] = [
  { name: 'Aluguel', category: 'moradia', day: 5, estimated: false },
  { name: 'Condomínio', category: 'moradia', day: 5, estimated: false },
  { name: 'Luz', category: 'moradia', day: 10, estimated: true },
  { name: 'Água', category: 'moradia', day: 10, estimated: true },
  { name: 'Internet', category: 'moradia', day: 10, estimated: false },
  { name: 'Celular', category: 'assinaturas', day: 10, estimated: false },
  { name: 'Plano de saúde', category: 'saude', day: 10, estimated: false },
  { name: 'Academia', category: 'saude', day: 10, estimated: false },
  { name: 'Streaming', category: 'assinaturas', day: 10, estimated: false },
]

const STEPS = ['Renda', 'Contas', 'Cartões', 'Dia a dia'] as const
let nextKey = 1

export function SetupWizard() {
  const { state, month, run, closeSetup } = useStore()
  // 0 = boas-vindas, 1..4 = passos, 5 = pronto
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [incomeName, setIncomeName] = useState('Salário')
  const [income, setIncome] = useState(0)
  const [incomeDay, setIncomeDay] = useState(5)
  const [bills, setBills] = useState<BillRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])
  const [daily, setDaily] = useState(state.user.daily_budget_cents)

  const firstName = state.user.name.split(' ')[0]
  const finish = () => {
    markSetupSeen()
    closeSetup()
  }

  /** Salva o passo atual (se tiver algo preenchido) e avança. */
  const next = async () => {
    setError(null)
    let work: (() => Promise<unknown>) | null = null

    if (step === 1 && income > 0) {
      work = () =>
        api('POST', '/entries', {
          kind: 'income',
          name: incomeName.trim() || 'Salário',
          category: 'renda',
          amount_cents: income,
          due_day: incomeDay,
          start_month: month,
          end_month: null,
          estimated: false,
          goal_id: null,
          notes: '',
        })
    } else if (step === 2) {
      const filled = bills.filter((b) => b.amount > 0)
      if (filled.some((b) => !b.name.trim())) return setError('Dê um nome pra cada conta com valor.')
      if (filled.length > 0)
        work = async () => {
          for (const b of filled)
            await api('POST', '/entries', {
              kind: 'expense',
              name: b.name.trim(),
              category: b.category,
              amount_cents: b.amount,
              due_day: b.day,
              start_month: month,
              end_month: null,
              estimated: b.estimated,
              goal_id: null,
              notes: '',
            })
        }
    } else if (step === 3) {
      const filled = cards.filter((c) => c.name.trim())
      if (filled.length > 0)
        work = async () => {
          for (const c of filled)
            await api('POST', '/cards', {
              name: c.name.trim(),
              color: 'graphite',
              last4: '',
              limit_cents: 0,
              closing_day: c.closing,
              due_day: c.due,
            })
        }
    } else if (step === 4 && daily !== state.user.daily_budget_cents) {
      work = () => api('PUT', '/me', { name: state.user.name, daily_budget_cents: daily })
    }

    if (work) {
      setBusy(true)
      const ok = await run(work)
      setBusy(false)
      if (!ok) return
      // o que foi salvo sai do rascunho, pra "Voltar" não salvar de novo
      if (step === 1) setIncome(0)
      if (step === 2) setBills([])
      if (step === 3) setCards([])
    }
    setStep(step + 1)
  }

  const addBill = (s?: (typeof SUGGESTIONS)[number]) =>
    setBills((list) => [
      ...list,
      { key: nextKey++, name: '', category: 'outros', day: 10, estimated: false, ...s, amount: 0 },
    ])
  const setBill = (key: number, patch: Partial<BillRow>) =>
    setBills((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)))
  const setCard = (key: number, patch: Partial<CardRow>) =>
    setCards((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const savedIncome = state.entries.filter((e) => e.kind === 'income')
  const savedBills = state.entries.filter((e) => e.kind === 'expense')
  const incomeTotal = savedIncome.reduce((s, e) => s + e.amount_cents, 0)
  const billsTotal = savedBills.reduce((s, e) => s + e.amount_cents, 0)
  const usedNames = new Set([...bills.map((b) => b.name), ...savedBills.map((e) => e.name)])

  let title = 'Configuração inicial'
  let body: ReactNode
  let primary = 'Continuar'

  if (step === 0) {
    primary = 'Começar'
    body = (
      <div className="text-center">
        <Emoji name="mascote-oi" size={104} className="mx-auto" />
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.01em]">Oi, {firstName}! Eu sou o Poupin. Vamos deixar tudo pronto?</h3>
        <p className="mx-auto mt-1 max-w-xs text-muted">
          São 4 passos rápidos. Dá pra pular qualquer um e completar depois.
        </p>
        <ol className="mt-5 space-y-2 text-left">
          {[
            ['banknote', 'Sua renda', 'Quanto entra por mês.'],
            ['receipt', 'Suas contas', 'Aluguel, luz, internet e o que mais for fixo.'],
            ['card', 'Seus cartões', 'Pra fatura entrar na conta do mês.'],
            ['coin', 'Gasto do dia a dia', 'Mercado, gasolina, lanche.'],
          ].map(([emoji, name, text]) => (
            <li key={name} className="flex items-center gap-3 rounded-2xl bg-sunken px-3 py-2.5">
              <Emoji name={emoji} size={32} />
              <span>
                <span className="block font-semibold">{name}</span>
                <span className="block text-caption text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  } else if (step === 1) {
    title = 'Sua renda'
    body = (
      <>
        <Lead emoji="banknote">Quanto você recebe por mês? É daqui que sai a conta de quanto sobra.</Lead>
        {savedIncome.length > 0 && <Saved items={savedIncome.map((e) => [e.name, e.amount_cents])} />}
        <Field label={savedIncome.length > 0 ? 'Outra renda (opcional)' : 'Valor por mês'}>
          <MoneyInput cents={income} onChange={setIncome} large autoFocus />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="De onde vem">
            <TextInput value={incomeName} onChange={(e) => setIncomeName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Cai no">
            <DaySelect value={incomeDay} onChange={setIncomeDay} />
          </Field>
        </div>
      </>
    )
  } else if (step === 2) {
    title = 'Suas contas'
    body = (
      <>
        <Lead emoji="receipt">
          Toque nas contas que você paga todo mês e coloque o valor. As que variam (luz, água) entram como estimativa.
        </Lead>
        {savedBills.length > 0 && <Saved items={savedBills.map((e) => [e.name, e.amount_cents])} />}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sugestões de contas">
          {SUGGESTIONS.filter((s) => !usedNames.has(s.name)).map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => addBill(s)}
              className="flex h-9 items-center gap-1 rounded-full border border-line-strong px-3 text-caption font-semibold hover:border-accent hover:bg-primary-soft"
            >
              <Plus size={14} /> {s.name}
            </button>
          ))}
        </div>
        {bills.map((b) => (
          <div key={b.key} className="rounded-2xl border border-line p-3">
            <div className="flex items-center gap-2">
              <TextInput
                aria-label="Nome da conta"
                placeholder="Nome da conta"
                value={b.name}
                onChange={(e) => setBill(b.key, { name: e.target.value })}
                maxLength={120}
              />
              <IconButton label={`Remover ${b.name || 'conta'}`} onClick={() => setBills((l) => l.filter((x) => x.key !== b.key))}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <MoneyInput cents={b.amount} onChange={(amount) => setBill(b.key, { amount })} ariaLabel={`Valor de ${b.name || 'conta'}`} />
              <div className="w-28">
                <DaySelect value={b.day} onChange={(day) => setBill(b.key, { day })} />
              </div>
            </div>
          </div>
        ))}
        <Button onClick={() => addBill()} className="w-full">
          <Plus size={16} /> Outra conta
        </Button>
      </>
    )
  } else if (step === 3) {
    title = 'Seus cartões'
    body = (
      <>
        <Lead emoji="card">
          Com o dia de fechamento e de vencimento, cada compra cai na fatura certa. Limite e cor você ajusta depois.
        </Lead>
        {state.cards.length > 0 && (
          <Saved items={state.cards.map((c) => [c.name, null])} label="Já cadastrados" />
        )}
        {cards.map((c) => (
          <div key={c.key} className="rounded-2xl border border-line p-3">
            <div className="flex items-center gap-2">
              <TextInput
                aria-label="Nome do cartão"
                placeholder="Ex.: Nubank"
                value={c.name}
                onChange={(e) => setCard(c.key, { name: e.target.value })}
                maxLength={40}
                autoFocus
              />
              <IconButton label={`Remover ${c.name || 'cartão'}`} onClick={() => setCards((l) => l.filter((x) => x.key !== c.key))}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Fecha no">
                <DaySelect value={c.closing} onChange={(closing) => setCard(c.key, { closing })} />
              </Field>
              <Field label="Vence no">
                <DaySelect value={c.due} onChange={(due) => setCard(c.key, { due })} />
              </Field>
            </div>
          </div>
        ))}
        <Button onClick={() => setCards((l) => [...l, { key: nextKey++, name: '', closing: 28, due: 5 }])} className="w-full">
          <Plus size={16} /> {cards.length + state.cards.length > 0 ? 'Outro cartão' : 'Adicionar cartão'}
        </Button>
      </>
    )
  } else if (step === 4) {
    title = 'Gasto do dia a dia'
    body = (
      <>
        <Lead emoji="coin">
          Quanto você separa por mês pro que não é conta fixa: mercado, gasolina, lanche, farmácia. Sai do saldo de todo mês.
        </Lead>
        <Field label="Valor por mês" hint="Pode ser um chute. Dá pra mudar quando quiser em Minha renda.">
          <MoneyInput cents={daily} onChange={setDaily} large autoFocus />
        </Field>
      </>
    )
  } else {
    title = 'Tudo pronto'
    primary = 'Ver minha visão geral'
    const left = incomeTotal - billsTotal - state.user.daily_budget_cents
    body = (
      <div className="text-center">
        <Emoji name="mascote-festa" size={104} className="mx-auto" />
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.01em]">Pronto, {firstName}!</h3>
        <dl className="mt-4 space-y-2 text-left">
          <Row label="Renda por mês" cents={incomeTotal} />
          <Row label={`Contas fixas (${savedBills.length})`} cents={-billsTotal} />
          <Row label="Dia a dia" cents={-state.user.daily_budget_cents} />
          <div className="flex items-center justify-between rounded-2xl bg-sunken px-3 py-3">
            <dt className="font-semibold">Sobra estimada</dt>
            <dd>
              <Amount cents={left} className={cx('text-lead', left < 0 ? 'text-bad' : 'text-good')} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-caption text-muted">
          {state.cards.length > 0
            ? 'As faturas dos cartões entram nessa conta assim que você lançar compras ou informar o valor da fatura.'
            : 'Você pode cadastrar cartões depois, em Adicionar.'}
        </p>
      </div>
    )
  }

  const inSteps = step >= 1 && step <= 4
  return (
    <Modal
      title={title}
      onClose={finish}
      onSubmit={step === 5 ? finish : next}
      footer={
        <>
          {error && (
            <p role="alert" className="w-full text-caption font-semibold text-bad">
              {error}
            </p>
          )}
          {step === 0 && (
            <Button variant="ghost" onClick={finish} className="mr-auto">
              Fazer depois
            </Button>
          )}
          {inSteps && (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="mr-auto" disabled={busy}>
              Voltar
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Salvando…' : primary}
          </Button>
        </>
      }
    >
      {inSteps && (
        <div>
          <p className="text-caption font-semibold text-muted">
            Passo {step} de {STEPS.length}
          </p>
          <div
            role="progressbar"
            aria-label="Progresso da configuração"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={step}
            className="mt-1.5 flex gap-1"
          >
            {STEPS.map((s, i) => (
              <span key={s} className={cx('h-1.5 flex-1 rounded-full', i < step ? 'bg-primary' : 'bg-line-strong')} />
            ))}
          </div>
        </div>
      )}
      {body}
    </Modal>
  )
}

function Lead({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Emoji name={emoji} size={40} />
      <p className="text-muted">{children}</p>
    </div>
  )
}

/** O que já está cadastrado, pra pessoa não lançar de novo. */
function Saved({ items, label = 'Já cadastrado' }: { items: [string, number | null][]; label?: string }) {
  return (
    <div className="rounded-2xl bg-sunken px-3 py-2.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <ul className="mt-1 space-y-0.5 text-caption">
        {items.map(([name, cents], i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="truncate">{name}</span>
            {cents !== null && <span className="tnum shrink-0 font-semibold">{brl(cents)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between px-3">
      <dt className="text-muted">{label}</dt>
      <dd>
        <Amount cents={cents} />
      </dd>
    </div>
  )
}
