-- Duas formas de pagar: cartão com renovação automática (plano de assinatura)
-- e Pix/boleto/cartão avulso, que libera 30 dias a cada pagamento.

-- Configurações guardadas pelo próprio app (ex.: o id do plano criado no Mercado Pago).
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Pagamentos avulsos já contabilizados, pra um mesmo aviso não somar dias duas vezes.
CREATE TABLE mp_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

-- Quando a pessoa clicou em "assinar no cartão": ajuda a ligar a assinatura a ela
-- se ela não voltar do Mercado Pago pelo link de retorno.
ALTER TABLE users ADD COLUMN billing_intent_at INTEGER;

-- Uma assinatura do Mercado Pago pertence a uma única conta do Poupin.
CREATE UNIQUE INDEX users_preapproval ON users(mp_preapproval_id) WHERE mp_preapproval_id IS NOT NULL;
