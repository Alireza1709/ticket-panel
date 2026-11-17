# Prompt record

## Milestone 1

User requested a one-day interview support-ticket application using React/Vite/TypeScript, Tailwind/shadcn/ui/lucide, TanStack Query, React Hook Form/Zod, Express/PostgreSQL and later nginx on port 80.

Constraints: Persian user-facing text, RTL, Jalali dates and picker, cancel label «انصراف», no TypeScript `any`, UUID/audit/cancellation fields on every future table, no hard deletes, server authorization, customer/staff roles, hashed passwords, customer/staff ticket workflows, history, 2 customer/2 staff/20 ticket seeds, loading/empty/error states, reboot startup, documentation and small Git commits.

Authorized scope: inspect, propose architecture, initialize frontend/backend, install libraries, configure environment-based PostgreSQL access, health route, examples/ignore rules, build and health checks. Explain decisions in beginner-friendly language. Do not access other network machines, expose credentials or run destructive commands. Stop after Milestone 1 for review.

Implementation decision: local npm workspaces with separate client/server, Vite development API proxy, localhost-only listeners and deferred production deployment.
