-- Initial schema for power-app.
-- Statements are idempotent so the migrator is safe to re-run.

CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at           timestamptz NOT NULL DEFAULT now(),
  actor_email  text,
  actor_id     text,
  action       text NOT NULL,
  entity       text NOT NULL,
  entity_id    text,
  summary      text,
  metadata     jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);

CREATE TABLE IF NOT EXISTS requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'general',
  priority     text NOT NULL DEFAULT 'normal',
  status       text NOT NULL DEFAULT 'submitted',
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status);
CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);
