# Support ticket application

Milestones 1–4: Persian RTL support-ticket application with customer management and a complete staff inbox, replies, status history and assignment. Milestone 5A adds a reviewed HTTP production deployment; see the deployment section below.

## Architecture

- `client/`: React + Vite + strict TypeScript; Tailwind CSS, shadcn-style Button, lucide icons, TanStack Query, React Hook Form + Zod, Jalali calendar/date picker.
- `server/`: Express + strict TypeScript, PostgreSQL pool, Argon2id passwords, PostgreSQL-backed express-session sessions.
- Vite proxies `/api` to Express on `127.0.0.1:3000`. Both development servers bind to localhost.
- Production deployment: nginx on port 80 serves only `client/dist` copied to `/var/www/tickets-app`, and proxies `/api` to the compiled API on `127.0.0.1:3001`. `tickets-api.service` runs the API as `drbtest01` after reboot. Installation uses the manual sudo steps below.

## Existing VM: start here

Your PostgreSQL role is `tickets_user`, database is `tickets_db`, and `server/.env` already contains the working local connection settings. **Keep that file; do not replace it with the example.**

From the project root:

```bash
npm ci
npm run db:migrate
npm run dev:server
```

In a second terminal:

```bash
npm run dev:client
```

Forward localhost port 5173 using VS Code Remote SSH, then open `http://localhost:5173`. `APP_ORIGIN` in `server/.env` must match your browser's exact origin, including scheme, host and port. For example, `http://127.0.0.1:5173` is different from `http://localhost:5173`. Restart Express after changing environment settings.

## Fresh Ubuntu VM

Requirements: Node.js 24, npm 11, PostgreSQL 16, Git; Python 3 is included with Ubuntu. Use the existing repository; no global framework CLI or PostgreSQL extension is needed.

If the role and database do not exist, provision them locally (these commands prompt securely for the database password):

```bash
sudo -u postgres createuser --pwprompt tickets_user
sudo -u postgres createdb --owner=tickets_user tickets_db
npm ci
```

Only on a fresh checkout without `server/.env`, copy the example with private permissions:

```bash
(umask 077; cp -i server/.env.example server/.env)
```

Edit `server/.env` locally. Set `DATABASE_URL` to the local connection URL; percent-encode special characters in its password. Do not paste credentials into chat, command arguments, Git, or screenshots. Never print `.env` while diagnosing errors. The example contains placeholders only.

```bash
npm run config:session
npm run db:migrate
npm run db:seed
```

`config:session` generates a random signing secret directly in the ignored file, prints no secret, sets permissions to `0600`, and preserves an existing valid secret. Keep this secret stable across restarts; replacing it signs everyone out. `NODE_ENV=production` normally requires an HTTPS `APP_ORIGIN`, with Secure cookies. The employer-required HTTP demo uses an explicit `ALLOW_INSECURE_HTTP=true` exception in its separate restricted production environment file. HTTP cookies remain HttpOnly and SameSite=Lax but cannot be Secure. HTTPS origins keep Secure cookies even when that flag is true.

## Demo logins — development only

These deliberately public demonstration credentials are not database credentials or production secrets. The seed stores Argon2id hashes, never plaintext passwords.

| Role | Email | Demo password |
| --- | --- | --- |
| Customer | `sara@example.test` | `DemoCustomer1!2026` |
| Customer | `ali@example.test` | `DemoCustomer2!2026` |
| Staff | `maryam@example.test` | `DemoStaff1!2026` |
| Staff | `reza@example.test` | `DemoStaff2!2026` |

Customers land at `/customer/tickets`; staff land at `/staff/inbox`. Signed-out visitors go to `/login`. Customers can now list, create, view, reply to and cancel eligible tickets. Staff can search/filter/page through all active tickets, reply, assign active staff and change status according to the transition policy below.

## Migrations and seed

