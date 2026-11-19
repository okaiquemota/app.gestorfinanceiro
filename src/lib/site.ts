// Dados do produto e de quem o oferece. Aparecem na página de apresentação,
// nos termos de uso e na política de privacidade.
//
// Dados da MovCode, os mesmos dos termos de uso e da política de privacidade
// de movcode.com.br. O site da MovCode não publica CNPJ: quando houver, é só
// preencher `ownerDocument` que ele passa a aparecer nos textos legais.

export const SITE = {
  name: 'Poupin',
  /** Quem responde pelo serviço (nome completo ou razão social). */
  owner: 'MovCode',
  /** Onde o responsável está. */
  ownerCity: 'Ribeirão Preto/SP',
  /** CPF ou CNPJ do responsável. */
  ownerDocument: '',
  /** E-mail de contato e suporte (também o canal de pedidos sobre dados pessoais). */
  supportEmail: 'contato@movcode.com.br',
  /** Encarregados pelo tratamento de dados pessoais (DPO). */
  dpo: 'Vinicius Hallal e Kaique Mota',
  /** Cidade/UF do foro, ex.: "Ribeirão Preto/SP". */
  jurisdiction: 'Ribeirão Preto/SP',
  /** Data da última revisão dos textos legais. */
  legalUpdatedAt: '19/11/2026',
}

export const orTBD = (value: string): string => value || '[a definir]'

/** "MovCode, de Ribeirão Preto/SP, CNPJ nº …" (o documento só entra quando preenchido). */
export const ownerLine = (): string =>
  [orTBD(SITE.owner), SITE.ownerCity && `de ${SITE.ownerCity}`, SITE.ownerDocument && `inscrita sob o nº ${SITE.ownerDocument}`]
    .filter(Boolean)
    .join(', ')
