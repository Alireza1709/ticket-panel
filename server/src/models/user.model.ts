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

export async function createAccount(
  account: { name: string; email: string; hash: string },
  role: PublicUser["role"],
): Promise<PublicUser | undefined> {
  const result = await pool.query<PublicUser>(
    `WITH identity AS (SELECT gen_random_uuid() AS id)
     INSERT INTO users (id, created_by, name, email, password_hash, role)
     SELECT id, id, $1, $2, $3, $4 FROM identity
     ON CONFLICT (email) DO NOTHING RETURNING id, name, email, role`,
    [account.name, account.email, account.hash, role],
  );
  return result.rows[0];
}
