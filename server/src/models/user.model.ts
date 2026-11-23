import { pool } from "../db.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "staff";
}
interface LoginUser extends PublicUser {
  password_hash: string;
}
export async function findActiveUser(id: string): Promise<PublicUser | null> {
  const result = await pool.query<PublicUser>(
    "SELECT id, name, email, role FROM users WHERE id = $1 AND NOT is_cancelled",
    [id],
  );
  return result.rows[0] ?? null;
}
export async function findActiveLogin(email: string) {
  const result = await pool.query<LoginUser>(
    "SELECT id, name, email, role, password_hash FROM users WHERE email = $1 AND NOT is_cancelled",
    [email],
  );
  return result.rows[0];
}

export async function listActiveStaff() {
  const result = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE role = 'staff' AND NOT is_cancelled ORDER BY name, id",
  );
  return result.rows;
}
