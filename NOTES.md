# Implementation notes

## Milestones 1–3

The existing npm workspaces, localhost-only Express/Vite listeners, API proxy, Tailwind v4 and shadcn-style Button are retained. No dependencies were added for Milestone 2. The user completed PostgreSQL provisioning (`tickets_user`, `tickets_db`) and both health checks passed before Milestone 2.

## Schema decisions

- SQL migrations are transactional and versioned with SHA-256 checksums and a PostgreSQL advisory lock. Runner works through tsx or compiled code; SQL files stay in `server/migrations`.
- PostgreSQL 16 supplies `gen_random_uuid()` without an extension. Native enums constrain roles/statuses/priorities.
- Customer and assignee composite foreign keys prevent assigning customer accounts as staff. Active-ticket indexes cover customer, inbox and assignee queries; message/history indexes cover chronological details.
- All six tables have the required audit/cancellation columns. Four application tables require a creator and have automatic updated timestamps. Infrastructure migration/anonymous-session actors may be NULL. Deferred self-reference bootstraps the first staff creator without a fabricated system account.
- Statement triggers block DELETE and TRUNCATE. No destructive database commands were run. Future ticket cancellation/status changes should be transactional with history insertion; there are no ticket mutation endpoints yet.
- Seed uses fixed UUIDs, a transaction and an advisory lock. Repeated seed runs preserve existing rows, changed passwords and cancellations. Ticket number sequences can have gaps. Demo seed accounts/passwords are public test fixtures, not real credentials.

## Authentication decisions

- Argon2id hashes, including a dummy hash for missing-email verification, avoid plaintext password storage and reduce obvious account-enumeration timing differences.
- A small PostgreSQL express-session Store uses the existing pg package. MemoryStore is avoided so restarting Express does not lose sessions. Only a signed opaque session ID reaches the browser.
- Regeneration at login cancels the old session; logout cancels the row and clears its data/cookie. Expired sessions are ignored. Retained expired rows need a future soft-cancellation/retention task; there is no deletion job.
- A random stable signing secret was appended to ignored `server/.env` without printing it or changing the database URL. `config:session` makes this reproducible and preserves valid existing secrets. Placeholder secrets are rejected. The file remains 0600.
- Cookies are HttpOnly, SameSite=Lax, path `/`, eight-hour lifetime; Secure is enabled in production. Production requires an HTTPS application origin. Trusted proxies are restricted to loopback for the later local nginx setup.
- Synchronizer CSRF tokens protect login and logout. Constant-time token checks and an Origin allowlist are used. CSRF is enforced even for login to prevent login-CSRF/session swapping. Future cookie-authenticated writes must reuse this protection.
- Zod validates strict authentication bodies and normalizes emails. Safe user DTOs expose only id/name/email/role. Database/internal errors return generic Persian messages.
- Current-user/role checks fetch the non-cancelled user from PostgreSQL each request. Frontend redirects are convenience; API role middleware is the enforcement boundary.
- Login failure throttling is per IP and stored in memory (single-process interview application). A shared limiter would be needed for multiple API instances.

## Frontend decisions

- React Hook Form + Zod handle the Persian login form; TanStack Query manages user/CSRF/overview requests and mutations. Error/loading states and accessible input errors are included.
- A small history-based route guard covers the three current routes without adding a routing dependency. Signed-out users go to login; authenticated users go to their role's landing page. Query caches are cleared when changing accounts.
- Placeholder ticket sections explicitly say data integration comes later, avoiding an inaccurate “no tickets” message when seed tickets exist.
- Jalali date formatting and Persian calendar/date picker remain available on protected pages.

## Milestone 2 verification record

Migrations and seed ran twice successfully with unchanged counts: 4 users, 20 tickets, 36 messages and 36 history entries. Final `npm run check`, `npm run build`, `npm run test:auth` and `npm run test:health` passed. Authentication checks cover schema audit fields/guards, both password outcomes, validation, anonymous/role access, CSRF/Origin rejection, session rotation/persistence, logout replay and throttling; frontend redirect tests cover both roles and signed-out access. Running `config:session` twice preserved the existing private environment byte-for-byte. The environment file is still ignored with mode 0600. Schema tests inspect deletion guards rather than issuing destructive statements. Browser automation is unavailable; no browser interaction test is claimed.

