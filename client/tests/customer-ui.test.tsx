import assert from "node:assert/strict";
import React from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TicketList } from "../src/components/customer/ticket-list";
import { TicketDetail } from "../src/components/customer/ticket-detail";
import { CreateTicket } from "../src/components/customer/create-ticket";
import { ApiError } from "../src/lib/api";
import { createTicketSchema, type Detail } from "../src/lib/tickets";
import { Landing } from "../src/App";

const userId = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-17T08:00:00.000Z";
const noop = () => {};
function client() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, enabled: false },
      mutations: { retry: false },
    },
  });
}
function list(queryClient: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <TicketList userId={userId} navigate={noop} />
    </QueryClientProvider>,
  );
}
function detail(queryClient: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <TicketDetail id={id} userId={userId} navigate={noop} notify={noop} />
    </QueryClientProvider>,
  );
}

test("Landing renders the real Persian date picker for both roles without an invalid element", () => {
  for (const role of ["customer", "staff"] as const) {
    const queryClient = client();
    const user = {
      id: userId,
      name: "کاربر آزمایشی",
      email: "demo@example.test",
      role,
    };
    queryClient.setQueryData(["csrf"], { csrfToken: "f".repeat(64) });
    queryClient.setQueryData(["health"], { status: "ok" });
    queryClient.setQueryData(["overview", userId, role], {
      user,
      message: "خوش آمدید",
    });
    queryClient.setQueryData(["tickets", userId], { tickets: [] });
    try {
      // No date-picker mock: exercise Landing's actual import and Persian props.
      const html = renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <main dir="rtl">
            <Landing
              user={user}
              onLogout={noop}
              path={role === "customer" ? "/customer/tickets" : "/staff/inbox"}
            />
          </main>
        </QueryClientProvider>,
      );
      assert.match(html, /dir="rtl"/);
      assert.match(html, /تقویم شمسی/);
      assert.match(html, /<input[^>]*id="sample-date"/);
      assert.match(html, /انتخاب تاریخ/);
    } finally {
      queryClient.clear();
    }
  }
});

test("customer list renders Persian loading, empty, error and populated states", async () => {
  const queryClient = client();
  assert.match(list(queryClient), /در حال دریافت اطلاعات/);
  queryClient.setQueryData(["tickets", userId], { tickets: [] });
  assert.match(list(queryClient), /هنوز تیکتی ثبت نکرده‌اید/);
  queryClient.setQueryData(["tickets", userId], {
    tickets: [
      {
        id,
        ticket_number: "TKT-00000001",
        subject: "پیگیری پرداخت",
        priority: "urgent",
        status: "waiting_customer",
        category: "billing",
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
  });
  const html = list(queryClient);
  for (const label of [
    "TKT-00000001",
    "پیگیری پرداخت",
    "فوری",
    "در انتظار مشتری",
    "۱۴۰۵",
  ])
    assert.ok(html.includes(label), label);
  queryClient.removeQueries();
  await queryClient
    .fetchQuery({
      queryKey: ["tickets", userId],
      queryFn: () => {
        throw new ApiError("خطای آزمایشی دریافت اطلاعات", 503);
      },
    })
    .catch(noop);
  assert.match(list(queryClient), /خطای آزمایشی دریافت اطلاعات/);
  queryClient.clear();
});

test("detail renders Jalali thread/history and escapes message HTML; cancellation is only offered for open tickets", () => {
  const queryClient = client();
  queryClient.setQueryData(["csrf"], { csrfToken: "f".repeat(64) });
  const data: Detail = {
    ticket: {
      id,
      ticket_number: "TKT-00000001",
      subject: "درخواست راهنمایی",
      description: "توضیحات",
      status: "new",
      priority: "normal",
      category: "other",
      created_at: timestamp,
      updated_at: timestamp,
      customer_name: "سارا احمدی",
      assigned_to: null,
      assignee_name: null,
    },
    messages: [
      {
        id,
        body: "<script>alert(1)</script>",
        created_at: timestamp,
        author_name: "سارا احمدی",
        author_role: "customer",
      },
    ],
    history: [
      {
        id,
        from_status: null,
        to_status: "new",
        created_at: timestamp,
        author_name: "سارا احمدی",
      },
    ],
  };
  queryClient.setQueryData(["ticket", userId, id], data);
  const html = detail(queryClient);
  for (const label of [
    "گفت‌وگو",
    "تاریخچه وضعیت",
    "سارا احمدی",
    "۱۴۰۵",
    "تأیید لغو تیکت",
    "انصراف",
    "&lt;script&gt;",
  ])
    assert.ok(html.includes(label), label);
  assert.equal(html.includes("<script>"), false);
  queryClient.setQueryData(["ticket", userId, id], {
    ...data,
    ticket: { ...data.ticket, status: "closed" },
  });
  assert.equal(detail(queryClient).includes("تأیید لغو تیکت"), false);
  queryClient.clear();
});

test("foreign/missing-ticket errors render a safe return path without thread or reply form", async () => {
  const queryClient = client();
  await queryClient
    .fetchQuery({
      queryKey: ["ticket", userId, id],
      queryFn: () => {
        throw new ApiError("تیکت یافت نشد یا در دسترس شما نیست", 404);
      },
    })
    .catch(noop);
  const html = detail(queryClient);
  assert.match(html, /تیکت یافت نشد/);
  assert.match(html, /انصراف/);
  assert.equal(html.includes("ارسال پاسخ"), false);
  queryClient.clear();
});

test("create form has Persian required fields and exact cancel label; schema rejects invalid input", () => {
  const queryClient = client();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <CreateTicket navigate={noop} notify={noop} />
    </QueryClientProvider>,
  );
  for (const label of ["موضوع", "توضیحات", "اولویت", "دسته‌بندی", "انصراف"])
    assert.ok(html.includes(label), label);
  assert.equal(
    createTicketSchema.safeParse({
      subject: "  ",
      description: "",
      category: "other",
      priority: "normal",
    }).success,
    false,
  );
  assert.equal(
    createTicketSchema.safeParse({
      subject: "درخواست",
      description: "شرح مشکل",
      category: "invalid",
      priority: "normal",
    }).success,
    false,
  );
  queryClient.clear();
});
