# Prompt record

## Milestone 1

User requested a one-day interview support-ticket application using React/Vite/TypeScript, Tailwind/shadcn/ui/lucide, TanStack Query, React Hook Form/Zod, Express/PostgreSQL and later nginx on port 80.

Constraints: Persian user-facing text, RTL, Jalali dates and picker, cancel label «انصراف», no TypeScript `any`, UUID/audit/cancellation fields on every future table, no hard deletes, server authorization, customer/staff roles, hashed passwords, customer/staff ticket workflows, history, 2 customer/2 staff/20 ticket seeds, loading/empty/error states, reboot startup, documentation and small Git commits.

Authorized scope: inspect, propose architecture, initialize frontend/backend, install libraries, configure environment-based PostgreSQL access, health route, examples/ignore rules, build and health checks. Explain decisions in beginner-friendly language. Do not access other network machines, expose credentials or run destructive commands. Stop after Milestone 1 for review.

Implementation decision: local npm workspaces with separate client/server, Vite development API proxy, localhost-only listeners and deferred production deployment.

## Milestone 1 database follow-up

User provisioned local PostgreSQL role `tickets_user` and database `tickets_db`. Authorized secure ignored environment setup and health verification without showing passwords. A local hidden-input helper created owner-only `server/.env`. Both existing health endpoints returned HTTP 200; no architecture changes were made.

## Milestone 2

User accepted Milestone 1 and requested versioned PostgreSQL migrations; users/tickets/messages/status history with UUID/audit/cancellation columns, enums, foreign keys, indexes, ticket numbers and updated timestamps; no hard deletion; repeatable hashed demo seed for 2 customers, 2 staff and at least 20 varied tickets.

Authentication scope: login/logout/current user, server-side sessions, backend role checks, Zod validation, safe user responses, CSRF consideration, Persian RTL login and protected customer/staff landing pages with role redirects and loading/error/empty states. Reuse architecture/dependencies; do not recreate folders or implement later ticket workflows. Protect existing .env and all real credentials; access no other machines; no destructive database commands without approval.

Required tests cover valid/invalid login, anonymous access denial, customer/staff isolation, redirects, seed counts and successful TypeScript/builds. Update all three documentation files, create meaningful local commits after verification, explain key decisions for a beginner, and stop for review after Milestone 2.

Implementation: native SQL migration files/checksum runner, transactional fixed-ID demo seed, PostgreSQL express-session Store using existing pg, Argon2id, CSRF token + Origin checks, login limiter, role middleware and React Hook Form/TanStack Query frontend. A generated signing secret is stored only in ignored owner-only .env. Demonstration-only login credentials are intentionally documented as requested.

## Milestone 3

User confirmed Milestones 1–2 work in the browser and authorized customer ticket management only. Required inspecting existing schema/routes/components; preserving client/server folders, authentication and staff placeholder; implementing own-ticket list, validated creation with category, human-readable ticket numbers, metadata/detail, chronological message thread, read-only history, replies with timestamp refresh, and confirmed soft cancellation of eligible open tickets.

Security requirements: server-side ownership checks, session-derived customer ID, CSRF on mutations, parameterized SQL, non-cancelled ordinary queries, transactions, direct API tests using another customer's UUID, and anonymous denial. UI requirements: Persian RTL, Jalali dates, existing stack, small components, clear loading/empty/error/success states, exactly انصراف for dismiss buttons, no TypeScript any.

Required process: backend, integration tests, frontend, regression/build checks, documentation updates and small verified Git commits. Keep credentials private, contact no other employer network machines, run no destructive database changes, and stop after Milestone 3 without starting Milestone 4.

Implementation choices: additive category migration 002; customer router behind existing role middleware; foreign/cancelled/missing ticket UUIDs return identical 404; create transaction includes first message/history; row-locked reply/cancel transactions; open statuses are new/in_progress/waiting_customer; customer replies do not change status; native modal confirmation and per-user TanStack Query caches; existing auth redirects retained with customer detail/new routes added. Tests create their own tickets and use soft cancellation for cleanup. Existing seed fixtures remain intact.

## Jalali rendering fix between Milestones 3 and 4

User reported a blank customer page and requested read-only investigation. DB/migrations/seed counts/API shapes were healthy; browser error pointed to Landing. The real DatePicker import was a CommonJS module wrapper containing a nested React forwardRef component. User authorized the smallest correction and a real-Landing regression test. Commit 5bc6f5e normalized the default import, preserved Persian locale/calendar/RTL, and added a regression that failed before and passed after the fix. Existing tests/builds passed; no backend/environment/schema code changed.

## Milestone 4

User accepted Milestones 1–3 and browser verification, then requested support-staff management only: staff inbox across active tickets; server pagination with stable order/totals; status/priority/creation-date filters; Jalali-to-explicit-timestamp boundaries; bounded parameterized number/subject search; full staff ticket/thread/history; text replies; transactional row-locked status policy/history with session actor; active-staff assignment without unrelated updates.

Frontend scope: complete Persian RTL inbox/detail, URL-persisted filters/search/page, real Jalali date pickers, pagination, reply/status/assignment forms, existing UI/data libraries, small shared components and loading/empty/error/success states. All dismiss buttons remain انصراف; no TypeScript any. Require staff role on every staff endpoint, customer/anonymous denial, existing CSRF/Origin protections, soft-cancellation predicates, no secrets/network-machine access or destructive DB changes.

Required tests: both seed customers, direct customer denial, filter/search/pagination/totals, accurate Jalali boundaries, URL restoration, chronological staff replies, atomic history/invalid transitions, eligible assignment, cancelled-ticket denial, all prior regressions, TypeScript/builds and realistic integrated staff rendering with real pickers. Update README/NOTES/PROMPTS, make meaningful verified commits, explain key decisions for a beginner, and stop after Milestone 4. Deployment and voice-note bonus work are explicitly out of scope.

