import { History, MessageSquare } from "lucide-react";
import { jalali, statuses, type Detail } from "@/lib/tickets";

export function MessageThread({ messages }: { messages: Detail["messages"] }) {
  return (
    <section className="panel space-y-4 p-4 sm:p-5" aria-labelledby="thread-title">
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
                className={`rounded-xl border p-4 ${message.author_role === "staff" ? "border-blue-100 bg-blue-50" : "border-border bg-white"}`}
              >
                <header className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-semibold">
                    {message.author_name}
                    {message.author_role && (
                      <span className="ms-2 font-normal text-blue-800">
                        {message.author_role === "staff" ? "پشتیبانی" : "مشتری"}
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
export function StatusHistory({ history, assignments }: {
  history: Detail["history"];
  assignments?: Detail["assignments"];
}) {
  const entries = [
    ...history.map((entry) => ({
      ...entry,
      description: entry.from_status
        ? `${statuses[entry.from_status]} ← ${statuses[entry.to_status]}`
        : `ثبت تیکت با وضعیت ${statuses[entry.to_status]}`,
    })),
    ...(assignments ?? []).map((entry) => ({ ...entry, description: `ارجاع به ${entry.assignee_name}` })),
  ].sort((left, right) => left.created_at.localeCompare(right.created_at));
  return (
    <section
      className="panel self-start space-y-3 p-4 sm:p-5"
      aria-labelledby="history-title"
    >
      <h3 id="history-title" className="flex items-center gap-2 font-semibold">
        <History size={19} />
        {assignments ? "تاریخچه وضعیت و ارجاع" : "تاریخچه وضعیت"}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">هنوز تغییری ثبت نشده است.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>{entry.description}</p>
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
