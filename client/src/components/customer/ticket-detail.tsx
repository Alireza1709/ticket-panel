import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MessageSquare, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  canCancel,
  categories,
  detailSchema,
  jalali,
  priorities,
  statuses,
  type Detail,
} from "@/lib/tickets";
import { Failure, Pending, useAuthFailure } from "./shared";
import { ReplyForm } from "./reply-form";
import { CancelTicketDialog } from "./cancel-ticket-dialog";

export function MessageThread({ messages }: { messages: Detail["messages"] }) {
  return (
    <section className="space-y-4" aria-labelledby="thread-title">
      <h3
        id="thread-title"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <MessageSquare size={19} />
        گفت‌وگو
      </h3>
      {messages.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-5 text-slate-500">
          هنوز پیامی برای این تیکت وجود ندارد.
        </p>
      ) : (
        <ol className="space-y-4">
          {messages.map((message) => (
            <li key={message.id}>
              <article
                className={`rounded-xl border p-4 ${message.author_role === "staff" ? "border-teal-100 bg-teal-50" : "border-border bg-white"}`}
              >
                <header className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-semibold">
                    {message.author_name}
                    {message.author_role === "staff" && (
                      <span className="mr-2 font-normal text-teal-800">
                        پشتیبانی
                      </span>
                    )}
                  </p>
                  <time
                    className="text-xs text-slate-500"
                    dateTime={message.created_at}
                  >
                    {jalali(message.created_at)}
                  </time>
                </header>
                <p className="whitespace-pre-wrap break-words leading-8">
                  {message.body}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function StatusHistory({ history }: { history: Detail["history"] }) {
  return (
    <section
      className="space-y-3 border-t border-border pt-5"
      aria-labelledby="history-title"
    >
      <h3 id="history-title" className="flex items-center gap-2 font-semibold">
        <History size={19} />
        تاریخچه وضعیت
      </h3>
      {history.length === 0 ? (
        <p className="text-sm text-slate-500">هنوز تغییری ثبت نشده است.</p>
      ) : (
        <ol className="space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>
                {entry.from_status
                  ? `${statuses[entry.from_status]} ← ${statuses[entry.to_status]}`
                  : `ثبت تیکت با وضعیت ${statuses[entry.to_status]}`}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {entry.author_name} ·{" "}
                <time dateTime={entry.created_at}>
                  {jalali(entry.created_at)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function TicketDetail({
  id,
  userId,
  navigate,
  notify,
}: {
  id: string;
  userId: string;
  navigate: (path: string) => void;
  notify: (message: string) => void;
}) {
  const query = useQuery({
    queryKey: ["ticket", userId, id],
    queryFn: () => api(`/api/customer/tickets/${id}`, detailSchema),
    retry: false,
  });
  useAuthFailure(query.error);
  const back = (
    <Button variant="outline" onClick={() => navigate("/customer/tickets")}>
      <ArrowRight size={16} />
      بازگشت به فهرست
    </Button>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <Pending />
      </>
    );
  if (query.isError)
    return (
      <div className="space-y-4">
        {back}
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  const { ticket, messages, history } = query.data;
  const fields = [
    ["شماره تیکت", ticket.ticket_number],
    ["وضعیت", statuses[ticket.status]],
    ["اولویت", priorities[ticket.priority]],
    ["دسته‌بندی", categories[ticket.category]],
    ["مشتری", ticket.customer_name],
    [
      "کارشناس",
      ticket.assigned_to
        ? (ticket.assignee_name ?? "کارشناس غیرفعال")
        : "تعیین نشده",
    ],
    ["تاریخ ثبت", jalali(ticket.created_at)],
    ["آخرین به‌روزرسانی", jalali(ticket.updated_at)],
  ];
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap justify-between gap-3">
        {back}
        {canCancel(ticket.status) && (
          <CancelTicketDialog
            ticketId={id}
            userId={userId}
            onCancelled={(message) => {
              notify(message);
              navigate("/customer/tickets");
            }}
          />
        )}
      </div>
      <h2 className="break-words text-2xl font-bold leading-10">
        {ticket.subject}
      </h2>
      <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-2 text-slate-500">{label}</dt>
            <dd className="break-words font-medium">
              <bdi>{value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <MessageThread messages={messages} />
      <ReplyForm key={id} ticketId={id} userId={userId} />
      <StatusHistory history={history} />
    </div>
  );
}
