import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { localOrigin } from "./local-origin.mjs";

function check(condition, label) {
  if (!condition) throw new Error(label);
}
const stateFile = new URL("./.runtime/restart-state.json", import.meta.url);
function browser() {
  return { cookie: "", csrf: "" };
}
export async function verifyDeployment(
  origin,
  base = origin,
  prepareRestart = false,
  resume = false,
) {
  check(
    process.getuid() !== 0,
    "Run deployment smoke checks as the normal project user",
  );
  if (prepareRestart) {
    const pending = await readFile(stateFile, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    check(
      !pending || JSON.parse(pending).completed === true,
      "Finish the pending restart verification before preparing another",
    );
  }
  const url = localOrigin(origin);
  const transport = new URL(base);
  check(
    base === origin ||
      (transport.protocol === "http:" && transport.hostname === "127.0.0.1"),
    "Transport must be this VM or loopback",
  );
  async function request(client, path, body, options = {}) {
    const destination = new URL(path, base);
    check(
      destination.origin === transport.origin,
      "Cross-origin transport requests are prohibited",
    );
    const headers = {
      Host: url.host,
      Origin: options.origin ?? origin,
      Cookie: client.cookie,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-Token"] = options.csrf ?? client.csrf;
    }
    const response = await fetch(destination, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("tickets.sid="));
    if (cookie) client.cookie = cookie.split(";")[0];
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return {
      status: response.status,
      headers: response.headers,
      text,
      data,
      cookie,
    };
  }
  async function login(client, email, password, role) {
    const csrf = await request(client, "/api/auth/csrf");
    check(csrf.status === 200, "CSRF endpoint");
    client.csrf = csrf.data.csrfToken;
    const result = await request(client, "/api/auth/login", {
      email,
      password,
    });
    check(
      result.status === 200 && result.data.user.role === role,
      "Production login/role",
    );
    check(
      Boolean(result.cookie) &&
        /HttpOnly/i.test(result.cookie) &&
        /SameSite=Lax/i.test(result.cookie) &&
        !/;\s*Secure/i.test(result.cookie),
      "Explicit HTTP cookie flags",
    );
    check(!("password_hash" in result.data.user), "Safe user response");
    client.csrf = result.data.csrfToken;
    return result.data.user;
  }
  async function seedSnapshot(staff) {
    const rows = [];
    for (let page = 1; ; page++) {
      const result = await request(
        staff,
        `/api/staff/tickets?page=${page}&page_size=100`,
      );
      check(result.status === 200, "Staff inbox");
      rows.push(
        ...result.data.tickets.filter((ticket) =>
          ticket.id.startsWith("20000000-0000-4000-8000-"),
        ),
      );
      if (page >= result.data.total_pages) break;
    }
    check(rows.length === 20, "All twenty original demo tickets remain active");
    return JSON.stringify(rows.toSorted((a, b) => a.id.localeCompare(b.id)));
  }
  async function logout(client) {
    const previous = { cookie: client.cookie, csrf: client.csrf };
    check(
      (await request(client, "/api/auth/logout", {})).status === 200,
      "Production logout",
    );
    check(
      (await request(previous, "/api/auth/me")).data.user === null,
      "Logged-out cookie replay rejected",
    );
  }
  let customer = browser(),
    staff = browser(),
    ticketId,
    snapshot;
  const second = browser();
  let kept = false;
  try {
    if (resume) {
      const state = JSON.parse(await readFile(stateFile, "utf8"));
      check(
        !state.completed && state.origin === origin,
        "Matching pending restart check required",
      );
      ({ customer, staff, ticketId, snapshot } = state);
      check(
        (await request(customer, "/api/auth/me")).data.user?.role ===
          "customer",
        "Customer session survived service restart",
      );
      check(
        (await request(staff, "/api/auth/me")).data.user?.role === "staff",
        "Staff session survived service restart",
      );
      check(
        (await request(customer, `/api/customer/tickets/${ticketId}`))
          .status === 200,
        "Created ticket survived service restart",
      );
      check(
        (await seedSnapshot(staff)) === snapshot,
        "Original demo ticket data survived restart unchanged",
      );
      console.log(
        "PASS: authenticated sessions and original/new ticket data survived backend restart.",
      );
    } else {
      for (const path of ["/", "/customer/tickets", "/staff/inbox?page=1"]) {
        const page = await request(browser(), path);
        check(
          page.status === 200 &&
            page.text.includes('id="root"') &&
            !page.text.includes("/src/main.tsx"),
          "Compiled SPA and nested-route fallback",
        );
        check(
          !page.headers.has("strict-transport-security"),
          "No misleading HSTS on required HTTP origin",
        );
        const asset = page.text.match(/<script[^>]+src="([^"]+)"/);
        check(
          Boolean(asset) && (await request(browser(), asset[1])).status === 200,
          "Compiled JavaScript asset",
        );
      }
      for (const path of ["/api", "/api/missing-route"]) {
        const result = await request(browser(), path);
        check(
          result.status === 404 && result.data !== null,
          "API misses must be JSON, not SPA HTML",
        );
      }
      for (const path of [
        "/.env",
        "/server/.env",
        "/client/src/App.tsx",
        "/package.json",
        "/README.md",
        "/assets/missing.js",
      ])
        check(
          (await request(browser(), path)).status === 404,
          "Private/source/missing assets not served",
        );
      for (const path of ["/api/health", "/api/health/db"]) {
        const result = await request(browser(), path);
        check(
          result.status === 200 && result.data.status === "ok",
          "Health through nginx",
        );
        check(
          !result.headers.has("strict-transport-security"),
          "HTTP API headers",
        );
      }
      check(
        (await request(browser(), "/api/staff/tickets")).status === 401,
        "Anonymous API access denied",
      );
      const customerUser = await login(
        customer,
        "sara@example.test",
        "DemoCustomer1!2026",
        "customer",
      );
      await login(second, "ali@example.test", "DemoCustomer2!2026", "customer");
      const staffUser = await login(
        staff,
        "maryam@example.test",
        "DemoStaff1!2026",
        "staff",
      );
      check(
        (await request(customer, "/api/auth/me")).data.user.id ===
          customerUser.id,
        "Session persists across HTTP requests",
      );
      check(
        (await request(customer, "/api/staff/tickets")).status === 403,
        "Customer staff-role restriction",
      );
      snapshot = await seedSnapshot(staff);
      const body = {
        subject: "آزمایش استقرار سامانه",
        description: "درخواست آزمایشی برای بررسی استقرار",
        category: "technical",
        priority: "normal",
      };
      check(
        (await request(customer, "/api/customer/tickets", body, { csrf: "" }))
          .status === 403,
        "CSRF on production writes",
      );
      check(
        (
          await request(customer, "/api/customer/tickets", body, {
            origin: "http://untrusted.invalid",
          })
        ).status === 403,
        "Origin allowlist on production writes",
      );
      const created = await request(customer, "/api/customer/tickets", body);
      check(created.status === 201, "Production ticket creation");
      ticketId = created.data.ticket.id;
      for (const [suffix, payload] of [
        ["", undefined],
        ["/replies", { body: "پاسخ غیرمجاز" }],
        ["/cancel", {}],
      ])
        check(
          (
            await request(
              second,
              `/api/customer/tickets/${ticketId}${suffix}`,
              payload,
            )
          ).status === 404,
          "Cross-customer UUID restriction",
        );
      const members = await request(staff, "/api/staff/members");
      check(members.status === 200, "Eligible staff API");
      const member =
        members.data.members.find((value) => value.id !== staffUser.id) ??
        members.data.members[0];
      check(Boolean(member), "Active staff exists");
      check(
        (
          await request(staff, `/api/staff/tickets/${ticketId}/assignment`, {
            assigned_to: member.id,
          })
        ).status === 200,
        "Staff assignment",
      );
      check(
        (
          await request(staff, `/api/staff/tickets/${ticketId}/status`, {
            status: "in_progress",
          })
        ).status === 200,
        "Staff status/history transaction",
      );
      check(
        (
          await request(staff, `/api/staff/tickets/${ticketId}/replies`, {
            body: "پاسخ آزمایشی پشتیبانی",
          })
        ).status === 201,
        "Staff reply through nginx",
      );
      check(
        (
          await request(customer, `/api/customer/tickets/${ticketId}/replies`, {
            body: "پاسخ آزمایشی مشتری",
          })
        ).status === 201,
        "Customer reply through nginx",
      );
      const detail = await request(staff, `/api/staff/tickets/${ticketId}`);
      check(
        detail.status === 200 &&
          detail.data.ticket.assigned_to === member.id &&
          detail.data.messages.length === 3 &&
          detail.data.history.at(-1).to_status === "in_progress",
        "Staff detail/thread/history",
      );
      await logout(second);
      console.log(
        "PASS: compiled SPA/routes/assets, health, login/cookie/session/logout, CSRF/Origin, role/ownership and staff operations through nginx.",
      );
      if (prepareRestart) {
        await mkdir(new URL("./.runtime/", import.meta.url), {
          recursive: true,
          mode: 0o700,
        });
        await writeFile(
          stateFile,
          JSON.stringify({ origin, customer, staff, ticketId, snapshot }),
          { mode: 0o600 },
        );
        await chmod(stateFile, 0o600);
        kept = true;
        console.log(
          "Restart check prepared in ignored owner-only state. Run sudo systemctl restart tickets-api, then smoke.mjs with --verify-restart.",
        );
        return;
      }
    }
  } finally {
    if (!kept) {
      if (ticketId)
        check(
          (
            await request(
              customer,
              `/api/customer/tickets/${ticketId}/cancel`,
              {},
            )
          ).status === 200,
          "Soft-cancel deployment test ticket",
        );
      if (customer.cookie) await logout(customer);
      if (staff.cookie) await logout(staff);
      if (second.cookie && second.csrf)
        await request(second, "/api/auth/logout", {});
      if (resume)
        await writeFile(stateFile, '{"completed":true}\n', { mode: 0o600 });
    }
  }
  console.log(
    "PASS: test ticket soft-cancelled and test sessions invalidated; original demo data preserved.",
  );
}

if (
  process.argv[1] &&
  new URL(process.argv[1], "file:").href === import.meta.url
) {
  try {
    const flags = process.argv.slice(2),
      origin = flags[0];
    await verifyDeployment(
      origin,
      origin,
      flags.includes("--prepare-restart"),
      flags.includes("--verify-restart"),
    );
  } catch {
    console.error(
      "Deployment smoke check failed. Details withheld to protect credentials/cookies; check service health and demo accounts.",
    );
    process.exitCode = 1;
  }
}
