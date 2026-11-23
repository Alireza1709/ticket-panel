import { Button } from "@/components/ui/button";

export function TicketPagination({ page, totalPages, go }: {
  page: number;
  totalPages: number;
  go: (page: number) => void;
}) {
  return (
    <nav aria-label="صفحه‌بندی تیکت‌ها" className="panel flex flex-wrap items-center justify-between gap-3 p-3">
      <Button variant="outline" disabled={page <= 1} onClick={() => go(Math.min(totalPages, page - 1))}>صفحه قبل</Button>
      <p className="text-sm">صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</p>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => go(page + 1)}>صفحه بعد</Button>
    </nav>
  );
}
