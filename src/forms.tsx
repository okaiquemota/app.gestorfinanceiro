import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import {
  addMonths,
  goalBalance,
  invoiceFor,
  invoiceMonthFor,
  monthDiff,
  occurrences,
  toISODate,
} from '../shared/finance.ts'
import type { Card, Entry, EntryKind, Goal, Purchase } from '../shared/types.ts'
import { api } from './lib/api.ts'
import { CARD_COLORS, CATEGORIES, GOAL_ICONS, category } from './lib/categories.ts'
import { brl, dayMonth, monthLong, monthLower, monthTitle } from './lib/format.ts'
import { useStore } from './store.tsx'
import {
  Amount,
  Button,
  DaySelect,
  Emoji,
  Field,
  Modal,
  MoneyInput,
  MonthSelect,
  Segmented,
  Select,
  TextInput,
  Toggle,
  cx,
} from './ui.tsx'

/** Renderiza o formulário aberto no momento (um por vez). */
export function FormHost() {
  const { form } = useStore()
  if (!form) return null
  switch (form.type) {
    case 'entry':
      return <EntryForm key={form.entry?.id ?? 'new'} {...form} />
    case 'occurrence':
      return <OccurrenceForm {...form} />
    case 'card':
      return <CardForm card={form.card} />
    case 'purchase':
      return <PurchaseForm {...form} />
    case 'invoice':
      return <InvoiceForm {...form} />
    case 'goal':
      return <GoalForm goal={form.goal} />
    case 'move':
      return <MoveForm {...form} />
  }
}

/** Estado de "salvando" + fechar ao concluir, comum a todos os formulários. */
const useSubmit = () => {
  const { run, closeForm } = useStore()
  const [busy, setBusy] = useState(false)
  const submit = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    const ok = await run(fn)
    setBusy(false)
    if (ok) closeForm()
  }
  return { busy, submit }
}

function Footer({
  busy,
  disabled,
  label = 'Salvar',
  onDelete,
  extra,
}: {
  busy: boolean
  disabled?: boolean
  label?: string
  onDelete?: () => void
  extra?: ReactNode
}) {
  const { closeForm } = useStore()
  const [confirming, setConfirming] = useState(false)
  if (confirming)
    return (
      <>
        <span className="mr-auto text-sm font-semibold">Excluir de vez?</span>
        <Button onClick={() => setConfirming(false)}>Não</Button>
        <Button variant="primary" className="!bg-bad hover:!bg-bad" onClick={onDelete} disabled={busy}>
          Sim, excluir
        </Button>
      </>
    )
  return (
    <>
      {onDelete && (
        <Button variant="danger" onClick={() => setConfirming(true)} aria-label="Excluir" className="mr-auto !px-3">
          <Trash2 size={16} />
          <span className="hidden sm:inline">Excluir</span>
        </Button>
      )}
      {extra}
      <Button onClick={closeForm} className={cx(!onDelete && !extra && 'ml-auto')}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" disabled={busy || disabled}>
        {busy ? 'Salvando…' : label}
      </Button>
    </>
  )
}

function CategoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Categoria" className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={c.id === value}
          onClick={() => onChange(c.id)}
          className={cx(
            'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-semibold leading-tight transition-colors',
            c.id === value
              ? 'border-primary bg-primary-soft text-fg'
              : 'border-line text-muted hover:border-line-strong hover:text-fg',
          )}
        >
          <Emoji name={c.emoji} size={26} />
          {c.label}
        </button>
      ))}
    </div>
  )
}

// ---------- renda / conta ----------

type Repeat = 'monthly' | 'installments' | 'once'

const repeatOf = (e?: Entry): Repeat =>
  !e || e.end_month === null ? 'monthly' : e.end_month === e.start_month ? 'once' : 'installments'

