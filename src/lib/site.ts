// Dados do produto e de quem o oferece. Aparecem na página de apresentação,
// nos termos de uso e na política de privacidade.
//
// PREENCHA antes de divulgar: os campos vazios aparecem como "[a definir]"
// nos textos legais, que só valem com esses dados completos.

export const SITE = {
  name: 'Poupin',
  /** Quem responde pelo serviço (nome completo ou razão social). */
  owner: '',
  /** CPF ou CNPJ do responsável. */
  ownerDocument: '',
  /** E-mail de contato e suporte (também o canal de pedidos sobre dados pessoais). */
  supportEmail: '',
  /** Cidade/UF do foro, ex.: "Ribeirão Preto/SP". */
  jurisdiction: '',
  /** Data da última revisão dos textos legais. */
  legalUpdatedAt: '13/11/2026',
}

export const orTBD = (value: string): string => value || '[a definir]'
