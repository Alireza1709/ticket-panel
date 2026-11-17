CREATE TYPE user_role AS ENUM ('customer', 'staff');
CREATE TYPE ticket_status AS ENUM ('new', 'in_progress', 'waiting_customer', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  password_hash TEXT NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  role user_role NOT NULL,
  UNIQUE (id, role)
);

CREATE SEQUENCE ticket_number_seq;
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_number TEXT NOT NULL UNIQUE DEFAULT ('TKT-' || lpad(nextval('ticket_number_seq')::text, 8, '0')),
  customer_id UUID NOT NULL,
  customer_role user_role NOT NULL DEFAULT 'customer' CHECK (customer_role = 'customer'),
  assigned_to UUID,
  assigned_role user_role NOT NULL DEFAULT 'staff' CHECK (assigned_role = 'staff'),
  subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 200),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 10000),
  status ticket_status NOT NULL DEFAULT 'new',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  FOREIGN KEY (customer_id, customer_role) REFERENCES users(id, role),
  FOREIGN KEY (assigned_to, assigned_role) REFERENCES users(id, role)
);
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000)
);
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  from_status ticket_status,
  to_status ticket_status NOT NULL,
  CHECK (from_status IS DISTINCT FROM to_status)
);

-- Infrastructure tables also carry the common audit columns. Anonymous sessions
-- and migrations have no actor; their created_by is deliberately nullable.
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  sid TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE schema_migrations ADD CONSTRAINT migrations_creator_fk FOREIGN KEY (created_by) REFERENCES users(id);

CREATE INDEX tickets_customer_active_idx ON tickets (customer_id, created_at DESC) WHERE NOT is_cancelled;
CREATE INDEX tickets_inbox_active_idx ON tickets (status, priority, created_at DESC) WHERE NOT is_cancelled;
CREATE INDEX tickets_assignee_active_idx ON tickets (assigned_to, created_at DESC) WHERE NOT is_cancelled;
CREATE INDEX messages_ticket_active_idx ON ticket_messages (ticket_id, created_at, id) WHERE NOT is_cancelled;
CREATE INDEX history_ticket_active_idx ON status_history (ticket_id, created_at, id) WHERE NOT is_cancelled;
CREATE INDEX sessions_expiry_idx ON sessions (expires_at) WHERE NOT is_cancelled;

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tickets_updated BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER messages_updated BEFORE UPDATE ON ticket_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER history_updated BEFORE UPDATE ON status_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION prevent_hard_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Hard deletion is disabled; cancel records instead'; END;
$$;
CREATE TRIGGER users_no_delete BEFORE DELETE OR TRUNCATE ON users FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER tickets_no_delete BEFORE DELETE OR TRUNCATE ON tickets FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER messages_no_delete BEFORE DELETE OR TRUNCATE ON ticket_messages FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER history_no_delete BEFORE DELETE OR TRUNCATE ON status_history FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER sessions_no_delete BEFORE DELETE OR TRUNCATE ON sessions FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER migrations_no_delete BEFORE DELETE OR TRUNCATE ON schema_migrations FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
