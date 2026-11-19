-- Poupin aberto ao público: várias contas, teste grátis e assinatura.

-- plan: 'trial' (teste grátis), 'active' (assinatura em dia),
--       'cancelled' (cancelou; vale até paid_until), 'lifetime' (acesso vitalício).
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE users ADD COLUMN trial_ends_at TEXT;
ALTER TABLE users ADD COLUMN paid_until TEXT;
ALTER TABLE users ADD COLUMN mp_preapproval_id TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;

-- Quem já tinha conta antes da abertura ao público (o dono) fica com acesso vitalício.
UPDATE users SET plan = 'lifetime';

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX password_resets_user ON password_resets(user_id);
