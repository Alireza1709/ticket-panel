import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { pool } from "./db.js";

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(71002001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID,
      is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
      version TEXT NOT NULL UNIQUE, checksum TEXT NOT NULL
    )`);
    const directory = new URL("../migrations/", import.meta.url);
    const files = (await readdir(directory))
      .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    for (const version of files) {
      const sql = await readFile(new URL(version, directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE version = $1 AND NOT is_cancelled",
        [version],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error("Applied migration checksum changed");
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [version, checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied migration: ${version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(71002001)");
    client.release();
  }
}

try {
  await migrate();
} catch {
  console.error(
    "Migration failed. Check local database permissions and migration integrity; details withheld.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
