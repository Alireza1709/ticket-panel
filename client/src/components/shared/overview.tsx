import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Failure, useAuthFailure } from "./ticket-form";
import { Skeleton } from "@/components/feedback/skeleton";
import { StatusBadge } from "./ticket-badges";
import { api, type User } from "@/lib/api";
import { jalali, statusSchema } from "@/lib/tickets";

const labels = {
  total: "همه تیکت‌ها",
  new: "جدید",
  open: "باز",
  in_progress: "در حال بررسی",
  resolved: "حل‌شده",
  assigned: "ارجاع‌شده به من",
} as const;
const response = z.object({
  overview: z.object({
    total: z.number(), new: z.number(), open: z.number(),
    in_progress: z.number(), resolved: z.number(), assigned: z.number(),
    recent: z.array(z.object({
      id: z.uuid(), ticket_number: z.string(), subject: z.string(), status: statusSchema,
      updated_at: z.iso.datetime({ offset: true }),
    })),
  }),
});

export function Overview({ user }: { user: User }) {
  const query = useQuery({
    queryKey: ["overview", user.id],
    queryFn: () => api(`/api/${user.role}/overview`, response),
    retry: false,
  });
  useAuthFailure(query.error);
  if (query.isPending) return <Skeleton kind="list" />;
  if (query.isError) return <Failure error={query.error} retry={() => void query.refetch()} />;
  const { overview } = query.data;
  const metrics = Object.keys(labels) as (keyof typeof labels)[];
  return (
    <section className="space-y-5">
      <h2 className="page-title">نمای کلی</h2>
      <dl className="panel grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.filter((key) => user.role === "staff" || key !== "assigned").map((key) => (
          <div key={key}>
            <dt className="text-sm text-slate-600">{labels[key]}</dt>
            <dd className="mt-2 text-2xl font-bold text-primary">{overview[key].toLocaleString("fa-IR")}</dd>
          </div>
        ))}
      </dl>
      <section className="panel p-5">
        <h3 className="mb-3 font-semibold">آخرین تیکت‌های به‌روزشده</h3>
        {overview.recent.length === 0 ? <p className="text-sm text-slate-600">هنوز تیکتی وجود ندارد.</p> : (
          <ul className="divide-y divide-border">
            {overview.recent.map((ticket) => (
              <li className="flex flex-wrap items-center gap-3 py-3" key={ticket.id}>
                <a className="me-auto break-words text-primary underline" href={`/${user.role}/tickets/${ticket.id}`}>{ticket.subject}</a>
                <StatusBadge status={ticket.status} />
                <time className="text-sm text-slate-600" dateTime={ticket.updated_at}>{jalali(ticket.updated_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export function Profile({ user }: { user: User }) {
  return (
    <section className="space-y-5">
      <h2 className="page-title">حساب کاربری</h2>
      <dl className="panel grid gap-5 p-5">
        <div><dt className="text-sm text-slate-600">نام</dt><dd>{user.name}</dd></div>
        <div><dt className="text-sm text-slate-600">ایمیل</dt><dd><bdi>{user.email}</bdi></dd></div>
      </dl>
    </section>
  );
}
