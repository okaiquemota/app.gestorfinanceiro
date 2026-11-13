// Telas públicas (sem login): apresentação do produto, termos e privacidade.

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { brl } from '../lib/format.ts'
import { SITE, orTBD } from '../lib/site.ts'
import { Link } from '../router.tsx'
import { Emoji, cx } from '../ui.tsx'

export type PublicPlan = { price_cents: number; trial_days: number; billing_enabled: boolean; email_enabled: boolean }

const CTA =
  'inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-lead font-semibold text-on-primary transition-colors hover:bg-primary-hover'

function Header({ authenticated }: { authenticated?: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
      <Link href="/" className="flex items-center gap-2.5">
        <Emoji name="mascote" size={40} />
        <span className="text-xl font-semibold tracking-[-0.02em]">{SITE.name}</span>
      </Link>
      <nav aria-label="Conta" className="flex items-center gap-2">
        {authenticated ? (
          <Link href="/" className={cx(CTA, '!h-10 !px-4 !text-sm')}>
            Abrir o app
          </Link>
        ) : (
          <>
            <Link href="/entrar" className="flex h-10 items-center rounded-xl px-4 text-sm font-semibold hover:bg-sunken">
              Entrar
            </Link>
            <Link href="/criar-conta" className={cx(CTA, '!h-10 !px-4 !text-sm')}>
              Criar conta
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-6 text-caption text-muted">
      <span>
        © {new Date().getFullYear()} {SITE.name}
      </span>
      <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/termos" className="hover:text-fg">
          Termos de uso
        </Link>
        <Link href="/privacidade" className="hover:text-fg">
          Privacidade
        </Link>
        {SITE.supportEmail && (
          <a href={`mailto:${SITE.supportEmail}`} className="hover:text-fg">
            Contato
          </a>
        )}
      </nav>
    </footer>
  )
}

const FEATURES: [string, string, string][] = [
  ['mascote-moeda', 'Quanto sobra no mês', 'Renda menos contas, cartões e gasto do dia a dia, numa conta só e sempre atualizada.'],
  ['calendar-spiral', 'Contas por dia de vencimento', 'O que vence em cada dia, o que já foi pago e o que está atrasado.'],
  ['card', 'Cartões sem surpresa', 'Compras parceladas e assinaturas caem na fatura certa, e você vê as próximas faturas.'],
  ['chart-up', 'Os próximos 12 meses', 'Uma projeção mês a mês pra saber onde o dinheiro aperta antes de apertar.'],
  ['money-bag', 'Reserva com metas', 'Metas com valor e prazo, e quanto guardar por mês pra chegar lá.'],
  ['phone', 'No computador e no celular', 'Abre no navegador, com tema claro e escuro. Não precisa instalar nada.'],
]

const FAQ: [string, ReactNode][] = [
  [
    'O Poupin se conecta ao meu banco?',
    'Não. Você mesmo cadastra renda, contas e cartões. O Poupin nunca pede senha de banco nem acesso à sua conta bancária.',
  ],
  [
    'Meus dados ficam seguros?',
    'Seus dados ficam na sua conta, protegida por senha, e a conexão é sempre criptografada. Você pode baixar uma cópia de tudo ou excluir a conta quando quiser, direto nos Ajustes.',
  ],
  [
    'Preciso de cartão de crédito pra testar?',
    'Não. O teste começa quando você cria a conta, sem informar nenhum meio de pagamento.',
  ],
  [
    'E se eu não quiser continuar?',
    'Você não é cobrado. Ao fim do teste a conta fica só para consulta: dá pra ver e exportar tudo, mas não lançar coisas novas, até você assinar ou excluir a conta.',
  ],
]

export function Landing({ plan, authenticated }: { plan: PublicPlan; authenticated?: boolean }) {
  const start = authenticated ? '/' : '/criar-conta'
  return (
    <div className="min-h-(--app-vh)">
      <Header authenticated={authenticated} />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-8 pt-6 md:grid-cols-[1.1fr_0.9fr] md:pt-12">
          <div>
            <h1 className="text-[clamp(2rem,6vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
              Saiba quanto sobra antes do mês acabar.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              O {SITE.name} junta sua renda, suas contas e as faturas dos cartões numa tela só, e mostra o que vence, o que
              já foi pago e quanto vai sobrar.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href={start} className={CTA}>
                {authenticated ? 'Abrir o app' : `Testar grátis por ${plan.trial_days} dias`}
              </Link>
              {!authenticated && <span className="text-caption text-muted">Sem cartão de crédito.</span>}
            </div>
          </div>
          <Emoji
            name="mascote-oi"
            size={320}
            className="mascot mx-auto !h-auto !w-[min(320px,70%)] drop-shadow-[0_24px_28px_rgb(0_0_0/0.18)]"
          />
        </section>

        <section className="mx-auto max-w-6xl px-5">
          <img
            src="/tela.webp"
            alt={`Tela de visão geral do ${SITE.name}: saldo previsto, contas a pagar, categorias de gasto e cartões`}
            width={1440}
            height={900}
            loading="lazy"
            className="w-full rounded-panel border border-line shadow-pop"
          />
        </section>

        <section aria-labelledby="recursos" className="mx-auto mt-16 max-w-6xl px-5">
          <h2 id="recursos" className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            O mês inteiro, de uma vez
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([emoji, title, text]) => (
              <li key={title} className="rounded-panel border border-line bg-surface p-5 shadow-card">
                <Emoji name={emoji} size={48} />
                <h3 className="mt-3 text-lead font-semibold">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="preco" className="mx-auto mt-16 max-w-6xl px-5">
          <h2 id="preco" className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Um plano só, com tudo
          </h2>
          <div className="mt-6 grid gap-6 rounded-panel border border-line bg-surface p-6 shadow-card md:grid-cols-2 md:p-8">
            <div>
              <p className="font-semibold text-accent">{plan.trial_days} dias grátis</p>
              {plan.billing_enabled ? (
                <p className="mt-2">
                  <span className="tnum text-5xl font-semibold tracking-[-0.03em]">{brl(plan.price_cents)}</span>
                  <span className="text-muted"> por mês</span>
                </p>
              ) : (
                <p className="mt-2 text-3xl font-semibold tracking-[-0.02em]">Grátis no lançamento</p>
              )}
              <p className="mt-2 text-muted">
                {plan.billing_enabled
                  ? 'Depois do teste, pague por Pix, cartão ou boleto pelo Mercado Pago. Cancele quando quiser.'
                  : 'A assinatura ainda não foi aberta. Enquanto isso, o uso é gratuito.'}
              </p>
              <Link href={start} className={cx(CTA, 'mt-5')}>
                {authenticated ? 'Abrir o app' : 'Começar agora'}
              </Link>
            </div>
            <ul className="space-y-2.5">
              {[
                'Contas, rendas e cartões sem limite',
                'Projeção dos próximos 12 meses',
                'Metas de reserva',
                'Computador e celular',
                'Cópia dos seus dados quando quiser',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-good-soft text-good">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="duvidas" className="mx-auto mt-16 max-w-3xl px-5">
          <h2 id="duvidas" className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Dúvidas comuns
          </h2>
          <div className="mt-4 divide-y divide-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex list-none items-center justify-between gap-4 text-lead font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="text-2xl font-normal text-faint transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

// ---------- textos legais ----------

function LegalPage({ title, children, authenticated }: { title: string; children: ReactNode; authenticated?: boolean }) {
  return (
    <div className="min-h-(--app-vh)">
      <Header authenticated={authenticated} />
      <main className="mx-auto max-w-3xl px-5 pb-8 pt-4">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 text-caption text-muted">Última atualização: {SITE.legalUpdatedAt}</p>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_p]:text-muted [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:text-muted">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

const contact = () =>
  SITE.supportEmail ? <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-accent">{SITE.supportEmail}</a> : '[e-mail de contato a definir]'

export function Terms({ plan, authenticated }: { plan: PublicPlan; authenticated?: boolean }) {
  return (
    <LegalPage title="Termos de uso" authenticated={authenticated}>
      <section>
        <h2>1. O serviço</h2>
        <p>
          O {SITE.name} é um aplicativo de organização financeira pessoal oferecido por {orTBD(SITE.owner)}, inscrito sob o nº{' '}
          {orTBD(SITE.ownerDocument)} (“nós”). Ele permite cadastrar rendas, contas, cartões de crédito e metas, e calcula
          estimativas a partir do que você informa.
        </p>
        <p>
          O {SITE.name} não é instituição financeira, não movimenta dinheiro, não se conecta a contas bancárias e não presta
          consultoria financeira, contábil ou de investimentos. Os valores mostrados são estimativas e dependem dos dados que
          você cadastra.
        </p>
      </section>
      <section>
        <h2>2. Sua conta</h2>
        <p>
          Para usar o serviço você cria uma conta com nome, e-mail e senha. Você é responsável por manter a senha em sigilo e
          por tudo que for feito na sua conta. É preciso ter 18 anos ou mais, ou a autorização de um responsável.
        </p>
      </section>
      <section>
        <h2>3. Teste grátis e assinatura</h2>
        <p>
          Toda conta nova tem {plan.trial_days} dias de teste gratuito, sem necessidade de informar meio de pagamento. Ao fim
          do teste, para continuar cadastrando e alterando dados é preciso assinar o plano mensal, cobrado por meio do Mercado
          Pago no valor informado na página de preços no momento da contratação.
        </p>
        <p>
          A assinatura se renova automaticamente a cada mês até ser cancelada. Você pode cancelar a qualquer momento nos
          Ajustes; o acesso continua até o fim do período já pago e não há cobrança de multa. Sem assinatura ativa, a conta
          fica disponível apenas para consulta e exportação dos dados.
        </p>
        <p>
          Em contratações feitas pela internet você pode desistir em até 7 dias a contar da contratação, com devolução do
          valor pago, conforme o art. 49 do Código de Defesa do Consumidor. Para isso, fale conosco em {contact()}.
        </p>
        <p>Mudanças de preço serão avisadas com antecedência mínima de 30 dias e só valem para as cobranças seguintes.</p>
      </section>
      <section>
        <h2>4. Uso adequado</h2>
        <ul>
          <li>Não use o serviço para fins ilegais nem tente acessar dados de outras pessoas.</li>
          <li>Não tente burlar limites técnicos, sobrecarregar o serviço ou explorar falhas de segurança.</li>
          <li>Não revenda nem ofereça o serviço a terceiros sem a nossa autorização.</li>
        </ul>
        <p>Contas que descumprirem estes termos podem ser suspensas ou encerradas.</p>
      </section>
      <section>
        <h2>5. Seus dados</h2>
        <p>
          Os dados que você cadastra são seus. Você pode baixar uma cópia ou excluir a conta a qualquer momento nos Ajustes. O
          tratamento de dados pessoais segue a nossa{' '}
          <Link href="/privacidade" className="font-semibold text-accent">
            política de privacidade
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>6. Disponibilidade e responsabilidade</h2>
        <p>
          Trabalhamos para manter o serviço funcionando e os dados íntegros, mas ele é oferecido “como está”, e podem ocorrer
          interrupções, manutenções ou erros. Recomendamos conferir os valores com os documentos originais (faturas, boletos,
          extratos) antes de tomar decisões. Na medida permitida pela lei, não respondemos por prejuízos decorrentes de
          decisões tomadas com base nas estimativas do aplicativo, nem por dados cadastrados incorretamente.
        </p>
      </section>
      <section>
        <h2>7. Mudanças nestes termos</h2>
        <p>
          Podemos atualizar estes termos. Mudanças relevantes serão avisadas dentro do aplicativo ou por e-mail. Continuar
          usando o serviço depois do aviso significa que você concorda com a nova versão.
        </p>
      </section>
      <section>
        <h2>8. Contato e foro</h2>
        <p>
          Dúvidas e solicitações: {contact()}. Estes termos são regidos pelas leis brasileiras. Fica eleito o foro de{' '}
          {orTBD(SITE.jurisdiction)}, sem prejuízo do direito do consumidor de acionar o foro do seu domicílio.
        </p>
      </section>
    </LegalPage>
  )
}

export function Privacy({ authenticated }: { authenticated?: boolean }) {
  return (
    <LegalPage title="Política de privacidade" authenticated={authenticated}>
      <section>
        <h2>1. Quem trata seus dados</h2>
        <p>
          O controlador dos dados pessoais tratados no {SITE.name} é {orTBD(SITE.owner)}, inscrito sob o nº{' '}
          {orTBD(SITE.ownerDocument)}. Contato para assuntos de privacidade (encarregado): {contact()}.
        </p>
      </section>
      <section>
        <h2>2. Quais dados tratamos</h2>
        <ul>
          <li>
            <strong className="text-fg">Cadastro:</strong> nome, e-mail e senha. A senha é guardada apenas em forma de código
            irreversível (hash); não temos como lê-la.
          </li>
          <li>
            <strong className="text-fg">Dados financeiros que você informa:</strong> rendas, contas, cartões (nome, limite,
            dias de fechamento e vencimento e, se você quiser, os 4 últimos dígitos), compras, faturas e metas. Não pedimos
            número completo de cartão, senha de banco nem acesso à sua conta bancária.
          </li>
          <li>
            <strong className="text-fg">Assinatura:</strong> situação do plano e identificador da assinatura no Mercado Pago.
            Os dados de pagamento (cartão, Pix, boleto) são informados diretamente ao Mercado Pago e não passam por nós.
          </li>
          <li>
            <strong className="text-fg">Dados técnicos:</strong> endereço IP, usado para limitar tentativas de login e proteger
            o serviço, e registros de erro do servidor.
          </li>
        </ul>
      </section>
      <section>
        <h2>3. Para que usamos e com qual base legal</h2>
        <ul>
          <li>Prestar o serviço e manter sua conta: execução do contrato (LGPD, art. 7º, V).</li>
          <li>Cobrar a assinatura: execução do contrato e cumprimento de obrigações legais e fiscais (art. 7º, II e V).</li>
          <li>Segurança, prevenção a fraude e a abuso: legítimo interesse (art. 7º, IX).</li>
          <li>Enviar e-mails necessários ao serviço, como o de recuperação de senha: execução do contrato.</li>
        </ul>
        <p>Não vendemos seus dados e não os usamos para publicidade.</p>
      </section>
      <section>
        <h2>4. Com quem compartilhamos</h2>
        <ul>
          <li>
            <strong className="text-fg">Cloudflare:</strong> hospedagem do aplicativo e do banco de dados.
          </li>
          <li>
            <strong className="text-fg">Mercado Pago:</strong> processamento dos pagamentos da assinatura.
          </li>
          <li>
            <strong className="text-fg">Resend:</strong> envio dos e-mails do serviço.
          </li>
        </ul>
        <p>
          Esses fornecedores tratam os dados apenas para prestar o serviço contratado. Parte deles armazena dados em servidores
          fora do Brasil (o banco de dados fica nos Estados Unidos), o que configura transferência internacional de dados,
          feita com base nas garantias contratuais oferecidas por esses fornecedores (LGPD, art. 33). Também podemos
          compartilhar dados quando a lei ou uma ordem de autoridade competente exigir.
        </p>
      </section>
      <section>
        <h2>5. Cookies e armazenamento no navegador</h2>
        <p>
          Usamos um único cookie, essencial, para manter você conectado. Guardamos no seu navegador a preferência de tema e se
          a configuração inicial já foi vista. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.
        </p>
      </section>
      <section>
        <h2>6. Por quanto tempo guardamos</h2>
        <p>
          Enquanto sua conta existir. Ao excluir a conta nos Ajustes, seus dados cadastrais e financeiros são apagados do banco
          de dados imediatamente. Registros que a lei obrigue a manter (por exemplo, dados fiscais de pagamentos) são guardados
          pelo prazo legal.
        </p>
      </section>
      <section>
        <h2>7. Seus direitos</h2>
        <p>Pela LGPD (art. 18) você pode, a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos ou desatualizados (direto no aplicativo);</li>
          <li>baixar uma cópia dos seus dados (Ajustes → Baixar backup);</li>
          <li>excluir sua conta e seus dados (Ajustes → Excluir conta);</li>
          <li>pedir informações sobre com quem compartilhamos os dados;</li>
          <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
        <p>Para qualquer um desses pedidos, escreva para {contact()}.</p>
      </section>
      <section>
        <h2>8. Segurança</h2>
        <p>
          A conexão com o aplicativo é sempre criptografada (HTTPS), as senhas são guardadas com hash e há limite de
          tentativas de login. Nenhum sistema é totalmente imune a falhas; se houver um incidente de segurança que possa
          causar risco relevante a você, avisaremos você e a ANPD, como a lei determina.
        </p>
      </section>
      <section>
        <h2>9. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política. A data no topo indica a última revisão, e mudanças relevantes serão avisadas dentro
          do aplicativo ou por e-mail.
        </p>
      </section>
    </LegalPage>
  )
}
