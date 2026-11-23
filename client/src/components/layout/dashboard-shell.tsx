import { useEffect, useId, useRef, type ReactNode } from "react";
import { Headphones, Inbox, LogOut, Menu, Plus, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/api";

export function DashboardShell({
  user,
  path,
  navigate,
  logout,
  logoutDisabled,
  logoutPending,
  children,
}: {
  user: User;
  path: string;
  navigate: (path: string) => void;
  logout: () => void;
  logoutDisabled: boolean;
  logoutPending: boolean;
  children: ReactNode;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const drawerId = useId();
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 52rem)");
    const closeOnDesktop = () => {
      if (!mobile.matches) drawer.current?.close();
    };
    mobile.addEventListener("change", closeOnDesktop);
    return () => mobile.removeEventListener("change", closeOnDesktop);
  }, []);
  const staff = user.role === "staff";
  const search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  const listPath = staff ? `/staff/inbox${search}` : "/customer/tickets";
  const createPath = "/customer/tickets/new";
  const items = staff
    ? [{ href: listPath, label: "صندوق پشتیبانی", icon: Inbox, active: true }]
    : [
        { href: listPath, label: "تیکت‌های من", icon: Ticket, active: path !== createPath },
        { href: createPath, label: "ثبت تیکت جدید", icon: Plus, active: path === createPath },
      ];
  const role = staff ? "کارشناس پشتیبانی" : "مشتری";
  const brand = (
    <div className="brand">
      <span className="brand-mark"><Headphones size={21} aria-hidden="true" /></span>
      <span>سامانه پشتیبانی</span>
    </div>
  );
  const navigation = (
    <nav aria-label="ناوبری پنل" className="space-y-1.5">
      {items.map(({ href, label, icon: Icon, active }) => (
        <a
          key={href}
          href={href}
          className="dashboard-link"
          data-active={active}
          aria-current={path === href ? "page" : undefined}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            drawer.current?.close();
            navigate(href);
          }}
        >
          <Icon size={19} aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  );
  const signOut = (
    <Button variant="outline" className="w-full justify-start" disabled={logoutDisabled} onClick={logout}>
      <LogOut size={17} aria-hidden="true" />
      {logoutPending ? "در حال خروج…" : "خروج از حساب"}
    </Button>
  );
  return (
    <div className="dashboard" dir="rtl">
      <a href="#dashboard-content" className="skip-link">رفتن به محتوا</a>
      <aside className="dashboard-sidebar">
        {brand}
        {navigation}
        <div className="mt-auto">{signOut}</div>
      </aside>
      <dialog
        ref={drawer}
        id={drawerId}
        className="dashboard-drawer"
        aria-label="منوی سامانه پشتیبانی"
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
      >
        <div className="flex min-h-full flex-col gap-7 p-5">
          <div className="flex items-center justify-between gap-2">
            {brand}
            <button type="button" className="icon-action" aria-label="بستن منو" title="بستن منو" onClick={() => drawer.current?.close()}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {navigation}
          <div className="mt-auto">{signOut}</div>
        </div>
      </dialog>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="باز کردن منو"
              aria-controls={drawerId}
              aria-haspopup="dialog"
              title="باز کردن منو"
              className="icon-action dashboard-menu"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu size={23} aria-hidden="true" />
            </button>
            <h1 className="text-sm font-bold sm:text-base">پنل پشتیبانی</h1>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="profile-mark" aria-hidden="true">{user.name.trim()[0]}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-slate-600">{role}</p>
            </div>
          </div>
        </header>
        <main id="dashboard-content" tabIndex={-1} className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}
