CREATE TABLE IF NOT EXISTS passes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL CHECK (name <> ''),
  document   TEXT        NOT NULL CHECK (document <> ''),
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED'))
);
