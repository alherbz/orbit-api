CREATE TABLE tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  priority   TEXT NOT NULL DEFAULT 'medium',
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
