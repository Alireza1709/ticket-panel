CREATE TABLE ticket_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  previous_assignee UUID REFERENCES users(id),
  assignee UUID NOT NULL REFERENCES users(id),
  CHECK (previous_assignee IS DISTINCT FROM assignee)
);
CREATE INDEX assignment_history_ticket_active_idx
  ON ticket_assignment_history (ticket_id, created_at, id) WHERE NOT is_cancelled;
CREATE TRIGGER assignment_history_updated BEFORE UPDATE ON ticket_assignment_history
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assignment_history_no_delete BEFORE DELETE OR TRUNCATE ON ticket_assignment_history
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();
