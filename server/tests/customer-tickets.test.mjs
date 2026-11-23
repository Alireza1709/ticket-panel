import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
const { app } = await import("../dist/app.js");
const { pool } = await import("../dist/db.js");
const { config } = await import("../dist/config.js");

test("customer ticket ownership, validation, threads and soft cancellation", async (t) => {
  assert.notEqual(config.NODE_ENV, "production");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const root = "/api/customer/tickets";
  const a = {
    cookie: "",
    csrf: "",
    id: "10000000-0000-4000-8000-000000000001",
  };
  const b = {
    cookie: "",
    csrf: "",
    id: "10000000-0000-4000-8000-000000000002",
  };
  const staff = { cookie: "", csrf: "" };
  const fixtures = [];
  const valid = {
    subject: "پیگیری درخواست آزمایشی مشتری",
    description: "شرح مشکل برای بررسی پشتیبانی",
    category: "technical",
    priority: "high",
  };
  async function request(client, path, body, token = client.csrf) {
    const headers = { Cookie: client.cookie, Origin: config.APP_ORIGIN };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-Token"] = token ?? "";
    }
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("tickets.sid="));
    if (cookie) client.cookie = cookie.split(";")[0];
    return { status: response.status, data: await response.json() };
  }
  async function login(client, email, password) {
    client.csrf = (await request(client, "/api/auth/csrf")).data.csrfToken;
    const result = await request(client, "/api/auth/login", {
      email,
      password,
    });
    assert.equal(result.status, 200);
    client.csrf = result.data.csrfToken;
  }
  async function create(client = a) {
    const result = await request(client, root, valid);
    assert.equal(result.status, 201);
    fixtures.push(result.data.ticket.id);
    return result.data.ticket;
  }
  let ticket;
  try {
    await login(a, "sara@example.test", "DemoCustomer1!2026");
    await login(b, "ali@example.test", "DemoCustomer2!2026");
    await login(staff, "maryam@example.test", "DemoStaff1!2026");
    await t.test(
      "anonymous and staff access to customer endpoints is denied",
      async () => {
        const id = randomUUID();
        for (const client of [{ cookie: "" }, staff]) {
          for (const [path, body] of [
            [root, undefined],
            [root, valid],
            [`${root}/${id}`, undefined],
            [`${root}/${id}/replies`, { body: "پاسخ" }],
            [`${root}/${id}/cancel`, {}],
          ]) {
            assert.equal(
              (await request(client, path, body)).status,
              client === staff ? 403 : 401,
            );
          }
        }
      },
    );
    await t.test(
      "valid creation uses session owner and creates initial message/history atomically",
      async () => {
        ticket = await create();
        assert.match(ticket.ticket_number, /^TKT-\d+$/);
        const row = (
          await pool.query(
            "SELECT customer_id, created_by, category, status, assigned_to FROM tickets WHERE id = $1",
            [ticket.id],
          )
        ).rows[0];
        assert.deepEqual(row, {
          customer_id: a.id,
          created_by: a.id,
          category: "technical",
          status: "new",
          assigned_to: null,
        });
        const detail = await request(a, `${root}/${ticket.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.data.messages.length, 1);
        assert.equal(detail.data.messages[0].body, valid.description);
        assert.equal(detail.data.history.length, 1);
        assert.equal(detail.data.history[0].to_status, "new");
        assert.equal(detail.data.ticket.customer_name, "سارا احمدی");
        assert.equal(
          JSON.stringify(detail.data).includes("password_hash"),
          false,
        );
        const spoofed = await request(b, `${root}?customer_id=${a.id}`);
        assert.deepEqual(
          spoofed.data.tickets,
          (await request(b, root)).data.tickets,
        );
      },
    );
    await t.test(
      "lists contain only each customer's active tickets with correct metadata",
      async () => {
        await create(b);
        for (const client of [a, b]) {
          const result = await request(client, root);
          assert.equal(result.status, 200);
          const expected = await pool.query(
            "SELECT id FROM tickets WHERE customer_id = $1 AND NOT is_cancelled ORDER BY updated_at DESC, id DESC",
            [client.id],
          );
          assert.deepEqual(
            result.data.tickets.map((row) => row.id),
            expected.rows.map((row) => row.id),
          );
          assert.ok(
            result.data.tickets.every(
              (row) =>
                row.ticket_number &&
                row.subject &&
                row.priority &&
                row.status &&
                row.updated_at,
            ),
          );
        }
        assert.equal(
          (await request(b, root)).data.tickets.some(
            (row) => row.id === ticket.id,
          ),
          false,
        );
      },
    );
    await t.test(
      "another customer cannot read, reply or cancel using a modified ticket UUID",
      async () => {
        const snapshot = async () =>
          (
            await pool.query(
              `SELECT t.is_cancelled, t.updated_at,
                (SELECT count(*)::int FROM ticket_messages WHERE ticket_id = t.id) AS messages
                FROM tickets t WHERE t.id = $1`,
              [ticket.id],
            )
          ).rows[0];
        const before = await snapshot();
        for (const [suffix, body] of [
          ["", undefined],
          ["/replies", { body: "پاسخ غیرمجاز" }],
          ["/cancel", {}],
        ]) {
          const foreign = await request(
            b,
            `${root}/${ticket.id}${suffix}`,
            body,
          );
          const missing = await request(
            b,
            `${root}/${randomUUID()}${suffix}`,
            body,
          );
          assert.equal(foreign.status, 404);
          assert.deepEqual(foreign, missing);
        }
        assert.equal((await request(a, `${root}/not-a-uuid`)).status, 400);
        assert.equal(
          (await request(a, `${root}/${ticket.id}`)).data.messages.length,
          1,
        );
        assert.deepEqual(await snapshot(), before);
      },
    );
    await t.test(
      "invalid input, spoofed ownership and missing CSRF are rejected without inserting rows",
      async () => {
        const before = Number(
          (await pool.query("SELECT count(*) FROM tickets")).rows[0].count,
        );
        for (const change of [
          { subject: "  " },
          { subject: "x".repeat(201) },
          { description: " " },
          { description: "x".repeat(10001) },
          { priority: "invalid" },
          { category: "invalid" },
          { category: undefined },
          { customer_id: b.id },
          { status: "closed" },
        ]) {
          assert.equal(
            (await request(a, root, { ...valid, ...change })).status,
            400,
          );
        }
        assert.equal((await request(a, root, valid, "")).status, 403);
        assert.equal(
          (
            await request(
              a,
              `${root}/${ticket.id}/replies`,
              { body: "پاسخ" },
              "",
            )
          ).status,
          403,
        );
        assert.equal(
          (await request(a, `${root}/${ticket.id}/cancel`, {}, "")).status,
          403,
        );
        assert.equal(
          (await request(a, `${root}/${ticket.id}/replies`, { body: " " }))
            .status,
          400,
        );
        assert.equal(
          (
            await request(a, `${root}/${ticket.id}/replies`, {
              body: "x".repeat(10001),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(a, `${root}/${ticket.id}/replies`, {
              body: "پاسخ",
              created_by: b.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(a, `${root}/${ticket.id}/cancel`, {
              customer_id: b.id,
            })
          ).status,
          400,
        );
        assert.equal(
          Number(
            (await pool.query("SELECT count(*) FROM tickets")).rows[0].count,
          ),
          before,
        );
      },
    );
    await t.test(
      "replies preserve text, have author/timestamps and update ticket ordering",
      async () => {
        const before = (await request(a, `${root}/${ticket.id}`)).data.ticket
          .updated_at;
        const body = "پاسخ اول: ' ; SELECT 1; -- به صورت متن معمولی";
        assert.equal(
          (await request(a, `${root}/${ticket.id}/replies`, { body })).status,
          201,
        );
        assert.equal(
          (
            await request(a, `${root}/${ticket.id}/replies`, {
              body: "پاسخ دوم",
            })
          ).status,
          201,
        );
        const detail = (await request(a, `${root}/${ticket.id}`)).data;
        assert.deepEqual(
          detail.messages.map((row) => row.body),
          [valid.description, body, "پاسخ دوم"],
        );
        assert.ok(
          detail.messages.every(
            (row) =>
              row.author_name === "سارا احمدی" &&
              row.author_role === "customer",
          ),
        );
        assert.deepEqual(
          detail.messages.map((row) => row.created_at),
          detail.messages.map((row) => row.created_at).toSorted(),
        );
        assert.ok(Date.parse(detail.ticket.updated_at) > Date.parse(before));
        assert.equal((await request(a, root)).data.tickets[0].id, ticket.id);
      },
    );
    await t.test(
      "cancelled messages/history are hidden while active thread remains ordered",
      async () => {
        // Only records belonging to this test-created ticket are soft-cancelled.
        await pool.query(
          "UPDATE ticket_messages SET is_cancelled = TRUE WHERE ticket_id = $1 AND body = $2",
          [ticket.id, "پاسخ دوم"],
        );
        await pool.query(
          "INSERT INTO status_history (created_by, ticket_id, from_status, to_status, is_cancelled) VALUES ($1,$2,'new','in_progress',TRUE)",
          [a.id, ticket.id],
        );
        const detail = (await request(a, `${root}/${ticket.id}`)).data;
        assert.equal(detail.messages.length, 2);
        assert.equal(detail.history.length, 1);
      },
    );
    await t.test(
      "resolved/closed cancellation is denied and all three open statuses can be cancelled",
      async () => {
        for (const status of ["resolved", "closed"]) {
          await pool.query("UPDATE tickets SET status = $2 WHERE id = $1", [
            ticket.id,
            status,
          ]);
          assert.equal(
            (await request(a, `${root}/${ticket.id}/cancel`, {})).status,
            409,
          );
          assert.equal((await request(a, `${root}/${ticket.id}`)).status, 200);
        }
        for (const status of ["new", "in_progress", "waiting_customer"]) {
          const fixture = await create();
          await pool.query("UPDATE tickets SET status = $2 WHERE id = $1", [
            fixture.id,
            status,
          ]);
          assert.equal(
            (await request(a, `${root}/${fixture.id}/cancel`, {})).status,
            200,
          );
          const row = (
            await pool.query("SELECT is_cancelled FROM tickets WHERE id = $1", [
              fixture.id,
            ])
          ).rows[0];
          assert.equal(row.is_cancelled, true);
          assert.equal(
            (await request(a, root)).data.tickets.some(
              (row) => row.id === fixture.id,
            ),
            false,
          );
          for (const [suffix, body] of [
            ["", undefined],
            ["/replies", { body: "پاسخ پس از لغو" }],
            ["/cancel", {}],
          ])
            assert.equal(
              (await request(a, `${root}/${fixture.id}${suffix}`, body)).status,
              404,
            );
        }
      },
    );
    await t.test(
      "concurrent cancellation and reply serialize without post-cancellation writes",
      async () => {
        const fixture = await create();
        const [cancel, reply] = await Promise.all([
          request(a, `${root}/${fixture.id}/cancel`, {}),
          request(a, `${root}/${fixture.id}/replies`, { body: "پاسخ هم‌زمان" }),
        ]);
        assert.equal(cancel.status, 200);
        assert.ok([201, 404].includes(reply.status));
        const count = Number(
          (
            await pool.query(
              "SELECT count(*) FROM ticket_messages WHERE ticket_id = $1",
              [fixture.id],
            )
          ).rows[0].count,
        );
        assert.equal(count, reply.status === 201 ? 2 : 1);
        assert.equal((await request(a, `${root}/${fixture.id}`)).status, 404);
      },
    );
  } finally {
    // Preserve every application record; clean up only by soft cancellation.
    if (fixtures.length) {
      await pool.query(
        "UPDATE ticket_messages SET is_cancelled = TRUE WHERE ticket_id = ANY($1::uuid[])",
        [fixtures],
      );
      await pool.query(
        "UPDATE status_history SET is_cancelled = TRUE WHERE ticket_id = ANY($1::uuid[])",
        [fixtures],
      );
      await pool.query(
        "UPDATE tickets SET is_cancelled = TRUE WHERE id = ANY($1::uuid[])",
        [fixtures],
      );
    }
    for (const client of [a, b, staff])
      if (client.csrf) await request(client, "/api/auth/logout", {});
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
