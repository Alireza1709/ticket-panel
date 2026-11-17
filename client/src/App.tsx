import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Headphones,
  LogIn,
  LogOut,
  Inbox,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { z } from "zod";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { Button } from "@/components/ui/button";
import {
  api,
  ApiError,
  csrfSchema,
  loginResponseSchema,
  meSchema,
  postOptions,
  userSchema,
  type User,
} from "@/lib/api";
import { homeFor, routeFor } from "@/lib/auth-routing";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("ایمیل معتبر وارد کنید")
    .max(254, "ایمیل بیش از حد طولانی است"),
  password: z
    .string()
    .min(1, "گذرواژه را وارد کنید")
    .max(128, "گذرواژه بیش از حد طولانی است"),
});
type LoginValues = z.infer<typeof loginSchema>;
function navigate(path: string) {
  if (window.location.pathname !== path) {
    window.history.replaceState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}
function Loading({ message = "در حال دریافت اطلاعات…" }: { message?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12">
      <LoaderCircle className="animate-spin" size={20} />
      {message}
    </div>
  );
}
function Failure({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
    >
      <p>{error.message}</p>
      <Button variant="outline" onClick={retry}>
        تلاش دوباره
      </Button>
    </div>
  );
}

function Login({
  onLogin,
}: {
  onLogin: (user: User, csrfToken: string) => void;
}) {
  const queryClient = useQueryClient();
  const csrf = useQuery({
    queryKey: ["csrf"],
    queryFn: () => api("/api/auth/csrf", csrfSchema),
    staleTime: Infinity,
    retry: false,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationFn: (values: LoginValues) =>
      api(
        "/api/auth/login",
        loginResponseSchema,
        postOptions(values, csrf.data?.csrfToken ?? ""),
      ),
    onSuccess: (data) => onLogin(data.user, data.csrfToken),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: ["csrf"] });
      }
    },
  });
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-8 space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-100 text-primary">
          <Headphones size={28} />
        </div>
        <h1 className="text-2xl font-bold">ورود به سامانه پشتیبانی</h1>
        <p className="text-sm text-slate-600">
          برای پیگیری درخواست‌ها وارد حساب خود شوید.
        </p>
      </div>
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <form
          noValidate
          onSubmit={handleSubmit((values) => login.mutate(values))}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              ایمیل
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              autoFocus
              {...register("email")}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:outline-primary"
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-red-700">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              گذرواژه
            </label>
            <input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              {...register("password")}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:outline-primary"
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-sm text-red-700"
              >
                {errors.password.message}
              </p>
            )}
          </div>
          {csrf.isPending && (
            <p role="status" className="text-sm">
              در حال آماده‌سازی ورود…
            </p>
          )}
          {csrf.isError && (
            <Failure
              error={csrf.error}
              retry={() => {
                void csrf.refetch();
              }}
            />
          )}{" "}
          {login.isError && (
            <p role="alert" className="text-sm text-red-700">
              {login.error.message}
            </p>
          )}
          <Button
            type="submit"
            className="w-full py-3"
            disabled={!csrf.data || csrf.isFetching || login.isPending}
          >
            {login.isPending ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <LogIn size={18} />
            )}{" "}
            {login.isPending ? "در حال ورود…" : "ورود به حساب"}
          </Button>
        </form>
      </section>
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={15} />
        دسترسی به اطلاعات بر اساس نقش حساب شماست.
      </p>
    </div>
  );
}

