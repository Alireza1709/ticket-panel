import type { SessionData } from "express-session";
import { pool } from "../db.js";

export async function findSession(sid: string) {
  const result = await pool.query<{ data: SessionData }>(
    "SELECT data FROM sessions WHERE sid = $1 AND NOT is_cancelled AND expires_at > now()",
    [sid],
  );
  return result.rows[0]?.data ?? null;
}

export function saveSession(sid: string, data: SessionData, expiry: Date) {
  return pool.query(
    `INSERT INTO sessions (sid, data, expires_at, created_by) VALUES ($1,$2,$3,$4)
      ON CONFLICT (sid) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at,
      created_by = COALESCE(sessions.created_by, EXCLUDED.created_by)
      WHERE NOT sessions.is_cancelled`,
    [sid, JSON.stringify(data), expiry, data.userId ?? null],
  );
}

export function extendSession(sid: string, expiry: Date) {
  return pool.query(
    "UPDATE sessions SET expires_at = $2 WHERE sid = $1 AND NOT is_cancelled AND expires_at > now()",
    [sid, expiry],
  );
}

export function cancelSession(sid: string) {
  return pool.query(
    "UPDATE sessions SET is_cancelled = TRUE, data = '{}'::jsonb WHERE sid = $1 AND NOT is_cancelled",
    [sid],
  );
}
