import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Landing } from "../src/App";
import {
  CalendarDate,
  dayBoundary,
  pickerDate,
  parseInboxSearch,
  inboxSearch,
  type InboxFilters,
} from "../src/lib/staff-inbox";
import { routeFor } from "../src/lib/auth-routing";
import { inboxResponseSchema } from "../src/lib/staff-tickets";
import { ApiError } from "../src/lib/api";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

const userId = "10000000-0000-4000-8000-000000000003",
  ticketId = "20000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  name: "مریم کریمی",
  email: "maryam@example.test",
  role: "staff" as const,
};
const time = "2026-03-21T08:00:00.000Z";
const ticket = {
  id: ticketId,
  ticket_number: "TKT-00000001",
  subject: "خطای پرداخت",
  status: "in_progress",
  priority: "high",
  category: "billing",
  created_at: time,
  updated_at: time,
  assigned_to: userId,
  assignee_name: user.name,
  customer_name: "سارا احمدی",
  description: "شرح درخواست",
};
const noop = () => {};
function client() {
  const result = new QueryClient({
    defaultOptions: {
      queries: { enabled: false, retry: false },
      mutations: { retry: false },
    },
  });
  result.setQueryData(["csrf"], { csrfToken: "f".repeat(64) });
  result.setQueryData(["health"], { status: "ok" });
  return result;
}
function render(queryClient: QueryClient, path: string) {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <main dir="rtl">
        <Landing user={user} path={path} onLogout={noop} />
      </main>
    </QueryClientProvider>,
  );
}
function filters(search = ""): InboxFilters {
  const parsed = parseInboxSearch(search);
  assert.equal(parsed.success, true);
  if (!parsed.success) throw new Error("Invalid fixture filters");
  return parsed.data;
}