The final Vite build emits a non-blocking warning for a 500.56 kB JavaScript chunk (155.83 kB gzipped). Calendar code splitting is a future optimization; the build succeeds.

## Deferred work recorded after Milestone 2

Ticket APIs/UI, transactional status changes, nginx, TLS, systemd boot startup, durable multi-process rate limiting, session-retention housekeeping, full browser/accessibility verification. Original `task.pdf` remains untouched; no PDF extraction utility was available during Milestone 1.

## Milestone 3 decisions

- Inspected existing migration, role middleware, session CSRF flow, React layout and tests before implementation. Preserved client/server structure, login and staff placeholder page. No new dependencies or staff inbox features.
- Added migration 002 instead of editing the applied initial migration. Category is a constrained text column with four fixed values; old tickets safely default to `other`. No new tables are needed.
- Customer router is mounted behind the existing `requireRole("customer")`. Every single-ticket read/write includes `id`, session `customer_id` and non-cancellation predicates. Foreign/missing/cancelled UUIDs share the same 404 response. Unknown input keys are rejected rather than silently trusting ownership fields.
- Reused and exported the existing CSRF middleware for every new POST route. All application values use query parameters; static SQL projections are code constants, not user input.
- Create uses one transaction for the ticket, initial message and initial history entry. Detail uses a repeatable-read, read-only transaction for a consistent metadata/thread/history snapshot. Messages/history are sorted by timestamp then UUID for deterministic ties.
- Reply and cancel lock the owned active ticket with FOR UPDATE before modifying it, so concurrent cancellation cannot leave a new message after a cancelled parent. Reply inserts and ticket timestamp update commit together. Database timestamp triggers remain the source of updated_at.
- Open cancellation statuses: new, in_progress, waiting_customer. Resolved/closed return 409. Cancellation preserves the existing status and children, using only soft cancellation on the parent. No new “cancelled” status is invented. Replies on any non-cancelled owned ticket are allowed and do not change status.
- Inactive user names are not joined as active records; historical messages fall back to a Persian inactive-user label. The response never selects password hashes.
- Customer components separate list, create, detail/thread/history, reply, confirmation dialog and shared request states. Native modal dialog provides keyboard focus containment/Escape behavior with existing Button styling. The safe dismiss label is always انصراف. Mutation errors remain visible; no automatic retry can duplicate a submission.
- TanStack Query keys include user identity. Creation/replies/cancellation refresh affected caches. Cancellation removes cached detail and returns to the list with success feedback. A 401/403 prompts an auth refresh; actual authorization remains server-side.
- Extended the small route guard for customer create/detail UUID paths. Auth redirects still replace history; customer navigation pushes history so normal back/forward works. Jalali timestamps use fa-IR Persian calendar and Asia/Tehran time.
- Messages/subjects render as React text, never raw HTML. Rendering tests verify an injected script string is escaped.

## Milestone 3 verification

The additive migration applied and the initial customer integration suite passed before frontend wiring. Strict TypeScript, frontend/backend builds, existing authentication/seed/health tests and extended URL tests passed after wiring. Customer integration tests use real local PostgreSQL and newly created fixtures only; cleanup soft-cancels all fixture tickets/messages/history. No DELETE, TRUNCATE, DROP, password output or external-machine access was used.

Final verification passed: `npm run check`, `npm run build`, `npm run test:tickets` (customer API + rendering tests), `npm run test:auth` (auth + routes), `npm run test:health`, and a repeated `npm run db:migrate`. The original seed account/ticket/message/history counts remain intact. UI-rendering checks cover Persian loading/empty/error/populated states, Jalali timestamps, HTML escaping and cancellation controls. The standalone TSX test harness needed an explicit React import; this was corrected and all rendering checks passed. Full browser click/keyboard tests remain unavailable because browser automation is not installed. The final Vite bundle is 517.49 kB (159.95 kB gzipped), producing a non-blocking size warning. Calendar/route code splitting remains a future optimization.

## Scope after Milestone 3

Customer ticket management is complete; defer staff inbox/search/pagination/assignment/status changes, attachment uploads, nginx/systemd deployment and full browser/accessibility testing. Previous authentication/session security limitations still apply (single-process login limiter and retained expired-session rows).
