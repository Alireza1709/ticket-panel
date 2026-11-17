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
