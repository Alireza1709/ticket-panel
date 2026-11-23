export function Skeleton({ kind }: { kind: "inbox" | "list" | "detail" | "form" | "session" }) {
  const list = kind === "inbox" || kind === "list";
  return (
    <div role="status" className="panel space-y-4 p-4 sm:p-5">
      <span className="sr-only">در حال دریافت اطلاعات…</span>
      <div aria-hidden="true" className="skeleton-grid" data-kind={kind}>
        {list ? (
          <>
            <div className="grid grid-cols-3 gap-4 border-b border-border pb-4 md:grid-cols-5">
              {Array.from({ length: kind === "inbox" ? 5 : 4 }, (_, index) => (
                <div key={index} className="skeleton-bar h-3" />
              ))}
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 border-b border-border py-4 last:border-0 md:grid-cols-5">
                <div className="skeleton-bar h-4 w-4/5" />
                <div className="skeleton-bar h-4" />
                <div className="skeleton-bar h-4 w-3/4 rounded-full" />
                <div className="skeleton-bar hidden h-4 md:block" />
                <div className="skeleton-bar hidden h-4 md:block" />
              </div>
            ))}
          </>
        ) : (
          <div className="space-y-5">
            <div className="skeleton-bar h-5 w-2/5" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton-bar h-9" />
              <div className="skeleton-bar h-9" />
            </div>
            {kind !== "form" && <div className="skeleton-bar h-20" />}
          </div>
        )}
      </div>
    </div>
  );
}
