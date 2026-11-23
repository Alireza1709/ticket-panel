import { pool } from "../db.js";
import type { NewTicket } from "../modules/tickets/customer/customer.validator.js";

const openStatuses = new Set(["new", "in_progress", "waiting_customer"]);
const columns =
  "id, ticket_number, subject, priority, status, category, created_at, updated_at";
interface LockedTicket {
  id: string;
  status: string;
}

export async function listTickets(userId: string) {
  const result = await pool.query(
    `SELECT ${columns} FROM tickets
    WHERE customer_id = $1 AND NOT is_cancelled ORDER BY updated_at DESC, id DESC`,
    [userId],
  );
  return result.rows;
}

export async function createTicket(userId: string, input: NewTicket) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { subject, description, priority, category } = input;
    const created = await client.query<{ id: string; ticket_number: string }>(
      `INSERT INTO tickets
      (created_by, customer_id, subject, description, priority, category)
      VALUES ($1,$1,$2,$3,$4,$5) RETURNING id, ticket_number`,
      [userId, subject, description, priority, category],
    );
    const ticket = created.rows[0]!;
    await client.query(
      "INSERT INTO ticket_messages (created_by, ticket_id, body) VALUES ($1,$2,$3)",
      [userId, ticket.id, description],
    );
    await client.query(
      "INSERT INTO status_history (created_by, ticket_id, from_status, to_status) VALUES ($1,$2,NULL,'new')",
      [userId, ticket.id],
    );
    await client.query("COMMIT");
    return ticket;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getTicket(id: string, userId: string) {
  const client = await pool.connect();
  try {
    // A consistent snapshot prevents a partial detail view during cancellation.
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const result = await client.query(
      `SELECT t.id, t.ticket_number, t.subject, t.description,
      t.priority, t.status, t.category, t.created_at, t.updated_at, t.assigned_to,
      c.name AS customer_name, a.name AS assignee_name FROM tickets t
      JOIN users c ON c.id = t.customer_id AND NOT c.is_cancelled
      LEFT JOIN users a ON a.id = t.assigned_to AND NOT a.is_cancelled
      WHERE t.id = $1 AND t.customer_id = $2 AND NOT t.is_cancelled`,
      [id, userId],
    );
    const ticket = result.rows[0];
    if (!ticket) {
      await client.query("COMMIT");
      return null;
    }
    const messages = await client.query(
      `SELECT m.id, m.body, m.created_at,
      COALESCE(u.name, 'کاربر غیرفعال') AS author_name, u.role AS author_role
      FROM ticket_messages m LEFT JOIN users u ON u.id = m.created_by AND NOT u.is_cancelled
      WHERE m.ticket_id = $1 AND NOT m.is_cancelled ORDER BY m.created_at ASC, m.id ASC`,
      [id],
    );
    const history = await client.query(
      `SELECT h.id, h.from_status, h.to_status, h.created_at,
      COALESCE(u.name, 'کاربر غیرفعال') AS author_name
      FROM status_history h LEFT JOIN users u ON u.id = h.created_by AND NOT u.is_cancelled
      WHERE h.ticket_id = $1 AND NOT h.is_cancelled ORDER BY h.created_at ASC, h.id ASC`,
      [id],
    );
    await client.query("COMMIT");
    return { ticket, messages: messages.rows, history: history.rows };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function replyToTicket(id: string, userId: string, body: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<LockedTicket>(
      "SELECT id, status FROM tickets WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled FOR UPDATE",
      [id, userId],
    );
    if (!owned.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      "INSERT INTO ticket_messages (created_by, ticket_id, body) VALUES ($1,$2,$3)",
      [userId, id, body],
    );
    await client.query(
      "UPDATE tickets SET updated_at = now() WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled",
      [id, userId],
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

export async function cancelTicket(id: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<LockedTicket>(
      "SELECT id, status FROM tickets WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled FOR UPDATE",
      [id, userId],
    );
    const ticket = owned.rows[0];
    if (!ticket) {
      await client.query("ROLLBACK");
      return null;
    }
    if (!openStatuses.has(ticket.status)) {
      await client.query("ROLLBACK");
      return "conflict";
    }
    await client.query(
      "UPDATE tickets SET is_cancelled = TRUE WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled",
      [id, userId],
    );
    await client.query("COMMIT");
    return "cancelled";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
