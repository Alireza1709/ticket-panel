import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

// An intentionally closed localhost port makes the failure check independent
// of developer credentials and avoids contacting another machine.
process.env.DATABASE_URL = "postgresql://127.0.0.1:1/health_test";
process.env.NODE_ENV = "test";
const { app } = await import("../dist/app.js");
const { pool } = await import("../dist/db.js");

test("health API responds and safely reports unavailable PostgreSQL", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");
    const database = await fetch(`${base}/api/health/db`);
    assert.equal(database.status, 503);
    assert.deepEqual(await database.json(), {
      status: "error",
      message: "پایگاه داده در دسترس نیست",
    });
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404);
    const invalid = await fetch(`${base}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { message: "درخواست نامعتبر است" });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
