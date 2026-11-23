import { pool } from "../db.js";
import type { InboxFilters } from "../modules/tickets/ticket-filters.js";

export async function listFilteredTickets(filters: InboxFilters, customerId?: string) {
  const { page, page_size, status, priority, q, from, to, category, updated_from, updated_to, assigned_to } = filters;
  const values = [
    status ?? null,
    priority ?? null,
    from ?? null,
    to ?? null,
    q,
    category ?? null,
    updated_from ?? null,
    updated_to ?? null,
    assigned_to ?? null,
    customerId ?? null,
  ];
  // Only static SQL is assembled. All filter values, limits and offsets are parameters.
  const where = `NOT t.is_cancelled
    AND ($1::ticket_status IS NULL OR t.status = $1)
    AND ($2::ticket_priority IS NULL OR t.priority = $2)
    AND ($3::timestamptz IS NULL OR t.created_at >= $3)
    AND ($4::timestamptz IS NULL OR t.created_at < $4)
    AND ($5::text = '' OR strpos(lower(t.ticket_number), lower($5)) > 0 OR strpos(lower(t.subject), lower($5)) > 0)
    AND ($6::text IS NULL OR t.category = $6)
    AND ($7::timestamptz IS NULL OR t.updated_at >= $7)
    AND ($8::timestamptz IS NULL OR t.updated_at < $8)
    AND ($9::text IS NULL OR t.assigned_to = NULLIF($9, 'unassigned')::uuid OR ($9 = 'unassigned' AND t.assigned_to IS NULL))
    AND ($10::uuid IS NULL OR t.customer_id = $10)`;
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
      t.created_at, t.updated_at, t.category, t.assigned_to,
      COALESCE(c.name, 'کاربر غیرفعال') AS customer_name, a.name AS assignee_name
      FROM tickets t LEFT JOIN users c ON c.id = t.customer_id AND NOT c.is_cancelled
      LEFT JOIN users a ON a.id = t.assigned_to AND NOT a.is_cancelled
      WHERE ${where}
      ORDER BY CASE WHEN $10 IS NULL THEN t.created_at ELSE t.updated_at END DESC, t.id DESC
      LIMIT $11 OFFSET $12`,
      [...values, page_size, (page - 1) * page_size],
    );
    await client.query("COMMIT");
    const total = count.rows[0]!.total;
    return {
      tickets: result.rows,
      page,
      page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / page_size)),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ticketOverview(userId: string, role: "staff" | "customer") {
  const customer = role === "customer" ? userId : null;
  const result = await pool.query(
    `WITH visible AS (
      SELECT id, ticket_number, subject, status, assigned_to, updated_at
      FROM tickets WHERE NOT is_cancelled AND ($2::uuid IS NULL OR customer_id = $2)
    )
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status = 'new')::int AS new,
      count(*) FILTER (WHERE status IN ('new', 'in_progress', 'waiting_customer'))::int AS open,
      count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
      count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
      count(*) FILTER (WHERE assigned_to = $1)::int AS assigned,
      (SELECT COALESCE(json_agg(recent), '[]') FROM
        (SELECT id, ticket_number, subject, status, updated_at FROM visible
         ORDER BY updated_at DESC, id DESC LIMIT 8) recent) AS recent
    FROM visible`,
    [userId, customer],
  );
  return result.rows[0];
}
