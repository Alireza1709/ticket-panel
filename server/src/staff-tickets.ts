import { Router, type Response } from "express";
import { z } from "zod";
import { pool } from "./db.js";
import { requireRole, csrfProtection } from "./auth.js";

const statusSchema = z.enum([
  "new",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
]);
type Status = z.infer<typeof statusSchema>;
export const transitions: Record<Status, readonly Status[]> = {
  new: ["in_progress"],
  in_progress: ["waiting_customer", "resolved"],
  waiting_customer: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};
const pageNumber = (max: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(max));
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => !value.startsWith("0000-") && Number.isFinite(Date.parse(value)),
  );
const filtersSchema = z
  .object({
    page: pageNumber(1000000).default(1),
    page_size: pageNumber(100).default(20),
    status: statusSchema.optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    q: z.string().trim().max(100).default(""),
    from: timestamp.optional(),
    to: timestamp.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to),
  );
const replySchema = z
  .object({ body: z.string().trim().min(1).max(10000) })
  .strict();
const statusBody = z.object({ status: statusSchema }).strict();
const assignmentBody = z.object({ assigned_to: z.uuid() }).strict();
function missing(res: Response) {
  res.status(404).json({ message: "تیکت یافت نشد یا لغو شده است" });
}
export const staffRouter = Router();
staffRouter.use(requireRole("staff"));

staffRouter.get("/members", async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name FROM users WHERE role = 'staff' AND NOT is_cancelled ORDER BY name, id",
  );
  res.json({ members: result.rows });
});

