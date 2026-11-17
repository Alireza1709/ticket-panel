# Support ticket application

Milestone 1: local development foundation. All application text is Persian and the interface is RTL.

## Architecture

- `client/`: React + Vite + TypeScript. Tailwind CSS v4, shadcn/ui-compatible local Button, lucide icons, TanStack Query, React Hook Form + Zod, Persian calendar/date picker.
- `server/`: Express + TypeScript with a PostgreSQL connection pool. Zod validates configuration; Helmet supplies security headers. Password hashing and session packages are installed for the authentication milestone.
- Development: Vite forwards `/api` to Express on `127.0.0.1:3000`. Both servers bind to localhost.
- Later production: nginx on port 80 serves `client/dist` and proxies `/api` to Express. A systemd unit will start Express after reboot. Deployment is not part of Milestone 1.

## Requirements and setup

Node.js 24, npm 11, PostgreSQL 16.

```bash
npm ci
cp server/.env.example server/.env
```

If the development database has not been created, run these commands locally in a terminal with sudo access. Choose a password at the prompt (it is not put into shell history):

```bash
sudo -u postgres createuser --pwprompt tickets_app
sudo -u postgres createdb --owner=tickets_app tickets_app
```

Do not rerun creation if the role/database already exists; use your existing development database instead.

Edit `server/.env` locally with a PostgreSQL user, password and database that you have provisioned. The example contains placeholders, not working credentials. Do not commit `.env` files. Run npm scripts from this repository root so the backend workspace loads `server/.env`.

Use two terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Forward localhost port 5173 through VS Code Remote SSH to open the interface on your computer. No VM firewall change is necessary.

```bash
npm run check
npm run build
npm start
```

`npm start` runs the compiled API after a build; it does not serve the frontend yet.

## Health checks

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/health/db
```

The first checks the HTTP process; the second runs read-only `SELECT 1`. Database failure returns HTTP 503 with a generic Persian message and no credentials. A successful process check does not prove database connectivity. Port 3000 is configurable; if changed, update the Vite proxy too.

## Planned milestones

1. Foundation and health checks (current).
2. Database migrations and seed; secure login and server-side customer/staff authorization.
3. Customer ticket creation, list, detail, replies and cancellation.
4. Staff pagination, filters, search, assignments and status history.
5. Full state/accessibility checks, nginx deployment and systemd startup.

Every future table must include UUID `id`, `created_at`, `created_by`, and `is_cancelled`. Records will be cancelled rather than hard-deleted. No business tables exist yet. Authentication and authorization are not implemented; no ticket endpoints are exposed. Cancel buttons will use «انصراف».

## Milestone 1 verification

`npm run test:health` builds the API and checks HTTP 200 process health, HTTP 503 for an intentionally unavailable database, HTTP 404 for unknown routes, and a safe HTTP 400 for malformed JSON. It uses an ephemeral localhost HTTP port and requires no database credentials.

The VM PostgreSQL service accepts local connections, but the VM user has no matching PostgreSQL role and unattended sudo requires a password. A successful `/api/health/db` check is pending local database provisioning; no database or credential file was created by this milestone.
