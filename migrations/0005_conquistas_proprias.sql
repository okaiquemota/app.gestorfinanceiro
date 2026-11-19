-- Conquistas criadas pela própria pessoa (ex.: "Ler 12 livros em 2027").
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL,
  -- ano a que o desafio se refere; NULL = sem ano
  year INTEGER,
  done_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX challenges_user ON challenges(user_id);