staffRouter.get("/tickets", async (req, res) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "صفحه، فیلترها یا بازه زمانی معتبر نیست" });
    return;
  }
  const { page, page_size, status, priority, q, from, to } = parsed.data;
  const values = [
    status ?? null,
    priority ?? null,
    from ?? null,
    to ?? null,
    q,
  ];
  // Only static SQL is assembled. All filter values, limits and offsets are parameters.
  const where = `NOT t.is_cancelled
    AND ($1::ticket_status IS NULL OR t.status = $1)
    AND ($2::ticket_priority IS NULL OR t.priority = $2)
    AND ($3::timestamptz IS NULL OR t.created_at >= $3)
    AND ($4::timestamptz IS NULL OR t.created_at < $4)
    AND ($5::text = '' OR strpos(lower(t.ticket_number), lower($5)) > 0 OR strpos(lower(t.subject), lower($5)) > 0)`;
  const client = await pool.connect();
  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const count = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM tickets t WHERE ${where}`,
      values,
    );
    const result = await client.query(
      `SELECT t.id, t.ticket_number, t.subject, t.status, t.priority,
      t.updated_at, t.assigned_to,
      COALESCE(c.name, 'کاربر غیرفعال') AS customer_name, a.name AS assignee_name
      FROM tickets t LEFT JOIN users c ON c.id = t.customer_id AND NOT c.is_cancelled
      LEFT JOIN users a ON a.id = t.assigned_to AND NOT a.is_cancelled
      WHERE ${where} ORDER BY t.created_at DESC, t.id DESC LIMIT $6 OFFSET $7`,
      [...values, page_size, (page - 1) * page_size],
    );
    await client.query("COMMIT");
    const total = count.rows[0]!.total;
    res.json({
      tickets: result.rows,
      page,
      page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / page_size)),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

staffRouter.param("id", (req, res, next, id: string) => {
  if (!z.uuid().safeParse(id).success) {
    res.status(400).json({ message: "شناسه تیکت معتبر نیست" });
    return;
  }
  next();
});
staffRouter.get("/tickets/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const result = await client.query(
      `SELECT t.id, t.ticket_number, t.subject, t.description, t.category,
      t.priority, t.status, t.created_at, t.updated_at, t.assigned_to,
      COALESCE(c.name, 'کاربر غیرفعال') AS customer_name, a.name AS assignee_name
      FROM tickets t LEFT JOIN users c ON c.id = t.customer_id AND NOT c.is_cancelled
      LEFT JOIN users a ON a.id = t.assigned_to AND NOT a.is_cancelled
      WHERE t.id = $1 AND NOT t.is_cancelled`,
      [req.params.id],
    );
    if (!result.rows[0]) {
      await client.query("COMMIT");
      missing(res);
      return;
    }
    const messages = await client.query(
      `SELECT m.id, m.body, m.created_at,
      COALESCE(u.name, 'کاربر غیرفعال') AS author_name, u.role AS author_role
      FROM ticket_messages m LEFT JOIN users u ON u.id = m.created_by AND NOT u.is_cancelled
      WHERE m.ticket_id = $1 AND NOT m.is_cancelled ORDER BY m.created_at, m.id`,
      [req.params.id],
    );
    const history = await client.query(
      `SELECT h.id, h.from_status, h.to_status, h.created_at,
      COALESCE(u.name, 'کاربر غیرفعال') AS author_name FROM status_history h
      LEFT JOIN users u ON u.id = h.created_by AND NOT u.is_cancelled
      WHERE h.ticket_id = $1 AND NOT h.is_cancelled ORDER BY h.created_at, h.id`,
      [req.params.id],
    );
    await client.query("COMMIT");
    res.json({
      ticket: result.rows[0],
      messages: messages.rows,
      history: history.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Each mutation locks the parent ticket before changing only its own fields.
staffRouter.post("/tickets/:id/replies", csrfProtection, async (req, res) => {
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
    const ticket = await client.query(
      "SELECT id FROM tickets WHERE id = $1 AND NOT is_cancelled FOR UPDATE",
      [req.params.id],
    );
    if (!ticket.rows[0]) {
      await client.query("ROLLBACK");
      missing(res);
      return;
    }
    await client.query(
      "INSERT INTO ticket_messages (created_by, ticket_id, body) VALUES ($1,$2,$3)",
      [req.session.userId, req.params.id, parsed.data.body],
    );
    await client.query(
      "UPDATE tickets SET updated_at = now() WHERE id = $1 AND NOT is_cancelled",
      [req.params.id],
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "پاسخ پشتیبانی ثبت شد" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

staffRouter.post("/tickets/:id/status", csrfProtection, async (req, res) => {
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "وضعیت معتبر انتخاب کنید" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{ status: Status }>(
      "SELECT status FROM tickets WHERE id = $1 AND NOT is_cancelled FOR UPDATE",
      [req.params.id],
    );
    const ticket = found.rows[0];
    if (!ticket) {
      await client.query("ROLLBACK");
      missing(res);
      return;
    }
    if (!transitions[ticket.status].includes(parsed.data.status)) {
      await client.query("ROLLBACK");
      res.status(409).json({
        message: "این تغییر وضعیت مجاز نیست؛ اطلاعات تیکت را تازه‌سازی کنید",
      });
      return;
    }
    await client.query(
      "UPDATE tickets SET status = $2 WHERE id = $1 AND NOT is_cancelled",
      [req.params.id, parsed.data.status],
    );
    await client.query(
      "INSERT INTO status_history (created_by, ticket_id, from_status, to_status) VALUES ($1,$2,$3,$4)",
      [req.session.userId, req.params.id, ticket.status, parsed.data.status],
    );
    await client.query("COMMIT");
    res.json({ message: "وضعیت تیکت به‌روزرسانی شد" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

staffRouter.post(
  "/tickets/:id/assignment",
  csrfProtection,
  async (req, res) => {
    const parsed = assignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "کارشناس معتبر انتخاب کنید" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<{ assigned_to: string | null }>(
        "SELECT assigned_to FROM tickets WHERE id = $1 AND NOT is_cancelled FOR UPDATE",
        [req.params.id],
      );
      if (!found.rows[0]) {
        await client.query("ROLLBACK");
        missing(res);
        return;
      }
      // SHARE prevents a concurrent soft-cancellation/role change until commit.
      const staff = await client.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'staff' AND NOT is_cancelled FOR SHARE",
        [parsed.data.assigned_to],
      );
      if (!staff.rows[0]) {
        await client.query("ROLLBACK");
        res.status(400).json({
          message: "کارشناس انتخاب‌شده فعال نیست یا نقش پشتیبانی ندارد",
        });
        return;
      }
      if (found.rows[0].assigned_to !== parsed.data.assigned_to)
        await client.query(
          "UPDATE tickets SET assigned_to = $2 WHERE id = $1 AND NOT is_cancelled",
          [req.params.id, parsed.data.assigned_to],
        );
      await client.query("COMMIT");
      res.json({ message: "کارشناس تیکت ثبت شد" });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);
