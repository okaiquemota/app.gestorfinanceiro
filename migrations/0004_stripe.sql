-- Cobrança passa a ser pela Stripe.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
CREATE UNIQUE INDEX users_stripe_subscription ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Pagamentos avulsos já contabilizados (id da sessão de checkout), pra um mesmo
-- aviso não somar dias duas vezes.
CREATE TABLE billing_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

-- Sobras da integração anterior com o Mercado Pago, que não é mais usada.
DROP INDEX IF EXISTS users_preapproval;
DROP TABLE IF EXISTS mp_payments;
DROP TABLE IF EXISTS settings;