test("Jalali range maps to exact Tehran boundaries independent of the host timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = timezone;
      const date = new CalendarDate({
        year: 1405,
        month: 1,
        day: 1,
        calendar: persian,
        locale: persianFa,
      });
      assert.equal(dayBoundary(date), "2026-03-20T20:30:00.000Z");
      assert.equal(dayBoundary(date, true), "2026-03-21T20:30:00.000Z");
      assert.equal(pickerDate(dayBoundary(date))?.year, 1405);
      assert.equal(pickerDate(dayBoundary(date, true), true)?.day, 1);
      const leapEnd = new CalendarDate({
        year: 1403,
        month: 12,
        day: 30,
        calendar: persian,
        locale: persianFa,
      });
      assert.equal(dayBoundary(leapEnd, true), "2025-03-20T20:30:00.000Z");
      const dstDay = new CalendarDate({
        year: 1400,
        month: 1,
        day: 2,
        calendar: persian,
        locale: persianFa,
      });
      assert.equal(dayBoundary(dstDay), "2021-03-21T20:30:00.000Z");
      assert.equal(dayBoundary(dstDay, true), "2021-03-22T19:30:00.000Z");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
test("URL round trip preserves every filter, page, direct-link routing and UTF-8 search", () => {
  const expected = filters(
    "?page=3&page_size=10&status=in_progress&priority=high&q=پرداخت&from=2026-03-20T20%3A30%3A00.000Z&to=2026-03-21T20%3A30%3A00.000Z",
  );
  const search = inboxSearch(expected);
  assert.deepEqual(filters(search), expected);
  for (const path of [
    `/staff/inbox?${search}`,
    `/staff/tickets/${ticketId}?${search}`,
  ]) {
    assert.equal(routeFor("staff", path), path);
    assert.equal(routeFor(null, path), "/login");
    assert.equal(routeFor("customer", path), "/customer/tickets");
  }
  for (const search of [
    "?page=0",
    "?page_size=101",
    "?q=" + "x".repeat(101),
    "?from=1405/01/01",
    "?from=0000-01-01T00:00:00Z",
    "?status=invalid",
    "?from=2026-03-22T00:00:00Z&to=2026-03-21T00:00:00Z",
  ])
    assert.equal(parseInboxSearch(search).success, false);
});
test("real staff Landing renders a filtered inbox with both real Jalali date pickers and Persian pagination", () => {
  const queryClient = client();
  const state = filters(
    "?page=2&page_size=10&status=in_progress&priority=high&q=پرداخت&from=2026-03-20T20%3A30%3A00.000Z&to=2026-03-21T20%3A30%3A00.000Z",
  );
  const search = inboxSearch(state);
  queryClient.setQueryData(
    ["staff-inbox", userId, search],
    inboxResponseSchema.parse({
      tickets: [ticket],
      total: 21,
      total_pages: 3,
      page: 2,
      page_size: 10,
    }),
  );
  try {
    const html = render(queryClient, `/staff/inbox?${search}`);
    for (const text of [
      "صندوق پشتیبانی",
      "خطای پرداخت",
      "سارا احمدی",
      "مریم کریمی",
      "صفحه قبل",
      "صفحه بعد",
      "۱۴۰۵",
      'id="staff-from"',
      'id="staff-to"',
      'id="sample-date"',
      'dir="rtl"',
    ])
      assert.ok(html.includes(text), text);
    assert.match(html, /<option value="in_progress" selected=""/);
    assert.match(html, /<option value="high" selected=""/);
    assert.match(html, /<option value="10" selected=""/);
    assert.match(html, /value="پرداخت"/);
    assert.ok(html.includes(`/staff/tickets/${ticketId}?page=2`));
    // The real picker populates its input after mounting; conversion is tested separately.
    assert.equal(pickerDate(state.from)?.format("YYYY/MM/DD"), "۱۴۰۵/۰۱/۰۱");
  } finally {
    queryClient.clear();
  }
});
test("staff inbox renders Persian loading, empty and error states and invalid URL feedback", async () => {
  const queryClient = client(),
    search = inboxSearch(filters());
  try {
    assert.match(render(queryClient, "/staff/inbox"), /در حال دریافت اطلاعات/);
    queryClient.setQueryData(["staff-inbox", userId, search], {
      tickets: [],
      total: 0,
      total_pages: 1,
      page: 1,
      page_size: 20,
    });
    assert.match(
      render(queryClient, "/staff/inbox"),
      /تیکتی با این شرایط پیدا نشد/,
    );
    queryClient.removeQueries({ queryKey: ["staff-inbox"] });
    await queryClient
      .fetchQuery({
        queryKey: ["staff-inbox", userId, search],
        queryFn: () => {
          throw new ApiError("خطای آزمایشی صندوق", 503);
        },
      })
      .catch(noop);
    assert.match(render(queryClient, "/staff/inbox"), /خطای آزمایشی صندوق/);
    assert.match(
      render(queryClient, "/staff/inbox?page=0"),
      /فیلترهای نشانی صفحه معتبر نیستند/,
    );
  } finally {
    queryClient.clear();
  }
});
test("integrated staff detail includes real footer picker, reply, assignment, history and allowed status options", () => {
  const queryClient = client();
  queryClient.setQueryData(["staff-ticket", userId, ticketId], {
    ticket,
    messages: [
      {
        id: ticketId,
        body: "متن مشتری",
        created_at: time,
        author_name: "سارا احمدی",
        author_role: "customer",
      },
    ],
    history: [
      {
        id: ticketId,
        from_status: "new",
        to_status: "in_progress",
        created_at: time,
        author_name: user.name,
      },
    ],
  });
  queryClient.setQueryData(["staff-members"], {
    members: [{ id: userId, name: user.name }],
  });
  try {
    const html = render(queryClient, `/staff/tickets/${ticketId}?page=2`);
    for (const text of [
      "ارسال پاسخ",
      "تغییر وضعیت",
      "واگذاری به کارشناس",
      "انصراف",
      "تاریخچه وضعیت",
      "متن مشتری",
      "sample-date",
    ]) {
      assert.ok(html.includes(text), text);
    }
    assert.match(html, /<option value="waiting_customer"/);
    assert.match(html, /<option value="resolved"/);
    assert.equal(html.includes('<option value="closed"'), false);
  } finally {
    queryClient.clear();
  }
});