Implementation: new staff router over the existing schema (no migration/seed reset); validated snapshot-based inbox query; documented progress/wait/resolve/reopen/close graph; locked staff assignment; reusable picker normalization/thread/history/reply logic; query-aware history routing, ISO URL state, Tehran day-boundary conversion using IANA timezone data; real-DB and real-React/date-picker regression suites. All tests create and soft-cancel their own fixtures.

## Milestone 5A: production deployment

User requested inspecting the working build/config/session environment before production deployment on Ubuntu 24.04, retaining client/server architecture and business behavior. Requirements: employer access at http://<VM_IP>:80; nginx static SPA fallback plus path-preserving API reverse proxy to localhost-only Express; unprivileged systemd service and restricted environment; automatic startup after reboot; preserve PostgreSQL and all demo tickets; all regression/build tests; actual-origin login/session/CSRF/ownership/staff checks and restart persistence.

Explicit constraints: never print/commit credentials, tokens, cookies or .env contents; contact no other employer network machines; no SSH/network/firewall changes or destructive commands without approval; sudo commands must be explained for the user to run manually; no unrestricted privileges or automatic reboot; no voice-note work. README must include fresh-install/operational/troubleshooting/reboot steps; NOTES must be one page; create meaningful commits.

Inspection found API build server/dist/index.js, frontend client/dist, Node /usr/bin/node, local VM IP 192.168.113.113, localhost PostgreSQL, PostgreSQL cluster auto startup, enabled nginx/postgresql and enabled SSH socket on port 5150 (current connection). ssh.service disabled is expected under socket activation. Production configuration previously required HTTPS and Secure cookies, preventing the explicitly required HTTP origin.

Implementation: explicit ALLOW_INSECURE_HTTP opt-in with production origin validation; HTTPS keeps Secure cookies; HTTP retains CSRF/Origin/HttpOnly/SameSite protections but is documented as demo-only without TLS. Separate production port 3001 preserves dev ports. Reusable nginx/unit files and ignored owner-only preparation preserve existing credentials/signing secret. Non-root preflight temporarily tests nginx on loopback:8080 and production API:3001; actual privileged installation is left to exact manual sudo commands. Safe smoke tests use public demo accounts and private ignored restart state to verify sessions/data after operator service restart or reboot. Original seed assertion was made fixture-specific after discovering one legitimate browser-added reply, without deleting/reseeding data.

The user reported successful completion of the exact manual sudo installation commands, then of `sudo systemctl restart tickets-api`. Codex verified actual port-80 HTTP pages/API/auth/CSRF/roles/ownership/staff operations, enabled/active units, localhost-only API/PostgreSQL listeners and root-owned mode-0600 environment metadata. The service PID changed after the manual restart; protected sessions, a new test ticket and all 20 original seed-ticket summaries persisted unchanged. Test data was soft-cancelled and test sessions invalidated afterward. Codex did not execute a full VM reboot.

## Final acceptance audit and targeted corrections

The operator subsequently reported completing production deployment and full reboot verification. A read-only acceptance audit compared the six-page assignment with source, live schema/seed aggregates, tests, installed deployment configuration, Git history and documentation. TypeScript/build and 19 database-free tests passed; mutating integration/smoke tests were inspected rather than rerun in that read-only audit. Core workflows had no identified functional failure within those limits. Documentation lacked personal hours and retained outdated reboot wording; cancel-label interpretation needed clarification.

For the correction pass, the user requested approximate hours by milestone without inventing personal working time, evidence-qualified reboot wording, exact «انصراف» dismiss/back-out labels, a one-page print check, checks/tests/build and one focused commit. No personal time estimates are available: NOTES uses explicit owner-fill placeholders and claims no total. Detail back-out buttons now use «انصراف»; existing form/dialog dismissals already did. «لغو تیکت» opens the destructive flow and «تأیید لغو تیکت» confirms soft cancellation; pagination/filter-reset controls remain descriptive.

Evidence inspected on 2026-11-17: journal lists previous/current boots; current boot time is 11:32:39 UTC. nginx became active at 11:33:57 and API/PostgreSQL at 11:34:00; services are boot-enabled and post-boot port-80 checks passed in the audit. Ignored smoke state has a scrubbed completion marker modified at 11:37:29, but no boot ID/assertion output. Because that marker is written during cleanup, it cannot independently prove a successful reboot persistence test. Full-reboot session/data verification is operator-reported, not independently established from retained artifacts. No reboot, reseed, reset, hard deletion, bonus feature or deployment-configuration change is part of this correction pass.

Correction verification completed: TypeScript checks, production build and all existing auth/customer/staff/health/production tests passed (50 reported tests, including parent tests). Integration fixtures/sessions were created and soft-cancelled by the existing suites; no hard deletion/reset/reseed occurred. NOTES was rendered through ReportLab to a temporary PDF and checked with pypdf: one A4 page, 18 mm margins, 11 pt body, 14 pt leading. Owner-hours placeholders remain. The corrected frontend build has not been republished to nginx's static root; deployment configuration and running services were left unchanged.


## Project completion and professional redesign

The follow-up brief requested a Git checkpoint push before editing, an audit of the existing React and Express modules, customer registration with staff provisioning controlled by operators, separate dashboards, real PostgreSQL-backed metrics and filters, Persian RTL components, and verification of the reported current-user 502. It required preserving the existing API contracts, ticket state machine and migration history, and pushing the final implementation to the same branch.
