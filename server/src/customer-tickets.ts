import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "./db.js";
import { csrfProtection, requireRole } from "./auth.js";

const createSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    description: z.string().trim().min(1).max(10000),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    category: z.enum(["technical", "billing", "account", "other"]),
  })
  .strict();
const replySchema = z
  .object({ body: z.string().trim().min(1).max(10000) })
  .strict();
const idSchema = z.uuid();
const openStatuses = new Set(["new", "in_progress", "waiting_customer"]);
const columns =
  "id, ticket_number, subject, priority, status, category, created_at, updated_at";
interface LockedTicket {
  id: string;
  status: string;
}
export const customerTickets = Router();
customerTickets.use(requireRole("customer"));

function ticketId(req: Request, res: Response): string | null {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    res.status(400).json({ message: "شناسه تیکت معتبر نیست" });
    return null;
  }
  return result.data;
}
function notFound(res: Response) {
  // Identical response for another owner's, cancelled and nonexistent tickets.
  res.status(404).json({ message: "تیکت یافت نشد یا در دسترس شما نیست" });
}

customerTickets.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT ${columns} FROM tickets
    WHERE customer_id = $1 AND NOT is_cancelled ORDER BY updated_at DESC, id DESC`,
    [req.session.userId],
  );
  res.json({ tickets: result.rows });
});

customerTickets.post("/", csrfProtection, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: "عنوان، توضیحات، اولویت و دسته‌بندی معتبر وارد کنید" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { subject, description, priority, category } = parsed.data;
    const created = await client.query<{ id: string; ticket_number: string }>(
      `INSERT INTO tickets
      (created_by, customer_id, subject, description, priority, category)
      VALUES ($1,$1,$2,$3,$4,$5) RETURNING id, ticket_number`,
      [req.session.userId, subject, description, priority, category],
    );
    const ticket = created.rows[0]!;
    await client.query(
      "INSERT INTO ticket_messages (created_by, ticket_id, body) VALUES ($1,$2,$3)",
      [req.session.userId, ticket.id, description],
    );
    await client.query(
      "INSERT INTO status_history (created_by, ticket_id, from_status, to_status) VALUES ($1,$2,NULL,'new')",
      [req.session.userId, ticket.id],
    );
    await client.query("COMMIT");
    res.status(201).json({ ticket, message: "تیکت با موفقیت ثبت شد" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

customerTickets.get("/:id", async (req, res) => {
  const id = ticketId(req, res);
  if (!id) return;
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
      [id, req.session.userId],
    );
    const ticket = result.rows[0];
    if (!ticket) {
      await client.query("COMMIT");
      notFound(res);
      return;
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
    res.json({ ticket, messages: messages.rows, history: history.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

customerTickets.post("/:id/replies", csrfProtection, async (req, res) => {
  const id = ticketId(req, res);
  if (!id) return;
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: "متن پاسخ باید بین یک تا ده هزار نویسه باشد" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<LockedTicket>(
      "SELECT id, status FROM tickets WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled FOR UPDATE",
      [id, req.session.userId],
    );
    if (!owned.rows[0]) {
      await client.query("ROLLBACK");
      notFound(res);
      return;
    }
    await client.query(
      "INSERT INTO ticket_messages (created_by, ticket_id, body) VALUES ($1,$2,$3)",
      [req.session.userId, id, parsed.data.body],
    );
    await client.query(
      "UPDATE tickets SET updated_at = now() WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled",
      [id, req.session.userId],
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "پاسخ شما با موفقیت ثبت شد" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

customerTickets.post("/:id/cancel", csrfProtection, async (req, res) => {
  const id = ticketId(req, res);
  if (!id) return;
  if (!z.object({}).strict().safeParse(req.body).success) {
    res.status(400).json({ message: "درخواست نامعتبر است" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<LockedTicket>(
      "SELECT id, status FROM tickets WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled FOR UPDATE",
      [id, req.session.userId],
    );
    const ticket = owned.rows[0];
    if (!ticket) {
      await client.query("ROLLBACK");
      notFound(res);
      return;
    }
    if (!openStatuses.has(ticket.status)) {
      await client.query("ROLLBACK");
      res.status(409).json({ message: "فقط تیکت‌های باز قابل لغو هستند" });
      return;
    }
    await client.query(
      "UPDATE tickets SET is_cancelled = TRUE WHERE id = $1 AND customer_id = $2 AND NOT is_cancelled",
      [id, req.session.userId],
    );
    await client.query("COMMIT");
    res.json({ message: "تیکت با موفقیت لغو شد" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