- Ordered SQL files live in `server/migrations`. Each migration runs in a transaction. An advisory lock prevents concurrent migrations; checksums detect changes to already-applied files.
- To change an applied schema, add a new numbered migration; never edit the applied file. There is no automatic destructive down/reset command.
- Tables: `users`, `tickets`, `ticket_messages`, `status_history`, plus `sessions` and `schema_migrations` infrastructure tables.
- Every table has UUID `id`, `created_at`, `created_by`, and `is_cancelled DEFAULT FALSE`. Application tables also have `updated_at`, maintained by triggers. Application creators are required; infrastructure creators are nullable before login. The initial staff account references itself as creator using a deferred foreign key.
- Foreign keys enforce customer ownership and staff-only assignment. Statuses: `new`, `in_progress`, `waiting_customer`, `resolved`, `closed`. Priorities: `low`, `normal`, `high`, `urgent`.
- Ticket numbers such as `TKT-00000001` use a unique sequence. Gaps are normal, including after repeat seed runs.
- Database guards reject hard deletion/truncation. Queries exclude cancelled users/sessions; customer ticket/message/history queries also exclude cancelled records. Logout cancels and clears its session row.
- Seed: 2 customers, 2 staff, 20 tickets split equally, 36 messages and 36 history entries across all statuses/priorities. Fixed IDs and conflict handling make reruns non-duplicating and preserve edits/cancellations. Seeding does not reset existing passwords. Seed refuses production mode.

## Authentication and API

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Process health, no session required |
| `GET /api/health/db` | Read-only PostgreSQL check (`SELECT 1`) |
| `GET /api/auth/csrf` | Issues a session-bound CSRF token |
| `POST /api/auth/login` | Zod-validated `{email,password}`; CSRF header required |
| `GET /api/auth/me` | Safe current-user fields, or `{user:null}` |
| `POST /api/auth/logout` | Empty object body; CSRF required; cancels session |
| `GET /api/customer/overview` | Customer role required |
| `GET /api/staff/overview` | Staff role required |

State-changing requests send `X-CSRF-Token` from the CSRF endpoint; login rotates both the session ID and token. The frontend manages these tokens in memory, never localStorage. POST requests with a supplied Origin must match `APP_ORIGIN`. SameSite=Lax and HttpOnly cookies add browser protections. Only the opaque signed session ID is in the cookie; session data is in PostgreSQL. Cookie lifetime is eight hours. A fresh user lookup enforces current role/cancellation status on every protected request. Responses never include password hashes. Login failures have a generic Persian message and an IP-based rate limit (10 failed requests per 15 minutes, in memory).

## Verification

```bash
npm run check
npm run build
npm run test:auth
npm run test:tickets
npm run test:staff
npm run test:health
npm run test:production
```

`test:auth` uses the real local development database after migration/seed. It checks audit columns/guards, seed counts/hashes, correct and wrong passwords, input validation, unauthenticated/role-denied access, CSRF/Origin checks, session rotation/persistence, logout replay rejection, rate limiting, and frontend redirect decisions. It creates/cancels session records but does not delete application records. Demo passwords must still be unchanged for these checks. Run against a development database, not production.

