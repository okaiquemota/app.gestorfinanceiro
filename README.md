# Gestor financeiro

Painel pessoal pra enxergar o mês inteiro de uma vez: quanto entra, o que vence, quanto vai pro cartão e quanto sobra.

## O que tem

- **Visão geral** — saldo previsto do mês (renda − contas − cartões − dia a dia), contas a pagar por dia de vencimento, peso de cada categoria, faturas, moradia como % da renda e reserva.
- **Contas a pagar** — contas mensais, parceladas ou avulsas. Marca como paga, ajusta o valor só de um mês (luz, água) ou pula um mês.
- **Cartões** — compras à vista, parceladas e assinaturas caem na fatura certa pelo dia de fechamento. Dá pra só informar o valor fechado da fatura, sem lançar compra por compra.
- **Fluxo de caixa** — projeção dos próximos 12 meses.
- **Reserva** — metas com depósitos e retiradas. Uma conta do tipo "guardar na reserva" pode cair direto numa meta ao ser paga.
- Tema claro/escuro, funciona no celular, login por e-mail e senha (uma única conta, criada no primeiro acesso).

## Stack

- **Front:** React + TypeScript + Tailwind, empacotado com Vite.
- **Back:** Cloudflare Worker (Hono) servindo a API em `/api/*` e os arquivos estáticos.
- **Banco:** Cloudflare D1 (SQLite). Valores em centavos, meses como `AAAA-MM`.

```
migrations/   esquema do banco (D1)
shared/       regras de cálculo (parcelas, faturas, sobra) + testes
worker/       API e autenticação
src/          telas
```

## Rodando local

```bash
npm install
npm run db:migrate:local
npm run dev
```

Abre em `http://localhost:5173`. O banco local fica em `.wrangler/` (fora do git).

```bash
npm test         # regras de cálculo
npm run typecheck
```

## Publicando no Cloudflare

No ar em https://gestor-financeiro.okaiquemota.workers.dev. O `database_id` do D1 fica em `wrangler.jsonc`.

```bash
npm run db:migrate:remote   # só quando houver migração nova
npm run deploy
```

`npm run deploy:embedded` é o plano B: publica o front embutido dentro do próprio Worker, sem a etapa de upload de arquivos estáticos. Serve para ambientes onde esse upload falha com 401 (proxy que reescreve o cabeçalho `Authorization`). O resultado para quem usa é o mesmo.

O segredo `SETUP_CODE` faz a criação da conta exigir um código — evita que outra pessoa crie a conta antes do dono no primeiro acesso. Depois que a conta existe, novos cadastros são recusados de qualquer forma. Para trocar: `npx wrangler secret put SETUP_CODE`.

## Créditos

Mascote (porquinho-cofre roxo, seis poses): imagens geradas por IA no Figma, em `public/emoji/mascote*.webp`.

Ícones 3D: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) da Microsoft (licença MIT).
