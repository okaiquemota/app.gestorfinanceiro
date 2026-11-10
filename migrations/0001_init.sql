-- Gestor financeiro: esquema inicial.
-- Valores em centavos (INTEGER). Meses no formato 'YYYY-MM'.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  daily_budget_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE auth_attempts (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX auth_attempts_key ON auth_attempts(key, at);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'target',
  target_cents INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX goals_user ON goals(user_id);

-- Rendas e contas (recorrentes, parceladas ou avulsas).
-- end_month NULL = mensal sem fim; start_month = end_month = avulsa.
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  amount_cents INTEGER NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  start_month TEXT NOT NULL,
  end_month TEXT,
  estimated INTEGER NOT NULL DEFAULT 0,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX entries_user ON entries(user_id);

-- Estado de um lançamento em um mês específico (pago, valor ajustado, pulado).
CREATE TABLE entry_months (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount_cents INTEGER,
  paid_at TEXT,
  skipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_id, month)
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'graphite',
  last4 TEXT NOT NULL DEFAULT '',
  limit_cents INTEGER NOT NULL DEFAULT 0,
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  created_at TEXT NOT NULL
);
CREATE INDEX cards_user ON cards(user_id);

-- Compras no cartão. recurring = 1: assinatura mensal (amount_cents por mês).
-- recurring = 0: amount_cents é o total, dividido em `installments` faturas.
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  amount_cents INTEGER NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 120),
  recurring INTEGER NOT NULL DEFAULT 0,
  first_month TEXT NOT NULL,
  end_month TEXT,
  purchased_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX purchases_card ON purchases(card_id);
CREATE INDEX purchases_user ON purchases(user_id);

-- Fatura de um cartão em um mês (mês = mês do vencimento).
-- amount_cents preenchido = valor informado manualmente (sobrepõe a soma das compras).
CREATE TABLE invoices (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount_cents INTEGER,
  paid_at TEXT,
  PRIMARY KEY (card_id, month)
);

CREATE TABLE goal_moves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  month TEXT
);
CREATE INDEX goal_moves_goal ON goal_moves(goal_id);
CREATE UNIQUE INDEX goal_moves_entry_month ON goal_moves(entry_id, month) WHERE entry_id IS NOT NULL;