`test:health` uses an intentionally unavailable localhost database port to verify safe HTTP 503 handling, plus process health, unknown routes and malformed JSON. Both healthy endpoints are also checked against the real database by `test:auth`.

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/health/db
```

`npm start` runs the compiled API after `npm run build`; it does not serve the frontend yet. If you change `PORT`, update the Vite proxy too. Browser automation is not installed; frontend verification includes TypeScript, production build, route tests and customer component rendering tests, not browser click tests.

## Completion status

3. Customer ticket management — complete.
4. Staff inbox, pagination, filters/search, replies, assignment and status controls — complete.
5A. HTTP production deployment — installed; post-boot services and port-80 checks verified. Full reboot session/data verification is operator-reported; see the evidence record below.
5B. Full browser interaction and fresh-VM rebuild are not independently verified. Voice-note bonus is not implemented.

Dismiss/back-out buttons use exactly «انصراف», including form/dialog dismissal and leaving ticket detail. «لغو تیکت» opens the ticket-cancellation dialog; «تأیید لغو تیکت» performs the confirmed destructive action. Pagination and filter-reset controls retain their descriptive labels. This distinguishes abandoning a view/action from soft-cancelling a ticket. No explicit TypeScript `any` in application source.

## Milestone 3: customer tickets

After updating this checkout, run `npm run db:migrate` before starting the API. Migration `002_ticket_category.sql` adds only a constrained category column; existing tickets receive `other` and are preserved. Do not edit migration 001 or recreate the database.

Customer pages:

- `/customer/tickets`: your non-cancelled tickets, newest update first, with ticket number, subject, Persian priority/status labels and Jalali last-update times.
- `/customer/tickets/new`: React Hook Form/Zod form for subject, description, priority and category.
- `/customer/tickets/:uuid`: ticket metadata, customer/assignee, chronological messages and read-only status history. Reply and cancellation feedback appears in Persian. Direct links and browser back/forward navigation are supported.

Dates/times on customer ticket pages use the Persian calendar and Tehran time zone. Categories are `technical` (فنی), `billing` (مالی), `account` (حساب کاربری), and `other` (سایر). Subject length is 3–200 characters after trimming; descriptions/replies are 1–10,000. The backend rejects unknown body fields, including attempted `customer_id` or `created_by` overrides.

| Method / endpoint | Customer-only behavior |
| --- | --- |
| `GET /api/customer/tickets` | List only session customer's active tickets |
| `POST /api/customer/tickets` | Create from `{subject,description,priority,category}`; HTTP 201 |
| `GET /api/customer/tickets/:id` | Metadata, active message thread and active status history |
| `POST /api/customer/tickets/:id/replies` | Reply using `{body}`; HTTP 201; updates ticket timestamp |
| `POST /api/customer/tickets/:id/cancel` | Empty object `{}`; soft-cancel an eligible open ticket |

All mutations require the session-bound `X-CSRF-Token`. Ownership is always taken from the authenticated server session, never from request data or URL query parameters. Staff receive HTTP 403 from these customer-only APIs and use the staff API described below. Anonymous access gets HTTP 401. Another customer's, missing, and cancelled ticket UUIDs all return the same HTTP 404 message. Invalid UUIDs/bodies return HTTP 400.

**Cancellation policy:** only `new`, `in_progress`, and `waiting_customer` count as open. `resolved` and `closed` cannot be cancelled (HTTP 409). The browser requires confirmation in a modal dialog; its dismiss button says exactly «انصراف». Cancellation sets only `tickets.is_cancelled=true` and updates its timestamp. Messages/history remain stored for audit but cannot be accessed through normal customer queries once the parent ticket is cancelled. There is no customer restore action.

Replies are allowed on any owned non-cancelled ticket, including resolved/closed tickets. A reply does not automatically change its status. Customers cannot edit status; staff manage status through their separate API. Ticket creation atomically saves the ticket, its description as the first message, and the initial `new` history entry. Row locks serialize replies/cancellation; a reply waiting behind a successful cancellation is rejected.

`npm run test:tickets` runs PostgreSQL-backed customer security/workflow tests and customer rendering checks. It logs in with the public demo accounts, creates its own fixture tickets, and soft-cancels only those fixtures during cleanup. It never deletes records or modifies the 20 seeded tickets. Repeated test runs leave cancelled audit records and gaps in ticket numbers, as expected. The suite checks ownership/list isolation (including direct foreign UUIDs), malformed/spoofed data, CSRF, replies/order/update timestamps, hidden cancelled children, eligibility, post-cancellation denial and concurrent reply/cancellation. Frontend tests cover Persian loading/empty/error states, Jalali dates, safe text rendering and protected URL routing. No dependencies were added.

## Milestone 4: support staff

No new migration or environment setting is required for Milestone 4. Do not reset the database or rerun the seed to enable staff features. Restart the API and Vite dev processes if they were not watching changes.

Staff start at `/staff/inbox`. The inbox lists all non-cancelled tickets by **creation time descending, then UUID descending**; the displayed last-update date changes after replies, assignment and status changes, but ordering remains by creation time. Open a ticket for metadata, chronological active messages and read-only status history. Staff can reply, assign an active staff member and choose one of the allowed next statuses.

Search, status, priority, date boundaries, page and page size live in URL query parameters. Applying filters resets page to 1; changing pages preserves filters. Refreshing or sharing a filtered URL preserves its state. Detail links keep the same query so “back to inbox” returns to that filtered page. Invalid URL parameters show a Persian reset/retry state. Draft filter edits are applied when you press «اعمال فیلترها».

### Staff API

All routes require the current authenticated role `staff`; signed-out requests return 401 and customer requests return 403. Every POST also requires `X-CSRF-Token` and the configured Origin check.

| Method / endpoint | Body or result |
| --- | --- |
| `GET /api/staff/tickets` | Filtered ticket summaries plus `page`, `page_size`, `total`, `total_pages` |
| `GET /api/staff/tickets/:id` | Metadata, active messages and status history |
| `GET /api/staff/members` | Active staff `{id,name}` only |
| `POST /api/staff/tickets/:id/replies` | `{body}`; 1–10,000 trimmed characters |
| `POST /api/staff/tickets/:id/status` | `{status}`; a permitted next status |
| `POST /api/staff/tickets/:id/assignment` | `{assigned_to}`; active staff UUID |

Inbox query parameters:

| Parameter | Rules |
| --- | --- |
| `page` | Positive decimal integer, default 1, maximum 1,000,000 |
| `page_size` | Positive decimal integer, default 20, maximum 100 |
| `status` | One of the five known statuses; omit for all |
| `priority` | `low`, `normal`, `high`, `urgent`; omit for all |
| `q` | Trimmed literal case-insensitive substring of ticket number or subject; at most 100 characters |
| `from` | Optional ISO 8601 timestamp with `Z` or explicit offset; inclusive |
| `to` | Optional ISO 8601 timestamp with `Z` or explicit offset; exclusive; later than `from` |

Unknown/invalid parameters return HTTP 400. `from`/`to` must be real supported timestamps (year zero is rejected). All filters are applied before both counting and pagination. Count/page are read in a single repeatable-read snapshot. A page beyond the last page returns an empty list with the correct total; the UI offers page 1. Empty results report `total_pages=1` for navigation. SQL parameters carry every search/filter/limit/offset value; `%` and `_` are literal search characters, not wildcard operators. Large-scale text search/index optimization and cursor pagination are outside this interview milestone.

### Jalali date ranges

The two Jalali pickers select the first and last calendar days inclusively, interpreted in **Asia/Tehran**, regardless of the browser/VM timezone. The browser converts them to UTC ISO strings: start of the first selected day, and start of the day after the last selected day. It sends no ambiguous Jalali strings to PostgreSQL.

For example, selecting **۱۴۰۵/۰۱/۰۱** for both endpoints produces:

```text
from=2026-03-20T20:30:00.000Z
to=2026-03-21T20:30:00.000Z
```

The API uses `created_at >= from AND created_at < to`. Conversion uses the IANA Tehran timezone, including historical daylight-saving rules; it does not assume the host timezone or a permanent fixed offset. UTC, Los Angeles, Tokyo, Persian New Year/leap-day and historical DST cases are tested. The shared `JalaliPicker` retains the CommonJS/default-export normalization that fixed the earlier blank-screen issue.

### Status transition policy

| Current status | Allowed next statuses |
| --- | --- |
| `new` | `in_progress` |
| `in_progress` | `waiting_customer`, `resolved` |
| `waiting_customer` | `in_progress`, `resolved` |
| `resolved` | `in_progress` (reopen), `closed` |
| `closed` | None; terminal status |

This policy governs new API changes; existing demonstration history is preserved. Skipping from new to resolved/closed, returning to new, or submitting the same status returns HTTP 409. A transaction locks the active ticket, validates its current status, updates it and inserts history with the authenticated staff actor. Invalid or concurrent duplicate transitions do not create history records. Assignment and replies are independent of status: as with the existing customer behavior, replies on resolved/closed tickets do not reopen them. Assignment updates only `assigned_to` (plus the normal timestamp trigger); assigning the same staff member is a successful no-op. Unassignment is not part of this milestone. Active-ticket checks and row locks prevent writes to cancelled tickets; these return 404. Customer IDs, inactive staff, unknown IDs, malformed UUIDs and caller-supplied actor fields are rejected.

### Staff verification

`npm run test:staff` runs backend integration tests and frontend URL/date/rendering tests. It creates its own tickets and an already-cancelled staff fixture, then soft-cancels test tickets/messages/history. It never alters the 20 original seed tickets or deletes records. The inactive fixture remains as a cancelled audit record.

The suite covers both seeded customers, customer/anonymous denial on every staff endpoint, pagination/totals/stable tie ordering, combined filters, number/subject search, date boundaries, request validation, CSRF/Origin/actor spoofing, staff reply authors/order, transition history/reopening/invalid/concurrent changes, active-only assignment and cancelled-ticket denial. React tests render the actual staff Landing inbox/detail with real Jalali filter/footer pickers, persisted filters, pagination and loading/empty/error states. Picker text initializes during browser mounting, so calendar conversion and URL restoration are separately tested as well. Full browser clicking/keyboard interaction remains a manual review step; it is not claimed by server rendering tests.

## Milestone 5A: HTTP production deployment

**Target on this VM:** `http://192.168.113.113` (port 80). This is intentionally **HTTP without TLS**, as required by the employer. Passwords and session cookies can be observed by someone able to inspect the network. Use only the public demonstration accounts above; this is not an HTTPS-secure deployment and is unsuitable for real credentials or sensitive tickets. CSRF, Origin checks, signed HttpOnly/SameSite cookies, password hashing and authorization remain enabled, but do not provide transport encryption. No HSTS or upgrade-to-HTTPS header is sent on this HTTP origin.

