import session from "express-session";
import { pool } from "./db.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

// express-session's MemoryStore is intentionally avoided: sessions survive restart.
// Destroying/expiring sessions cancels rows rather than deleting them.
export class PostgresSessionStore extends session.Store {
  override get(
    sid: string,
    callback: (error: unknown, data?: session.SessionData | null) => void,
  ) {
    void pool
      .query<{ data: session.SessionData }>(
        "SELECT data FROM sessions WHERE sid = $1 AND NOT is_cancelled AND expires_at > now()",
        [sid],
      )
      .then(
        (result) => callback(null, result.rows[0]?.data ?? null),
        () => callback(new Error("Session store unavailable")),
      );
  }
  override set(
    sid: string,
    data: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    const expiry = data.cookie.expires ?? new Date(Date.now() + 8 * 3600000);
    void pool
      .query(
        `INSERT INTO sessions (sid, data, expires_at, created_by) VALUES ($1,$2,$3,$4)
      ON CONFLICT (sid) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at,
      created_by = COALESCE(sessions.created_by, EXCLUDED.created_by)
      WHERE NOT sessions.is_cancelled`,
        [sid, JSON.stringify(data), expiry, data.userId ?? null],
      )
      .then(
        () => callback?.(),
        () => callback?.(new Error("Session store unavailable")),
      );
  }
  override touch(
    sid: string,
    data: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    void pool
      .query(
        "UPDATE sessions SET expires_at = $2 WHERE sid = $1 AND NOT is_cancelled AND expires_at > now()",
        [sid, data.cookie.expires ?? new Date(Date.now() + 8 * 3600000)],
      )
      .then(
        () => callback?.(),
        () => callback?.(new Error("Session store unavailable")),
      );
  }
  override destroy(sid: string, callback?: (error?: unknown) => void) {
    void pool
      .query(
        "UPDATE sessions SET is_cancelled = TRUE, data = '{}'::jsonb WHERE sid = $1",
        [sid],
      )
      .then(
        () => callback?.(),
        () => callback?.(new Error("Session store unavailable")),
      );
  }
}