function Landing({ user, onLogout }: { user: User; onLogout: () => void }) {
  const client = useQueryClient();
  const csrf = useQuery({
    queryKey: ["csrf"],
    queryFn: () => api("/api/auth/csrf", csrfSchema),
    staleTime: Infinity,
    retry: false,
  });
  const overview = useQuery({
    queryKey: ["overview", user.id, user.role],
    queryFn: () =>
      api(
        `/api/${user.role}/overview`,
        z.object({ user: userSchema, message: z.string() }),
      ),
    retry: false,
  });
  useEffect(() => {
    if (overview.error instanceof ApiError && overview.error.status === 401) {
      onLogout();
    }
  }, [overview.error, onLogout]);
  const logout = useMutation({
    mutationFn: () =>
      api(
        "/api/auth/logout",
        z.object({ message: z.string() }),
        postOptions({}, csrf.data?.csrfToken ?? ""),
      ),
    onSuccess: onLogout,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403)
        void client.invalidateQueries({ queryKey: ["csrf"] });
    },
  });
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api("/api/health", z.object({ status: z.literal("ok") })),
  });
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Headphones className="text-primary" size={30} />
          <div>
            <h1 className="text-xl font-bold">سامانه پشتیبانی</h1>
            <p className="mt-1 text-sm text-slate-500">
              {user.name} ·{" "}
              {user.role === "staff" ? "کارشناس پشتیبانی" : "مشتری"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={!csrf.data || logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut size={16} />
          {logout.isPending ? "در حال خروج…" : "خروج از حساب"}
        </Button>
      </header>
      <section className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">
          {user.role === "staff" ? "صندوق پشتیبانی" : "تیکت‌های من"}
        </h2>
        {overview.isPending ? (
          <Loading />
        ) : overview.isError ? (
          <Failure
            error={overview.error}
            retry={() => {
              void overview.refetch();
            }}
          />
        ) : (
          <>
            <p className="text-slate-600">{overview.data.message}</p>
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <Inbox size={36} className="mx-auto mb-3 text-slate-400" />
              <h3 className="font-medium">
                نمایش تیکت‌ها در مرحله بعد فعال می‌شود
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                ورود و دسترسی حساب شما آماده است؛ فهرست تیکت‌ها هنوز به این صفحه
                متصل نشده است.
              </p>
            </div>
          </>
        )}
        {logout.isError && (
          <p role="alert" className="text-red-700">
            {logout.error.message}
          </p>
        )}
        {csrf.isError && (
          <Failure
            error={csrf.error}
            retry={() => {
              void csrf.refetch();
            }}
          />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 text-sm text-slate-500">
          <span>
            {new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
              dateStyle: "long",
            }).format(new Date())}
          </span>
          <label className="flex items-center gap-2" htmlFor="sample-date">
            تقویم شمسی
            <DatePicker
              id="sample-date"
              calendar={persian}
              locale={persianFa}
              calendarPosition="bottom-right"
              inputClass="w-32 rounded-md border border-border px-2 py-1"
              placeholder="انتخاب تاریخ"
            />
          </label>
          <span role="status">
            {health.isPending
              ? "بررسی ارتباط…"
              : health.isError
                ? "خطا در ارتباط با سرور"
                : "سرور در دسترس است"}
          </span>
        </footer>
      </section>
    </div>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const path = useSyncExternalStore(subscribe, () => window.location.pathname);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/api/auth/me", meSchema),
    retry: false,
    staleTime: 30000,
  });
  const user = me.data?.user ?? null;
  const target = routeFor(user?.role ?? null, path);
  useEffect(() => {
    if (me.isSuccess) navigate(target);
  }, [me.isSuccess, target]);
  const signedOut = () => {
    queryClient.clear();
    queryClient.setQueryData(["me"], { user: null });
    navigate("/login");
  };
  return (
    <main dir="rtl" className="min-h-screen px-5 py-12 sm:py-20">
      {me.isPending ? (
        <Loading message="در حال بررسی حساب…" />
      ) : me.isError ? (
        <div className="mx-auto max-w-md">
          <Failure
            error={me.error}
            retry={() => {
              void me.refetch();
            }}
          />
        </div>
      ) : path !== target ? (
        <Loading message="در حال انتقال…" />
      ) : user ? (
        <Landing user={user} onLogout={signedOut} />
      ) : (
        <Login
          onLogin={(account, csrfToken) => {
            queryClient.clear();
            queryClient.setQueryData(["csrf"], { csrfToken });
            queryClient.setQueryData(["me"], { user: account });
            navigate(homeFor(account.role));
          }}
        />
      )}
    </main>
  );
}
