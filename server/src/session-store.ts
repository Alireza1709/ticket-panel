import session from "express-session";
import {
  cancelSession,
  extendSession,
  findSession,
  saveSession,
} from "./models/session.model.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

// express-session's MemoryStore is intentionally avoided: sessions survive restart.
// Destroying sessions cancels rows rather than deleting them.
export class PostgresSessionStore extends session.Store {
  override get(
    sid: string,
    callback: (error: unknown, data?: session.SessionData | null) => void,
  ) {
    void findSession(sid).then(
      (data) => callback(null, data),
      () => callback(new Error("Session store unavailable")),
    );
  }
  override set(
    sid: string,
    data: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    const expiry = data.cookie.expires ?? new Date(Date.now() + 8 * 3600000);
    void saveSession(sid, data, expiry).then(
      () => callback?.(),
      () => callback?.(new Error("Session store unavailable")),
    );
  }
  override touch(
    sid: string,
    data: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    const expiry = data.cookie.expires ?? new Date(Date.now() + 8 * 3600000);
    void extendSession(sid, expiry).then(
      () => callback?.(),
      () => callback?.(new Error("Session store unavailable")),
    );
  }
  override destroy(sid: string, callback?: (error?: unknown) => void) {
    void cancelSession(sid).then(
      () => callback?.(),
      () => callback?.(new Error("Session store unavailable")),
    );
  }
}
