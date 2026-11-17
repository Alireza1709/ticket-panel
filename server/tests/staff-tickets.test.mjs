import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
const { app } = await import("../dist/app.js");
const { pool } = await import("../dist/db.js");
const { config } = await import("../dist/config.js");

test("staff inbox, transitions, assignment and access restrictions", async (t) => {
  assert.notEqual(config.NODE_ENV, "production");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const root = "/api/staff/tickets";
  const staff = {
    cookie: "",
    csrf: "",
    id: "10000000-0000-4000-8000-000000000003",
  };
  const a = { cookie: "", csrf: "" },
    b = { cookie: "", csrf: "" };
  const otherStaff = "10000000-0000-4000-8000-000000000004";
  const inactiveId = randomUUID();
  const marker = `stafftest-${randomUUID()}`;
  const ids = [];
  async function request(client, path, body, options = {}) {
    const headers = {
      Cookie: client.cookie,
      Origin: options.origin ?? config.APP_ORIGIN,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-Token"] = options.csrf ?? client.csrf ?? "";
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
  async function inbox(filters = {}) {
    return request(
      staff,
      root + "?" + new URLSearchParams({ q: marker, ...filters }),
    );
  }
  const statuses = [
    "new",
    "in_progress",
    "waiting_customer",
    "resolved",
    "closed",
    "new",
  ];
  const priorities = ["low", "normal", "high", "urgent", "normal", "urgent"];
  const dates = [
    "2026-03-20T20:29:59.999Z",
    "2026-03-20T20:30:00.000Z",
    "2026-03-21T08:00:00.000Z",
    "2026-03-21T20:30:00.000Z",
    "2026-03-20T20:30:00.000Z",
    "2026-03-22T08:00:00.000Z",
  ];
  try {
    await login(staff, "maryam@example.test", "DemoStaff1!2026");
    await login(a, "sara@example.test", "DemoCustomer1!2026");
    await login(b, "ali@example.test", "DemoCustomer2!2026");
    for (let index = 0; index < 6; index++) {
      const created = await request(
        index % 2 ? a : b,
        "/api/customer/tickets",
        {
          subject: `بررسی پشتیبانی ${marker} ${index}`,
          description: "درخواست آزمایشی پشتیبانی",
          priority: priorities[index],
          category: "technical",
        },
      );
      assert.equal(created.status, 201);
      ids.push(created.data.ticket.id);
      await pool.query(
        "UPDATE tickets SET status=$2, created_at=$3 WHERE id=$1",
        [ids[index], statuses[index], dates[index]],
      );
    }
    await pool.query(
      `INSERT INTO users (id,created_by,name,email,password_hash,role,is_cancelled)
      SELECT $1,id,'کارشناس غیرفعال آزمایشی',$2,password_hash,'staff',TRUE FROM users WHERE id=$3 AND NOT is_cancelled`,
      [inactiveId, `${inactiveId}@example.test`, staff.id],
    );
    await t.test(
      "all staff APIs reject anonymous users and customers including direct mutation requests",
      async () => {
        for (const client of [{ cookie: "" }, a, b])
          for (const [path, body] of [
            [root, undefined],
            ["/api/staff/members", undefined],
            [`${root}/${ids[0]}`, undefined],
            [`${root}/${ids[0]}/replies`, { body: "پاسخ" }],
            [`${root}/${ids[0]}/status`, { status: "in_progress" }],
            [`${root}/${ids[0]}/assignment`, { assigned_to: otherStaff }],
          ])
            assert.equal(
              (await request(client, path, body)).status,
              client === a || client === b ? 403 : 401,
            );
      },
    );
    await t.test(
      "staff can view both customers and receive only UI fields",
      async () => {
        const all = await request(staff, root + "?page_size=100");
        assert.equal(all.status, 200);
        assert.ok(
          all.data.tickets.some((row) => row.customer_name === "سارا احمدی"),
        );
        assert.ok(
          all.data.tickets.some((row) => row.customer_name === "علی رضایی"),
        );
        const detail = await request(staff, `${root}/${ids[0]}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.data.ticket.category, "technical");
        assert.equal(detail.data.messages.length, 1);
        for (const data of [all.data, detail.data]) {
          assert.equal(JSON.stringify(data).includes("password_hash"), false);
          assert.equal(JSON.stringify(data).includes("csrfToken"), false);
        }
        assert.equal(
          (await request(staff, root + "/invalid-uuid")).status,
          400,
        );
      },
    );
    await t.test(
      "status/priority/search/date filters apply before stable pagination and totals",
      async () => {
        const ordered = (
          await pool.query(
            "SELECT id FROM tickets WHERE id=ANY($1::uuid[]) ORDER BY created_at DESC,id DESC",
            [ids],
          )
        ).rows.map((row) => row.id);
        const pages = [];
        for (let page = 1; page <= 3; page++) {
          const result = await inbox({ page: String(page), page_size: "2" });
          assert.equal(result.status, 200);
          assert.equal(result.data.total, 6);
          assert.equal(result.data.total_pages, 3);
          pages.push(...result.data.tickets.map((row) => row.id));
        }
        assert.deepEqual(pages, ordered);
        assert.equal(new Set(pages).size, 6);
        const beyond = await inbox({ page: "9", page_size: "2" });
        assert.equal(beyond.data.total, 6);
        assert.deepEqual(beyond.data.tickets, []);
        for (const status of new Set(statuses)) {
          const result = await inbox({ status });
          assert.equal(
            result.data.total,
            statuses.filter((value) => value === status).length,
          );
          assert.ok(result.data.tickets.every((row) => row.status === status));
        }
        for (const priority of new Set(priorities)) {
          const result = await inbox({ priority });
          assert.equal(
            result.data.total,
            priorities.filter((value) => value === priority).length,
          );
          assert.ok(
            result.data.tickets.every((row) => row.priority === priority),
          );
        }
        const combined = await inbox({
          status: "new",
          priority: "urgent",
          page_size: "1",
        });
        assert.equal(combined.data.total, 1);
        assert.equal(combined.data.tickets[0].id, ids[5]);
        const number = (await request(staff, `${root}/${ids[0]}`)).data.ticket
          .ticket_number;
        assert.equal(
          (await inbox({ q: number.toLowerCase() })).data.tickets[0].id,
          ids[0],
        );
        assert.equal((await inbox({ q: "%' OR 1=1 --" })).data.total, 0);
        // Tehran midnight inclusive to next Tehran midnight exclusive (1405/01/01).
        const range = await inbox({
          from: "2026-03-20T20:30:00.000Z",
          to: "2026-03-21T20:30:00.000Z",
        });
        assert.equal(range.data.total, 3);
        assert.deepEqual(
          new Set(range.data.tickets.map((row) => row.id)),
          new Set([ids[1], ids[2], ids[4]]),
        );
      },
    );
    await t.test(
      "invalid pagination, filters, search and ambiguous/inverted timestamps return 400",
      async () => {
        for (const filters of [
          { page: "0" },
          { page: "-1" },
          { page: "1.5" },
          { page: "1000001" },
          { page_size: "101" },
          { page_size: "0" },
          { status: "invalid" },
          { priority: "invalid" },
          { q: "x".repeat(101) },
          { from: "1405/01/01" },
          { from: "0000-01-01T00:00:00Z" },
          { from: "2026-03-21T00:00:00" },
          { from: "2026-03-22T00:00:00Z", to: "2026-03-21T00:00:00Z" },
        ])
          assert.equal((await inbox(filters)).status, 400);
      },
    );
    await t.test(
      "mutations require CSRF and matching Origin and reject forged actors",
      async () => {
        for (const [suffix, body] of [
          ["replies", { body: "پاسخ" }],
          ["status", { status: "in_progress" }],
          ["assignment", { assigned_to: otherStaff }],
        ]) {
          assert.equal(
            (
              await request(staff, `${root}/${ids[0]}/${suffix}`, body, {
                csrf: "",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request(staff, `${root}/${ids[0]}/${suffix}`, body, {
                origin: "https://untrusted.invalid",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request(staff, `${root}/${ids[0]}/${suffix}`, {
                ...body,
                created_by: otherStaff,
              })
            ).status,
            400,
          );
        }
      },
    );
    await t.test(
      "staff replies preserve chronology, actor and update timestamps",
      async () => {
        const before = (await request(staff, `${root}/${ids[0]}`)).data.ticket
          .updated_at;
        for (const body of ["پاسخ نخست پشتیبانی", "پاسخ دوم پشتیبانی"])
          assert.equal(
            (await request(staff, `${root}/${ids[0]}/replies`, { body }))
              .status,
            201,
          );
        const detail = (await request(staff, `${root}/${ids[0]}`)).data;
        assert.deepEqual(
          detail.messages.slice(1).map((row) => row.body),
          ["پاسخ نخست پشتیبانی", "پاسخ دوم پشتیبانی"],
        );
        assert.ok(
          detail.messages
            .slice(1)
            .every(
              (row) =>
                row.author_role === "staff" && row.author_name === "مریم کریمی",
            ),
        );
        assert.deepEqual(
          detail.messages.map((row) => row.created_at),
          detail.messages.map((row) => row.created_at).toSorted(),
        );
        assert.ok(Date.parse(detail.ticket.updated_at) > Date.parse(before));
        assert.equal(
          (await request(staff, `${root}/${ids[0]}/replies`, { body: " " }))
            .status,
          400,
        );
      },
    );
    await t.test(
      "status progression and reopening record authenticated actor; invalid and duplicate transitions are atomic",
      async () => {
        for (const status of ["new", "waiting_customer", "resolved", "closed"])
          assert.equal(
            (await request(staff, `${root}/${ids[0]}/status`, { status }))
              .status,
            409,
          );
        let previous = "new";
        for (const status of [
          "in_progress",
          "waiting_customer",
          "in_progress",
          "resolved",
          "in_progress",
          "resolved",
          "closed",
        ]) {
          assert.equal(
            (await request(staff, `${root}/${ids[0]}/status`, { status }))
              .status,
            200,
          );
          const row = (
            await pool.query(
              "SELECT from_status,to_status,created_by FROM status_history WHERE ticket_id=$1 AND NOT is_cancelled ORDER BY created_at DESC,id DESC LIMIT 1",
              [ids[0]],
            )
          ).rows[0];
          assert.deepEqual(row, {
            from_status: previous,
            to_status: status,
            created_by: staff.id,
          });
          previous = status;
        }
        const before = (await request(staff, `${root}/${ids[0]}`)).data;
        for (const status of ["closed", "in_progress", "new"])
          assert.equal(
            (await request(staff, `${root}/${ids[0]}/status`, { status }))
              .status,
            409,
          );
        const after = (await request(staff, `${root}/${ids[0]}`)).data;
        assert.equal(after.history.length, before.history.length);
        assert.equal(after.ticket.updated_at, before.ticket.updated_at);
        assert.equal(
          (
            await request(staff, `${root}/${ids[0]}/status`, {
              status: "invalid",
            })
          ).status,
          400,
        );
        const results = await Promise.all([
          request(staff, `${root}/${ids[5]}/status`, { status: "in_progress" }),
          request(staff, `${root}/${ids[5]}/status`, { status: "in_progress" }),
        ]);
        assert.deepEqual(results.map((row) => row.status).sort(), [200, 409]);
      },
    );
    await t.test(
      "assignment lists active staff only, accepts staff, rejects inactive/customers and preserves unrelated fields",
      async () => {
        const members = await request(staff, "/api/staff/members");
        assert.equal(members.status, 200);
        assert.ok(members.data.members.some((row) => row.id === otherStaff));
        assert.equal(
          members.data.members.some((row) => row.id === inactiveId),
          false,
        );
        assert.ok(
          members.data.members.every(
            (row) => Object.keys(row).sort().join(",") === "id,name",
          ),
        );
        const before = (await request(staff, `${root}/${ids[2]}`)).data.ticket;
        for (const assigned_to of [
          "not-a-uuid",
          "10000000-0000-4000-8000-000000000001",
          inactiveId,
          randomUUID(),
        ])
          assert.equal(
            (
              await request(staff, `${root}/${ids[2]}/assignment`, {
                assigned_to,
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await request(staff, `${root}/${ids[2]}/assignment`, {
              assigned_to: otherStaff,
            })
          ).status,
          200,
        );
        const after = (await request(staff, `${root}/${ids[2]}`)).data.ticket;
        assert.equal(after.assigned_to, otherStaff);
        assert.equal(after.assignee_name, "رضا محمدی");
        assert.ok(Date.parse(after.updated_at) > Date.parse(before.updated_at));
        for (const field of [
          "status",
          "priority",
          "subject",
          "description",
          "customer_name",
          "created_at",
        ])
          assert.deepEqual(after[field], before[field]);
      },
    );
    await t.test(
      "cancelled tickets disappear and reject detail, replies, status and assignment",
      async () => {
        assert.equal(
          (await request(a, `/api/customer/tickets/${ids[5]}/cancel`, {}))
            .status,
          200,
        );
        assert.equal(
          (await inbox()).data.tickets.some((row) => row.id === ids[5]),
          false,
        );
        for (const [suffix, body] of [
          ["", undefined],
          ["/replies", { body: "پاسخ" }],
          ["/status", { status: "resolved" }],
          ["/assignment", { assigned_to: otherStaff }],
        ])
          assert.equal(
            (await request(staff, `${root}/${ids[5]}${suffix}`, body)).status,
            404,
          );
      },
    );
  } finally {
    if (ids.length) {
      await pool.query(
        "UPDATE ticket_messages SET is_cancelled=TRUE WHERE ticket_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query(
        "UPDATE status_history SET is_cancelled=TRUE WHERE ticket_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query(
        "UPDATE tickets SET is_cancelled=TRUE WHERE id=ANY($1::uuid[])",
        [ids],
      );
    }
    for (const client of [staff, a, b])
      if (client.csrf) await request(client, "/api/auth/logout", {});
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
