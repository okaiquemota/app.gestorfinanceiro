// Envio de e-mail (recuperação de senha) pela API do Resend.
// Só funciona com um domínio próprio verificado; sem as duas variáveis, fica desligado.

export type EmailEnv = {
  RESEND_API_KEY?: string
  /** Remetente, ex.: "Poupin <nao-responda@seudominio.com.br>". */
  EMAIL_FROM?: string
}

export const emailEnabled = (env: EmailEnv): boolean => !!env.RESEND_API_KEY && !!env.EMAIL_FROM

export const sendEmail = async (env: EmailEnv, to: string, subject: string, html: string): Promise<void> => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  })
  if (!res.ok) {
    console.error('Resend', res.status, await res.text().catch(() => ''))
    throw new Error('Falha ao enviar e-mail')
  }
}
