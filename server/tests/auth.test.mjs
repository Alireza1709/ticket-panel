import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import argon2 from "argon2";

const { app } = await import("../dist/app.js");
const { pool } = await import("../dist/db.js");
const { config } = await import("../dist/config.js");
const { PostgresSessionStore } = await import("../dist/session-store.js");

test("seed integrity, authentication, CSRF, persisted sessions and role authorization", async (t) => {
  assert.notEqual(
    config.NODE_ENV,
    "production",
    "Run integration checks against a local development database",
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const browser = () => ({ cookie: "", csrf: "" });
  const customer = browser();
  const staff = browser();
  async function request(client, path, body, options = {}) {
    const headers = {
      Cookie: client.cookie,
      Origin: config.APP_ORIGIN,
      ...options.headers,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-Token"] = client.csrf;
    }
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("tickets.sid="));
    if (cookie) client.cookie = cookie.split(";")[0];
    return { response, body: await response.json() };
  }
  async function prepare(client) {
    const result = await request(client, "/api/auth/csrf");
    assert.equal(result.response.status, 200);
    client.csrf = result.body.csrfToken;
    assert.match(client.csrf, /^[a-f0-9]{64}$/);
    assert.match(result.response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(result.response.headers.get("set-cookie"), /SameSite=Lax/);
  }
  try {
    await t.test(
      "all tables have audit fields and database deletion guards",
      async () => {
        const tables = [
          "users",
          "tickets",
          "ticket_messages",
          "status_history",
          "sessions",
          "schema_migrations",
        ];
        const columns = await pool.query(
          "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ANY($1::text[])",
          [tables],
        );
        for (const table of tables) {
          for (const [name, type] of [
            ["id", "uuid"],
            ["created_at", "timestamp with time zone"],
            ["created_by", "uuid"],
            ["is_cancelled", "boolean"],
          ]) {
            assert.ok(
              columns.rows.some(
                (row) =>
                  row.table_name === table &&
                  row.column_name === name &&
                  row.data_type === type,
              ),
              `${table}.${name} is required`,
            );
          }
        }
        const guards = await pool.query(
          "SELECT count(*)::int AS count FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[])",
          [
            [
              "users_no_delete",
              "tickets_no_delete",
              "messages_no_delete",
              "history_no_delete",
              "sessions_no_delete",
              "migrations_no_delete",
            ],
          ],
        );
        assert.equal(guards.rows[0].count, 6);
        const assignments =
          await pool.query(`SELECT count(*)::int AS count FROM tickets t JOIN users u ON u.id = t.assigned_to
        WHERE NOT t.is_cancelled AND u.role <> 'staff'`);
        assert.equal(assignments.rows[0].count, 0);
      },
    );
    await t.test(
      "seed has exactly four fixed demo accounts, 20 tickets, messages and history",
      async () => {
        const users = await pool.query(
          "SELECT role, count(*)::int AS count FROM users WHERE id::text LIKE '10000000-0000-4000-8000-%' AND NOT is_cancelled GROUP BY role ORDER BY role",
        );
        assert.deepEqual(users.rows, [
          { role: "customer", count: 2 },
          { role: "staff", count: 2 },
        ]);
        const counts =
          await pool.query(`SELECT count(*)::int AS total, count(DISTINCT ticket_number)::int AS numbers,
        count(DISTINCT customer_id)::int AS customers, count(DISTINCT status)::int AS statuses,
        count(DISTINCT priority)::int AS priorities FROM tickets WHERE id::text LIKE '20000000-0000-4000-8000-%' AND NOT is_cancelled`);
        assert.deepEqual(counts.rows[0], {
          total: 20,
          numbers: 20,
          customers: 2,
          statuses: 5,
          priorities: 4,
        });
        const related = await pool.query(`SELECT
        (SELECT count(*)::int FROM ticket_messages WHERE ticket_id::text LIKE '20000000-0000-4000-8000-%' AND NOT is_cancelled) AS messages,
        (SELECT count(*)::int FROM status_history WHERE ticket_id::text LIKE '20000000-0000-4000-8000-%' AND NOT is_cancelled) AS history`);
        assert.deepEqual(related.rows[0], { messages: 36, history: 36 });
        const migrations = await pool.query(
          "SELECT version FROM schema_migrations WHERE NOT is_cancelled ORDER BY version",
        );
        assert.deepEqual(
          migrations.rows.map((row) => row.version),
          ["001_initial.sql", "002_ticket_category.sql"],
        );
        const accounts = await pool.query(
          "SELECT email, password_hash FROM users WHERE id::text LIKE '10000000-0000-4000-8000-%' AND NOT is_cancelled ORDER BY email",
        );
        const demos = {
          "sara@example.test": "DemoCustomer1!2026",
          "ali@example.test": "DemoCustomer2!2026",
          "maryam@example.test": "DemoStaff1!2026",
          "reza@example.test": "DemoStaff2!2026",
        };
        for (const account of accounts.rows) {
          assert.match(account.password_hash, /^\$argon2id\$/);
          assert.equal(
            await argon2.verify(account.password_hash, demos[account.email]),
            true,
          );
        }
      },
    );
    await t.test(
      "unauthenticated protected API is denied and current-user is anonymous",
      async () => {
        assert.equal(
          (await request(customer, "/api/customer/overview")).response.status,
          401,
        );
        assert.equal(
          (await request(customer, "/api/staff/overview")).response.status,
          401,
        );
        assert.deepEqual((await request(customer, "/api/auth/me")).body, {
          user: null,
        });
      },
    );
    await t.test(
      "login requires CSRF, validates inputs and rejects wrong passwords",
      async () => {
        assert.equal(
          (
            await request(customer, "/api/auth/login", {
              email: "sara@example.test",
              password: "wrong",
            })
          ).response.status,
          403,
        );
        await prepare(customer);
        assert.equal(
          (
            await request(customer, "/api/auth/login", {
              email: "invalid",
              password: "",
            })
          ).response.status,
          400,
        );
        assert.equal(
          (
            await request(customer, "/api/auth/login", {
              email: "sara@example.test",
              password: "wrong",
            })
          ).response.status,
          401,
        );
        const missing = await request(customer, "/api/auth/login", {
          email: "missing@example.test",
          password: "wrong",
        });
        assert.equal(missing.response.status, 401);
        assert.equal(missing.body.message, "ایمیل یا گذرواژه نادرست است");
        const original = customer.csrf;
        customer.csrf = "f".repeat(64);
        assert.equal(
          (
            await request(customer, "/api/auth/login", {
              email: "sara@example.test",
              password: "wrong",
            })
          ).response.status,
          403,
        );
        customer.csrf = original;
        assert.equal(
          (
            await request(
              customer,
              "/api/auth/login",
              { email: "sara@example.test", password: "wrong" },
              { headers: { Origin: "https://untrusted.invalid" } },
            )
          ).response.status,
          403,
        );
      },
    );
    await t.test(
      "correct customer login rotates session, gives safe user and customer redirect",
      async () => {
        const before = customer.cookie;
        const result = await request(customer, "/api/auth/login", {
          email: " SARA@example.test ",
          password: "DemoCustomer1!2026",
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.body.user.role, "customer");
        assert.equal(result.body.redirectTo, "/customer/tickets");
        assert.deepEqual(Object.keys(result.body.user).sort(), [
          "email",
          "id",
          "name",
          "role",
        ]);
        assert.notEqual(customer.cookie, before);
        assert.notEqual(result.body.csrfToken, customer.csrf);
        customer.csrf = result.body.csrfToken;
        assert.equal(
          (await request({ cookie: before }, "/api/customer/overview")).response
            .status,
          401,
        );
        assert.equal(
          (await request(customer, "/api/customer/overview")).response.status,
          200,
        );
        assert.equal(
          (await request(customer, "/api/staff/overview")).response.status,
          403,
        );
        assert.equal(
          (await request(customer, "/api/auth/me")).body.user.email,
          "sara@example.test",
        );
      },
    );
    await t.test(
      "session is persisted and readable by a fresh store instance",
      async () => {
        const sid = decodeURIComponent(customer.cookie.split("=")[1])
          .slice(2)
          .split(".")[0];
        const data = await new Promise((resolve, reject) =>
          new PostgresSessionStore().get(sid, (error, value) =>
            error ? reject(error) : resolve(value),
          ),
        );
        assert.equal(data.userId, "10000000-0000-4000-8000-000000000001");
      },
    );
    await t.test(
      "staff login redirects to inbox and staff-only API succeeds",
      async () => {
        await prepare(staff);
        const result = await request(staff, "/api/auth/login", {
          email: "maryam@example.test",
          password: "DemoStaff1!2026",
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.body.redirectTo, "/staff/inbox");
        staff.csrf = result.body.csrfToken;
        assert.equal(
          (await request(staff, "/api/staff/overview")).response.status,
          200,
        );
        assert.equal(
          (await request(staff, "/api/customer/overview")).response.status,
          403,
        );
      },
    );
    await t.test(
      "logout needs CSRF, cancels session and invalidates replay",
      async () => {
        const oldCookie = customer.cookie;
        const csrf = customer.csrf;
        customer.csrf = "";
        assert.equal(
          (await request(customer, "/api/auth/logout", {})).response.status,
          403,
        );
        customer.csrf = csrf;
        assert.equal(
          (await request(customer, "/api/auth/logout", {})).response.status,
          200,
        );
        assert.equal(
          (await request({ cookie: oldCookie }, "/api/customer/overview"))
            .response.status,
          401,
        );
        assert.deepEqual((await request(customer, "/api/auth/me")).body, {
          user: null,
        });
        assert.equal(
          (await request(staff, "/api/auth/logout", {})).response.status,
          200,
        );
      },
    );
    await t.test("both existing health endpoints remain healthy", async () => {
      for (const path of ["/api/health", "/api/health/db"])
        assert.equal((await request(browser(), path)).response.status, 200);
    });
    await t.test("repeated login failures are rate-limited", async () => {
      const client = browser();
      await prepare(client);
      let limited = false;
      for (let attempt = 0; attempt < 11; attempt++) {
        const result = await request(client, "/api/auth/login", {
          email: "missing@example.test",
          password: "wrong",
        });
        if (result.response.status === 429) {
          limited = true;
          assert.ok(result.response.headers.get("retry-after"));
          break;
        }
        assert.equal(result.response.status, 401);
      }
      assert.equal(limited, true);
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
