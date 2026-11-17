# Support ticket application

Milestones 1–3: Persian RTL foundation, PostgreSQL schema/demo seed, role-based authentication, and customer ticket management. Staff inbox workflows and deployment remain later milestones.

## Architecture

- `client/`: React + Vite + strict TypeScript; Tailwind CSS, shadcn-style Button, lucide icons, TanStack Query, React Hook Form + Zod, Jalali calendar/date picker.
- `server/`: Express + strict TypeScript, PostgreSQL pool, Argon2id passwords, PostgreSQL-backed express-session sessions.
- Vite proxies `/api` to Express on `127.0.0.1:3000`. Both development servers bind to localhost.
- Later deployment: nginx on port 80 serves `client/dist` and proxies `/api`; systemd starts Express after reboot. These are not implemented yet.

## Existing VM: start here

Your PostgreSQL role is `tickets_user`, database is `tickets_db`, and `server/.env` already contains the working local connection settings. **Keep that file; do not replace it with the example.**

From the project root:

```bash
npm ci
npm run config:session
npm run db:migrate
npm run db:seed
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

`config:session` generates a random signing secret directly in the ignored file, prints no secret, sets permissions to `0600`, and preserves an existing valid secret. Keep this secret stable across restarts; replacing it signs everyone out. `NODE_ENV=production` requires an HTTPS `APP_ORIGIN`; production session cookies use `Secure`. Local HTTP uses `NODE_ENV=development`. Production HTTPS/reverse-proxy deployment is a later milestone.

## Demo logins — development only

These deliberately public demonstration credentials are not database credentials or production secrets. The seed stores Argon2id hashes, never plaintext passwords.

| Role | Email | Demo password |
| --- | --- | --- |
| Customer | `sara@example.test` | `DemoCustomer1!2026` |
| Customer | `ali@example.test` | `DemoCustomer2!2026` |
| Staff | `maryam@example.test` | `DemoStaff1!2026` |
| Staff | `reza@example.test` | `DemoStaff2!2026` |

Customers land at `/customer/tickets`; staff land at `/staff/inbox`. Signed-out visitors go to `/login`. Customers can now list, create, view, reply to and cancel eligible tickets. The staff page remains its Milestone 2 placeholder; staff inbox functionality is not implemented.

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
npm run test:health
```

`test:auth` uses the real local development database after migration/seed. It checks audit columns/guards, seed counts/hashes, correct and wrong passwords, input validation, unauthenticated/role-denied access, CSRF/Origin checks, session rotation/persistence, logout replay rejection, rate limiting, and frontend redirect decisions. It creates/cancels session records but does not delete application records. Demo passwords must still be unchanged for these checks. Run against a development database, not production.

`test:health` uses an intentionally unavailable localhost database port to verify safe HTTP 503 handling, plus process health, unknown routes and malformed JSON. Both healthy endpoints are also checked against the real database by `test:auth`.

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/health/db
```

`npm start` runs the compiled API after `npm run build`; it does not serve the frontend yet. If you change `PORT`, update the Vite proxy too. Browser automation is not installed; frontend verification includes TypeScript, production build, route tests and customer component rendering tests, not browser click tests.

## Remaining milestones

3. Customer ticket management — complete.
4. Staff pagination, filters, search, assignment and status history UI.
5. Full UI/accessibility checks, nginx deployment, HTTPS decision and systemd startup.

Cancel buttons use «انصراف». No explicit TypeScript `any` in application source.

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

All mutations require the session-bound `X-CSRF-Token`. Ownership is always taken from the authenticated server session, never from request data or URL query parameters. Staff receive HTTP 403 from these customer-only APIs; staff APIs come in Milestone 4. Anonymous access gets HTTP 401. Another customer's, missing, and cancelled ticket UUIDs all return the same HTTP 404 message. Invalid UUIDs/bodies return HTTP 400.

**Cancellation policy:** only `new`, `in_progress`, and `waiting_customer` count as open. `resolved` and `closed` cannot be cancelled (HTTP 409). The browser requires confirmation in a modal dialog; its dismiss button says exactly «انصراف». Cancellation sets only `tickets.is_cancelled=true` and updates its timestamp. Messages/history remain stored for audit but cannot be accessed through normal customer queries once the parent ticket is cancelled. There is no customer restore action.

Replies are allowed on any owned non-cancelled ticket, including resolved/closed tickets. A reply does not automatically change its status. Customer status editing and staff workflow are outside this milestone. Ticket creation atomically saves the ticket, its description as the first message, and the initial `new` history entry. Row locks serialize replies/cancellation; a reply waiting behind a successful cancellation is rejected.

`npm run test:tickets` runs PostgreSQL-backed customer security/workflow tests and customer rendering checks. It logs in with the public demo accounts, creates its own fixture tickets, and soft-cancels only those fixtures during cleanup. It never deletes records or modifies the 20 seeded tickets. Repeated test runs leave cancelled audit records and gaps in ticket numbers, as expected. The suite checks ownership/list isolation (including direct foreign UUIDs), malformed/spoofed data, CSRF, replies/order/update timestamps, hidden cancelled children, eligibility, post-cancellation denial and concurrent reply/cancellation. Frontend tests cover Persian loading/empty/error states, Jalali dates, safe text rendering and protected URL routing. No dependencies were added.