The required exception is explicit: `NODE_ENV=production`, `ALLOW_INSECURE_HTTP=true`, `APP_ORIGIN=http://192.168.113.113`. HTTPS remains the default production policy. There is no wildcard CORS configuration: frontend and `/api` share one origin. The API binds to localhost in code, and trusts only loopback proxies. nginx overwrites forwarded protocol/client-IP headers and preserves API paths, methods, bodies and cookies. `/api` and `/api/` never enter the React fallback; missing assets/private paths return 404.

### Fresh Ubuntu 24.04 VM

Do not repeat provisioning on this already-working VM. All sudo commands in this README are for the operator to run manually. No command changes SSH, firewall or VM network settings.

1. Use your existing unprivileged SSH account. The checked-in unit expects `drbtest01`, `/home/drbtest01/tickets-app`, `/usr/bin/node` and PostgreSQL cluster `16/main`; edit those explicit paths in a copy of the unit for a different fresh host. Never recursively chown the project to www-data/root.
2. Install system packages:

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib git python3 curl ca-certificates xz-utils ripgrep build-essential
```

3. Install Node 24/npm 11 using an employer-approved method. For a fresh **x86_64** VM without Node, this pinned [official Node.js release](https://nodejs.org/en/download) is compatible with the tested runtime (use the matching architecture for ARM). These commands download only from the public official Node.js host, not another employer machine:

```bash
cd /tmp
curl -fSLO https://nodejs.org/dist/v24.22.3/node-v24.22.3-linux-x64.tar.xz
curl -fSLO https://nodejs.org/dist/v24.22.3/SHASUMS256.txt
rg ' node-v24.22.3-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum --check -
sudo tar -xJf node-v24.22.3-linux-x64.tar.xz -C /opt
sudo ln -s /opt/node-v24.22.3-linux-x64/bin/node /usr/bin/node
sudo ln -s /opt/node-v24.22.3-linux-x64/bin/npm /usr/local/bin/npm
node --version
npm --version
```

Do not replace an existing Node installation with these symlink commands. Confirm Node 24, npm 11 and `command -v node` before continuing. The systemd unit and preflight script use the inspected `/usr/bin/node` path; adapt it if your approved installation differs. The official download page also links signed-checksum verification.

4. Put this Git checkout at `/home/drbtest01/tickets-app` using your approved repository transfer/clone method. Create a database only on a fresh VM where it does not exist:

```bash
sudo -u postgres createuser --pwprompt tickets_user
sudo -u postgres createdb --owner=tickets_user tickets_db
cd /home/drbtest01/tickets-app
npm ci
python3 deploy/configure-env.py
npm run db:migrate
npm run db:seed
```

The Python helper prompts with typing hidden, percent-encodes the password and creates `server/.env` with mode 0600 and a generated signing secret. It refuses to overwrite an existing file. On this existing VM, preserve the working `server/.env` and database; do not recreate/reset/reseed them. Migration files/checksums remain the source of schema history.

5. Confirm PostgreSQL is local-only and its cluster is set to automatic startup:

```bash
pg_lsclusters
ss -lnt
cat /etc/postgresql/16/main/start.conf
systemctl is-enabled postgresql
```

Port 5432 must be on loopback, not `0.0.0.0` or a public interface. If that is not true, stop and request a reviewed configuration change rather than changing network/firewall settings implicitly.

### Build and prepare (normal user)

```bash
cd /home/drbtest01/tickets-app
npm run check
npm run build
npm run test:production
npm run test:auth
npm run test:tickets
npm run test:staff
npm run test:health
node deploy/prepare.mjs http://192.168.113.113
node deploy/preflight.mjs
```

Use this VM's actual IPv4 address from `ip -4 -brief address show scope global`. `prepare.mjs` rejects other machines' addresses and reads the existing local connection/signing settings without printing them. It creates ignored owner-only `deploy/.runtime/server.env` and the rendered nginx site. It leaves `server/.env` unchanged, preserving development on ports 3000/5173. Do not display or commit `.runtime` files.

`preflight.mjs` runs as the normal user: syntax-checks nginx and the unit, temporarily runs production Express on 127.0.0.1:3001 and nginx on 127.0.0.1:8080, then tests the actual proxy/configuration with the production Host/Origin. It stops its own processes afterward. Ports 3001/8080 must be free; run this before installing/starting the production service. This rehearsal is **not** proof that port 80/systemd has been installed.

### Install and start (manual sudo)

Review `deploy/nginx.conf.template`, `deploy/nginx-proxy.conf` and `deploy/tickets-api.service` first. On this VM the default nginx welcome site can stay enabled: the new site matches the exact VM IP, avoiding a destructive default-site removal.

```bash
cd /home/drbtest01/tickets-app
sudo install -d -m 0755 /etc/tickets-app /var/www/tickets-app
sudo install -m 0600 deploy/.runtime/server.env /etc/tickets-app/server.env
sudo install -m 0644 deploy/nginx-proxy.conf /etc/nginx/tickets-proxy.conf
sudo install -m 0644 deploy/.runtime/tickets-app.conf /etc/nginx/sites-available/tickets-app
sudo ln -s /etc/nginx/sites-available/tickets-app /etc/nginx/sites-enabled/tickets-app
sudo cp -R client/dist/. /var/www/tickets-app/
sudo install -m 0644 deploy/tickets-api.service /etc/systemd/system/tickets-api.service
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now postgresql nginx tickets-api
sudo systemctl reload nginx
```

Stop on any error. The `ln -s` command is first-install-only; do not overwrite an unexpected existing site. Only compiled static files are copied to the public directory, never the repository/server/.env. Old hashed asset files may remain on updates; retaining them avoids breaking already-open browser tabs. The root-owned 0600 environment file is read by systemd and injected into the unprivileged service. The service uses automatic restart, restrictive file permissions, read-only filesystem/home access and a private temporary directory; no project ownership change is needed.

### Verify actual port 80 and a service restart

```bash
systemctl is-active tickets-api nginx postgresql@16-main ssh.socket
systemctl is-enabled tickets-api nginx postgresql ssh.socket
ss -lnt
curl --fail http://192.168.113.113/api/health
curl --fail http://192.168.113.113/api/health/db
node deploy/smoke.mjs http://192.168.113.113 --prepare-restart
sudo systemctl restart tickets-api
node deploy/smoke.mjs http://192.168.113.113 --verify-restart
```

The smoke test uses only demo credentials, creates its own test ticket, verifies public/nested routes and missing API/private assets, login/session/logout/CSRF/Origin, customer/staff roles, cross-customer UUID denial and staff reply/status/assignment. It never prints cookies/passwords/tokens. The restart phase stores short-lived test sessions only in ignored mode-0600 state, then checks that sessions, the new ticket and all 20 original demo-ticket summaries survive restart unchanged. It soft-cancels its test ticket, logs out test accounts and scrubs the saved session state after verification. Run the two phases promptly (sessions expire after eight hours). Do not inspect/share the state JSON. If preparation fails, do not reset/reseed data; inspect service health and report only non-secret errors.

In the browser, manually check both roles, a real Jalali filter, customer/staff detail and refresh on a nested URL. A curl/rendering test cannot confirm browser focus, calendar clicking or all browser cookie behavior. Use separate private sessions or log out when switching roles.

### Startup, shutdown and updates

```bash
# Start/stop only the application service; leave PostgreSQL data and SSH alone.
sudo systemctl start tickets-api
sudo systemctl stop tickets-api
sudo systemctl restart tickets-api
systemctl status tickets-api --no-pager
sudo journalctl -u tickets-api -n 50 --no-pager
```

Review logs locally before sharing; never print environment files or use commands that dump a service's complete environment. Stopping the API leaves nginx running (API requests return 502 until restarted).

For an update, obtain reviewed source changes using your normal Git workflow; do not use destructive reset/clean commands. Then:

```bash
npm ci
npm run check
npm run build
npm run test:production
npm run test:auth
npm run test:tickets
npm run test:staff
npm run test:health
npm run db:migrate
sudo cp -R client/dist/. /var/www/tickets-app/
sudo systemctl restart tickets-api
sudo nginx -t
sudo systemctl reload nginx
node deploy/smoke.mjs http://192.168.113.113
```

Do not run the demo seed during normal updates. Keep the signing secret stable across restarts/reboots. Reinstall the service/proxy files and daemon-reload only when those files change. If the VM IP changes, regenerate the deployment files for the new local address, reinstall the restricted environment/nginx site, restart the API and reload nginx. Do not probe the old address if it is no longer assigned to this VM.

### Manual reboot checklist — never automatic

SSH on this inspected VM is socket-activated: `ssh.socket` is enabled/active on **port 5150**. `ssh.service` can show disabled while this is correct. PostgreSQL 16/main has `start.conf=auto`; its parent postgresql service is enabled. No SSH settings were changed.

Before considering reboot, all application checks above must pass. From your own workstation, open a second fresh SSH session and keep it available:

```bash
ssh -p 5150 drbtest01@192.168.113.113
```

Inside the VM, verify again:

```bash
systemctl is-active ssh.socket ssh tickets-api nginx postgresql@16-main
systemctl is-enabled ssh.socket tickets-api nginx postgresql
ss -lnt
node deploy/smoke.mjs http://192.168.113.113 --prepare-restart
```

Only after confirming a new SSH login works and all boot units are enabled, **you** may run:

```bash
sudo reboot
```

Codex must not execute it. Reconnect from your workstation with the same SSH command. Then:

```bash
uptime -s
ip -4 -brief address show scope global
systemctl is-active ssh.socket ssh tickets-api nginx postgresql@16-main
systemctl is-enabled ssh.socket tickets-api nginx postgresql
ss -lnt
curl --fail http://192.168.113.113/api/health
curl --fail http://192.168.113.113/api/health/db
cd /home/drbtest01/tickets-app
node deploy/smoke.mjs http://192.168.113.113 --verify-restart
```

The API must listen only at 127.0.0.1:3001; PostgreSQL only on loopback:5432; nginx on port 80; SSH remains on 5150. Confirm the IP is still assigned locally before using that URL. Finally reload a nested browser route and confirm both roles work without starting any development server. This checklist is retained for future operator use; current reboot evidence is recorded below. Codex has not executed a reboot.

### Troubleshooting and verification record

- 502 from `/api`: inspect `systemctl status tickets-api`, the local service journal, `ss -lnt`, and PostgreSQL health. Confirm nginx upstream is 127.0.0.1:3001 and the compiled entrypoint exists. Never publish server source as a workaround.
- Login succeeds but does not stay logged in on HTTP: confirm the generated production environment includes the explicit HTTP exception and exact origin, restart the service, and check only cookie **flags** in DevTools (never share cookie values).
- 403 on writes: browser origin must exactly match APP_ORIGIN; client CSRF token/session must be current. Do not disable CSRF or Origin checks.
- nginx welcome page: use the exact configured VM IP; verify the site symlink and `sudo nginx -t`, then reload nginx. Do not change DNS, SSH or firewall settings implicitly.
- Nested route 404: verify `try_files ... /index.html`; `/api` must retain its dedicated proxy locations.
- nginx cannot read static files: publish compiled dist under /var/www as shown. Do not loosen the private home directory or expose the repository.
- Auth tests found a legitimate extra browser reply (37 messages vs 36 seed fixtures). The assertion now counts fixed seed-message/history IDs rather than deleting data or treating ordinary browser activity as a failure.
- Verified so far: TypeScript/builds, production HTTP opt-in/cookie tests, existing auth/customer/staff/health suites, repeatable migration checks and normal-user nginx/unit syntax + production-mode proxy rehearsal. The original four accounts, twenty seed tickets and browser-added reply were preserved.
- After the operator completed the manual installation: actual nginx port-80 static/nested-route/API checks passed, all required services were active/enabled, the API ran as drbtest01 on loopback:3001, and the root-owned environment was 0600. A manual systemctl restart changed the service PID; saved customer/staff sessions, the new test ticket and all 20 original ticket summaries survived unchanged. Test cleanup then soft-cancelled its ticket and logged out its sessions. The existing approximately 538 kB JS bundle warning is non-blocking. No voice-note work was started.

- Reboot evidence reviewed on 2026-11-17: the operator reports completing full reboot verification. The journal records distinct previous/current boots, with current boot time 11:32:39 UTC. nginx became active at 11:33:57; the API and PostgreSQL at 11:34:00. Required services are enabled at boot; the acceptance audit verified working port-80 health, SPA routes and matching published assets after this boot. This establishes a real boot and working post-boot services, beyond enablement alone.
- The ignored smoke state contains only a scrubbed completion marker, modified at 11:37:29 UTC. It retains no boot ID or assertion output; `smoke.mjs` writes it during cleanup, so the marker alone is not proof that every verification assertion passed. Full-reboot session/data persistence remains operator-reported and is not independently established from retained artifacts. Browser interactions and a fresh-VM rebuild are also not independently verified. Do not rerun a reboot merely to update this record.
- Final correction verification: `npm run check`, `npm run build`, `npm run test:auth`, `npm run test:tickets`, `npm run test:staff`, `npm run test:health` and `npm run test:production` all passed (50 reported tests, including parent tests). NOTES was typeset to one A4 page with 18 mm margins, 11 pt body text and 14 pt leading. Six personal-hours placeholders remain for the owner. The corrected frontend was built, but not copied to `/var/www/tickets-app`; publish `client/dist/.` there using the existing manual update procedure before submitting the revised UI. No configuration change, API restart or reboot is needed for these text-only frontend changes.
