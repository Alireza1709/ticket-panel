import { pool } from "../db.js";
import type { Status } from "../modules/tickets/staff/staff.validator.js";

const transitions: Record<Status, readonly Status[]> = {
  new: ["in_progress"],
  in_progress: ["waiting_customer", "resolved"],
  waiting_customer: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

export { listFilteredTickets as listTickets } from "./ticket-list.model.js";

export async function getTicket(id: string) {
  const client = await pool.connect();
  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const result = await client.query(
      `SELECT t.id, t.ticket_number, t.subject, t.description, t.category,
      t.priority, t.status, t.created_at, t.updated_at, t.assigned_to,
      COALESCE(c.name, 'کاربر غیرفعال') AS customer_name, c.email AS customer_email, a.name AS assignee_name
      FROM tickets t LEFT JOIN users c ON c.id = t.customer_id AND NOT c.is_cancelled
      LEFT JOIN users a ON a.id = t.assigned_to AND NOT a.is_cancelled
      WHERE t.id = $1 AND NOT t.is_cancelled`,
      [id],
    );
    if (!result.rows[0]) {
      await client.query("COMMIT");
      return null;
    }
    const messages = await client.query(
      `SELECT m.id, m.body, m.created_at,
      COALESCE(u.name, 'کاربر غیرفعال') AS author_name, u.role AS author_role
      FROM ticket_messages m LEFT JOIN users u ON u.id = m.created_by AND NOT u.is_cancelled
      WHERE m.ticket_id = $1 AND NOT m.is_cancelled ORDER BY m.created_at, m.id`,
      [id],
    );
    const history = await client.query(
      `SELECT h.id, h.from_status, h.to_status, h.created_at,
      COALESCE(u.name, 'کاربر غیرفعال') AS author_name FROM status_history h
      LEFT JOIN users u ON u.id = h.created_by AND NOT u.is_cancelled
      WHERE h.ticket_id = $1 AND NOT h.is_cancelled ORDER BY h.created_at, h.id`,
      [id],
    );
    const assignments = await client.query(
      `SELECT h.id, h.created_at, actor.name AS author_name, agent.name AS assignee_name
       FROM ticket_assignment_history h
       JOIN users actor ON actor.id = h.created_by
       JOIN users agent ON agent.id = h.assignee
       WHERE h.ticket_id = $1 AND NOT h.is_cancelled ORDER BY h.created_at, h.id`,
      [id],
    );
    await client.query("COMMIT");
    return {
      ticket: result.rows[0],
      messages: messages.rows,
      history: history.rows,
      assignments: assignments.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Mutations lock the parent ticket before changing its fields or thread.
export async function replyToTicket(id: string, userId: string, body: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticket = await client.query(
      "SELECT id FROM tickets WHERE id = $1 AND NOT is_cancelled FOR UPDATE",
      [id],
    );
    if (!ticket.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      "INSERT INTO ticket_messages (created_by, ticket_id, body) VALUES ($1,$2,$3)",
      [userId, id, body],
    );
    await client.query(
      "UPDATE tickets SET updated_at = now() WHERE id = $1 AND NOT is_cancelled",
      [id],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTicketStatus(
  id: string,
  userId: string,
  status: Status,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{ status: Status }>(
      "SELECT status FROM tickets WHERE id = $1 AND NOT is_cancelled FOR UPDATE",
      [id],
    );
    const ticket = found.rows[0];
    if (!ticket) {
      await client.query("ROLLBACK");
      return null;
    }
    if (!transitions[ticket.status].includes(status)) {
      await client.query("ROLLBACK");
      return "conflict";
    }
    await client.query(
      "UPDATE tickets SET status = $2 WHERE id = $1 AND NOT is_cancelled",
      [id, status],
    );
    await client.query(
      "INSERT INTO status_history (created_by, ticket_id, from_status, to_status) VALUES ($1,$2,$3,$4)",
      [userId, id, ticket.status, status],
    );
    await client.query("COMMIT");
    return "updated";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function assignTicket(id: string, assigneeId: string, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{ assigned_to: string | null }>(
      "SELECT assigned_to FROM tickets WHERE id = $1 AND NOT is_cancelled FOR UPDATE",
      [id],
    );
    if (!found.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    // SHARE prevents a concurrent soft-cancellation/role change until commit.
    const staff = await client.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'staff' AND NOT is_cancelled FOR SHARE",
      [assigneeId],
    );
    if (!staff.rows[0]) {
      await client.query("ROLLBACK");
      return "invalid_assignee";
    }
    if (found.rows[0].assigned_to !== assigneeId) {
      await client.query(
        "UPDATE tickets SET assigned_to = $2 WHERE id = $1 AND NOT is_cancelled",
        [id, assigneeId],
      );
      await client.query(
        `INSERT INTO ticket_assignment_history (ticket_id, created_by, previous_assignee, assignee)
         VALUES ($1, $2, $3, $4)`,
        [id, actorId, found.rows[0].assigned_to, assigneeId],
      );
    }
    await client.query("COMMIT");
    return "assigned";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
