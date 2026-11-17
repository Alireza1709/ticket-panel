# Support ticket application

Milestones 1–4: Persian RTL support-ticket application with customer management and a complete staff inbox, replies, status history and assignment. Deployment remains a later milestone.

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
4. Staff inbox, pagination, filters/search, replies, assignment and status controls — complete.
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
