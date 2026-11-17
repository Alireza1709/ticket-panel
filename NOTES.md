# Implementation notes

## Milestone 1 decisions

- npm workspaces keep one lockfile and independent frontend/backend builds.
- Strict TypeScript in both applications; no explicit `any` in application source.
- Tailwind v4 uses the official Vite integration. The local shadcn/ui-style Button uses Radix Slot, CVA and CSS tokens; `components.json` configures future component additions.
- TanStack Query provides loading/error/success states on the starter screen, with an explicit empty fallback. The Persian date picker and today's Jalali date demonstrate locale setup.
- React Hook Form and its Zod resolver are installed for later forms; the starter screen has no business form.
- PostgreSQL settings come from `server/.env`. Connection attempts have timeouts and health responses never expose connection errors.
- The database URL is required at API startup, even for process health. Invalid configuration fails with a generic message.
- No schema, migrations, seed, login, ticket flows, nginx configuration or boot service in this milestone.
- `task.pdf` was present and preserved. No PDF extraction utility was available; implementation follows the user's supplied requirements.

## Review before later milestones

Choose session persistence, schema/foreign-key strategy (including initial user `created_by`), role checks and seed procedure before introducing tables. Never store plaintext passwords or hard-delete records. Add production session cookies, CSRF protection and rate limiting with authentication. Do not expose database readiness publicly through nginx without deciding its access policy.

## Verification results

- Frontend and backend strict TypeScript checks passed.
- Vite frontend production build and backend compilation passed.
- Repeatable HTTP smoke check passed: process health 200, unavailable database 503, unknown route 404, malformed JSON 400.
- Argon2 hash/verify smoke check passed despite npm install-script advisories.
- npm reported zero dependency vulnerabilities during installation.
- Application source scan found no explicit TypeScript `any`.
- Ignore rules cover environment files, dependencies and build output, while retaining `.env.example`.
- PostgreSQL on localhost:5432 accepts connections. Successful authenticated DB health is unverified: no matching VM-user role, and sudo requires interactive authentication. No DB records were changed.
- Browser interaction was not tested; frontend verification is compilation/build only.