function EntryForm({ kind, entry, preset }: { kind: EntryKind; entry?: Entry; preset?: Partial<Entry> }) {
  const { state, month, closeForm } = useStore()
  const { busy, submit } = useSubmit()
  const base = { ...preset, ...entry }
  const income = kind === 'income'

  const [name, setName] = useState(base.name ?? '')
  const [amount, setAmount] = useState(base.amount_cents ?? 0)
  const [cat, setCat] = useState(base.category ?? (income ? 'renda' : 'moradia'))
  const [day, setDay] = useState(base.due_day ?? 5)
  const [repeat, setRepeat] = useState<Repeat>(repeatOf(entry))
  const [start, setStart] = useState(base.start_month ?? month)
  const [count, setCount] = useState(
    entry?.end_month ? monthDiff(entry.start_month, entry.end_month) + 1 : 12,
  )
  const [estimated, setEstimated] = useState(base.estimated ?? false)
  const [goalId, setGoalId] = useState(base.goal_id ?? '')
  const [notes, setNotes] = useState(base.notes ?? '')

  const end = repeat === 'monthly' ? null : repeat === 'once' ? start : addMonths(start, Math.max(1, count) - 1)
  const payload = {
    kind,
    name,
    category: cat,
    amount_cents: amount,
    due_day: day,
    start_month: start,
    end_month: end,
    estimated,
    goal_id: cat === 'reserva' && goalId ? goalId : null,
    notes,
  }

  // "Encerrar": a conta para de aparecer a partir do mês que está na tela.
  const canEnd = entry && entry.end_month === null && entry.start_month < month
  const endIt = () =>
    submit(() => api('PUT', `/entries/${entry!.id}`, { ...entry, end_month: addMonths(month, -1) }))

  return (
    <Modal
      title={entry ? (income ? 'Editar renda' : 'Editar conta') : income ? 'Nova renda' : 'Nova conta'}
      onClose={closeForm}
      onSubmit={() =>
        submit(() => (entry ? api('PUT', `/entries/${entry.id}`, payload) : api('POST', '/entries', payload)))
      }
      footer={
        <Footer
          busy={busy}
          disabled={!name.trim() || amount <= 0}
          onDelete={entry ? () => submit(() => api('DELETE', `/entries/${entry.id}`)) : undefined}
          extra={
            canEnd ? (
              <Button variant="ghost" onClick={endIt} title={`Para de aparecer a partir de ${monthLong(month)}`}>
                Encerrar
              </Button>
            ) : undefined
          }
        />
      }
    >
      <MoneyInput cents={amount} onChange={setAmount} autoFocus={!entry} large />
      <Field label={income ? 'De onde vem' : 'Nome da conta'}>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={income ? 'Ex.: Salário' : 'Ex.: Aluguel'}
          maxLength={120}
        />
      </Field>

      {!income && (
        <Field label="Categoria" group>
          <CategoryPicker value={cat} onChange={setCat} />
        </Field>
      )}

      <Field label="Repetição" group>
        <Segmented
          value={repeat}
          onChange={setRepeat}
          options={[
            { value: 'monthly', label: 'Todo mês' },
            { value: 'installments', label: income ? 'Por um tempo' : 'Parcelada' },
            { value: 'once', label: 'Só uma vez' },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={income ? 'Cai no' : 'Vence no'}>
          <DaySelect value={day} onChange={setDay} />
        </Field>
        {repeat === 'installments' && (
          <Field label={income ? 'Quantos meses' : 'Nº de parcelas'}>
            <TextInput
              type="number"
              inputMode="numeric"
              min={2}
              max={480}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </Field>
        )}
      </div>

      <Field
        group
        label={repeat === 'once' ? 'Mês' : repeat === 'installments' ? 'Primeira em' : 'A partir de'}
        hint={
          repeat === 'installments' && end
            ? `${Math.max(1, count)}× de ${brl(amount)} — última em ${monthLong(end)}.`
            : undefined
        }
      >
        <MonthSelect value={start} onChange={setStart} />
      </Field>

      {!income && (
        <Toggle
          checked={estimated}
          onChange={setEstimated}
          label="Valor varia todo mês"
          hint="Ex.: luz, água. O valor acima vira estimativa e você ajusta mês a mês."
        />
      )}

      {cat === 'reserva' && state.goals.length > 0 && (
        <Field label="Guardar em qual meta?" hint="Ao marcar como paga, o valor entra direto na meta.">
          <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Nenhuma</option>
            {state.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Observação (opcional)">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </Field>
    </Modal>
  )
}

// ---------- uma conta/renda em um mês específico ----------

function OccurrenceForm({ entryId, month }: { entryId: string; month: string }) {
  const { state, openForm, closeForm } = useStore()
  const { busy, submit } = useSubmit()
  const occ = occurrences(state, month).find((o) => o.entry.id === entryId)
  const [amount, setAmount] = useState(occ?.amount ?? 0)
  const [paid, setPaid] = useState(occ?.paid ?? false)
  const [skipped, setSkipped] = useState(occ?.skipped ?? false)
  if (!occ) return null
  const { entry } = occ
  const income = entry.kind === 'income'

  return (
    <Modal
      title={entry.name}
      onClose={closeForm}
      onSubmit={() =>
        submit(() =>
          api('PUT', `/entries/${entry.id}/months/${month}`, {
            // igual ao valor padrão = sem ajuste
            amount_cents: amount === entry.amount_cents ? null : amount,
            paid: paid && !skipped,
            skipped,
          }),
        )
      }
      footer={
        <Footer
          busy={busy}
          extra={
            <Button variant="ghost" className="mr-auto" onClick={() => openForm({ type: 'entry', kind: entry.kind, entry })}>
              Editar {income ? 'renda' : 'conta'}
            </Button>
          }
        />
      }
    >
      <p className="-mt-2 text-muted">
        {category(entry.category).label} · {income ? 'cai' : 'vence'} em {dayMonth(month, occ.day)}
        {occ.installment && ` · parcela ${occ.installment.n} de ${occ.installment.total}`}
      </p>
      <Field
        label={`Valor em ${monthLower(month)}`}
        hint={
          amount !== entry.amount_cents ? (
            <>
              Vale só para este mês. O valor padrão é {brl(entry.amount_cents)}.{' '}
              <button type="button" className="font-semibold text-primary" onClick={() => setAmount(entry.amount_cents)}>
                Voltar ao padrão
              </button>
            </>
          ) : entry.estimated ? (
            'Estimativa. Quando a conta chegar, coloque o valor certo aqui.'
          ) : undefined
        }
      >
        <MoneyInput cents={amount} onChange={setAmount} large />
      </Field>
      <Toggle
        checked={paid && !skipped}
        onChange={(v) => {
          setPaid(v)
          if (v) setSkipped(false)
        }}
        label={income ? 'Já recebi' : 'Já paguei'}
      />
      <Toggle
        checked={skipped}
        onChange={setSkipped}
        label={`Não tem em ${monthLower(month)}`}
        hint="Tira do mês sem mexer nos outros."
      />
      {entry.notes && <p className="rounded-xl bg-sunken px-3 py-2 text-sm text-muted">{entry.notes}</p>}
    </Modal>
  )
}

// ---------- cartão ----------

function CardForm({ card }: { card?: Card }) {
  const { closeForm } = useStore()
  const { busy, submit } = useSubmit()
  const [name, setName] = useState(card?.name ?? '')
  const [color, setColor] = useState(card?.color ?? 'graphite')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [limit, setLimit] = useState(card?.limit_cents ?? 0)
  const [closing, setClosing] = useState(card?.closing_day ?? 28)
  const [due, setDue] = useState(card?.due_day ?? 5)
  const payload = { name, color, last4, limit_cents: limit, closing_day: closing, due_day: due }

  return (
    <Modal
      title={card ? 'Editar cartão' : 'Novo cartão'}
      onClose={closeForm}
      onSubmit={() =>
        submit(() => (card ? api('PUT', `/cards/${card.id}`, payload) : api('POST', '/cards', payload)))
      }
      footer={
        <Footer
          busy={busy}
          disabled={!name.trim() || (last4 !== '' && last4.length !== 4)}
          onDelete={card ? () => submit(() => api('DELETE', `/cards/${card.id}`)) : undefined}
        />
      }
    >
      <Field label="Nome do cartão">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Nubank, Santander Unique"
          maxLength={40}
          autoFocus={!card}
        />
      </Field>
      <Field label="Cor" group>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {Object.entries(CARD_COLORS).map(([id, c]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === color}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColor(id)}
              style={{ background: c.bg }}
              className={cx(
                'h-9 w-12 rounded-lg ring-offset-2 ring-offset-surface transition-shadow',
                id === color && 'ring-2 ring-primary',
              )}
            />
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha no">
          <DaySelect value={closing} onChange={setClosing} />
        </Field>
        <Field label="Vence no">
          <DaySelect value={due} onChange={setDue} />
        </Field>
      </div>
      <Field label="Limite total">
        <MoneyInput cents={limit} onChange={setLimit} />
      </Field>
      <Field label="Final do cartão (opcional)" hint="Só os 4 últimos dígitos, pra você reconhecer.">
        <TextInput
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="0000"
        />
      </Field>
    </Modal>
  )
}

// ---------- compra no cartão ----------

type PurchaseMode = 'single' | 'installments' | 'recurring'

function PurchaseForm({ purchase, cardId }: { purchase?: Purchase; cardId?: string }) {
  const { state, closeForm } = useStore()
  const { busy, submit } = useSubmit()
  const [card, setCard] = useState(purchase?.card_id ?? cardId ?? state.cards[0]?.id ?? '')
  const [desc, setDesc] = useState(purchase?.description ?? '')
  const [amount, setAmount] = useState(purchase?.amount_cents ?? 0)
  const [mode, setMode] = useState<PurchaseMode>(
    purchase?.recurring ? 'recurring' : (purchase?.installments ?? 1) > 1 ? 'installments' : 'single',
  )
  const [count, setCount] = useState(Math.max(2, purchase?.installments ?? 2))
  const [cat, setCat] = useState(purchase?.category ?? 'compras')
  const [date, setDate] = useState(purchase?.purchased_at ?? toISODate(new Date()))
  // null = seguir a data da compra; preenchido = o usuário escolheu a fatura na mão
  const [firstOverride, setFirstOverride] = useState<string | null>(purchase?.first_month ?? null)

  const cardObj = state.cards.find((c) => c.id === card)
  const first = firstOverride ?? (cardObj && date ? invoiceMonthFor(cardObj, date) : date.slice(0, 7))
  const n = mode === 'installments' ? Math.max(2, count) : 1

  const payload = {
    card_id: card,
    description: desc,
    category: cat,
    amount_cents: amount,
    installments: n,
    recurring: mode === 'recurring',
    first_month: first,
    end_month: mode === 'recurring' ? (purchase?.end_month ?? null) : null,
    purchased_at: date || null,
  }

  return (
    <Modal
      title={purchase ? 'Editar compra' : 'Compra no cartão'}
      onClose={closeForm}
      onSubmit={() =>
        submit(() =>
          purchase ? api('PUT', `/purchases/${purchase.id}`, payload) : api('POST', '/purchases', payload),
        )
      }
      footer={
        <Footer
          busy={busy}
          disabled={!desc.trim() || amount <= 0 || !card}
          onDelete={purchase ? () => submit(() => api('DELETE', `/purchases/${purchase.id}`)) : undefined}
        />
      }
    >
      <MoneyInput cents={amount} onChange={setAmount} autoFocus={!purchase} large />
      <Field label="O que foi">
        <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Geladeira, Netflix" maxLength={120} />
      </Field>
      {state.cards.length > 1 && (
        <Field label="Cartão">
          <Select value={card} onChange={(e) => setCard(e.target.value)}>
            {state.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field
        group
        label="Como foi"
        hint={
          mode === 'installments'
            ? `${n}× de ${brl(Math.floor(amount / n))}`
            : mode === 'recurring'
              ? 'O valor acima é cobrado todo mês (assinatura).'
              : undefined
        }
      >
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: 'À vista' },
            { value: 'installments', label: 'Parcelada' },
            { value: 'recurring', label: 'Assinatura' },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {mode === 'installments' && (
          <Field label="Nº de parcelas">
            <TextInput
              type="number"
              inputMode="numeric"
              min={2}
              max={120}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </Field>
        )}
        <Field label="Data da compra">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setFirstOverride(null)
            }}
          />
        </Field>
      </div>
      <Field
        group
        label={mode === 'single' ? 'Entra na fatura de' : 'Primeira fatura'}
        hint={cardObj ? `Calculado pelo fechamento (dia ${cardObj.closing_day}). Mude se a fatura real for outra.` : undefined}
      >
        {first && <MonthSelect value={first} onChange={setFirstOverride} />}
      </Field>
      <Field label="Categoria" group>
        <CategoryPicker value={cat} onChange={setCat} />
      </Field>
    </Modal>
  )
}

// ---------- fatura ----------

function InvoiceForm({ cardId, month }: { cardId: string; month: string }) {
  const { state, closeForm } = useStore()
  const { busy, submit } = useSubmit()
  const card = state.cards.find((c) => c.id === cardId)
  const inv = useMemo(() => (card ? invoiceFor(state, card, month) : null), [state, card, month])
  const [manual, setManual] = useState(inv?.manual ?? false)
  const [amount, setAmount] = useState(inv?.amount ?? 0)
  const [paid, setPaid] = useState(inv?.paid ?? false)
  if (!card || !inv) return null

  return (
    <Modal
      title={`Fatura ${card.name}`}
      onClose={closeForm}
      onSubmit={() =>
        submit(() =>
          api('PUT', `/cards/${card.id}/invoices/${month}`, { amount_cents: manual ? amount : null, paid }),
        )
      }
      footer={<Footer busy={busy} />}
    >
      <p className="-mt-2 text-muted">
        {monthTitle(month)} · vence em {dayMonth(month, inv.day)}
      </p>
      <div className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2.5">
        <span className="text-muted">Soma das compras lançadas</span>
        <Amount cents={inv.computed} />
      </div>
      <Toggle
        checked={manual}
        onChange={(v) => {
          setManual(v)
          if (!v) setAmount(inv.computed)
        }}
        label="Informar o valor fechado"
        hint="Use o total que veio na fatura do banco, sem precisar lançar compra por compra."
      />
      {manual && (
        <Field label={`Valor da fatura de ${monthLower(month)}`}>
          <MoneyInput cents={amount} onChange={setAmount} large autoFocus />
        </Field>
      )}
      <Toggle checked={paid} onChange={setPaid} label="Fatura paga" />
    </Modal>
  )
}

// ---------- meta ----------

function GoalForm({ goal }: { goal?: Goal }) {
  const { closeForm, month } = useStore()
  const { busy, submit } = useSubmit()
  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'umbrella')
  const [target, setTarget] = useState(goal?.target_cents ?? 0)
  const [hasDeadline, setHasDeadline] = useState(!!goal?.deadline)
  const [deadline, setDeadline] = useState(goal?.deadline ?? addMonths(month, 12))
  const payload = { name, icon, target_cents: target, deadline: hasDeadline ? deadline : null }

  return (
    <Modal
      title={goal ? 'Editar meta' : 'Nova meta'}
      onClose={closeForm}
      onSubmit={() =>
        submit(() => (goal ? api('PUT', `/goals/${goal.id}`, payload) : api('POST', '/goals', payload)))
      }
      footer={
        <Footer
          busy={busy}
          disabled={!name.trim()}
          onDelete={goal ? () => submit(() => api('DELETE', `/goals/${goal.id}`)) : undefined}
        />
      }
    >
      <Field label="Nome">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Reserva de emergência"
          maxLength={60}
          autoFocus={!goal}
        />
      </Field>
      <Field label="Ícone" group>
        <div role="radiogroup" className="grid grid-cols-8 gap-1">
          {GOAL_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === icon}
              aria-label={i}
              onClick={() => setIcon(i)}
              className={cx(
                'flex aspect-square items-center justify-center rounded-xl border transition-colors',
                i === icon ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-sunken',
              )}
            >
              <Emoji name={i} size={28} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Quanto quer juntar" hint="Deixe zerado se não tiver um valor alvo.">
        <MoneyInput cents={target} onChange={setTarget} />
      </Field>
      <Toggle checked={hasDeadline} onChange={setHasDeadline} label="Tem prazo" />
      {hasDeadline && (
        <Field label="Até quando" group>
          <MonthSelect value={deadline} onChange={setDeadline} />
        </Field>
      )}
    </Modal>
  )
}

function MoveForm({ goalId, direction }: { goalId: string; direction: 'in' | 'out' }) {
  const { state, closeForm } = useStore()
  const { busy, submit } = useSubmit()
  const goal = state.goals.find((g) => g.id === goalId)
  const [dir, setDir] = useState(direction)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(toISODate(new Date()))
  const [note, setNote] = useState('')
  if (!goal) return null
  const balance = goalBalance(state, goal)

  return (
    <Modal
      title={goal.name}
      onClose={closeForm}
      onSubmit={() =>
        submit(() =>
          api('POST', `/goals/${goal.id}/moves`, {
            amount_cents: dir === 'in' ? amount : -amount,
            date,
            note,
          }),
        )
      }
      footer={<Footer busy={busy} disabled={amount <= 0} label={dir === 'in' ? 'Guardar' : 'Retirar'} />}
    >
      <p className="-mt-2 text-muted">Guardado até agora: {brl(balance)}</p>
      <Segmented
        value={dir}
        onChange={setDir}
        options={[
          { value: 'in', label: 'Guardar' },
          { value: 'out', label: 'Retirar' },
        ]}
      />
      <MoneyInput cents={amount} onChange={setAmount} large autoFocus />
      <Field label="Data">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Observação (opcional)">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
      </Field>
    </Modal>
  )
}
