import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Headphones, LogIn } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/feedback/failure";
import { useToast } from "@/components/feedback/toast";
import { ApiError, type User } from "@/lib/api";
import { getCsrf, loginWithPassword } from "@/lib/auth";
import { useMutationSubmit } from "@/lib/mutation-submit";

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
export function Login({
  onLogin,
}: {
  onLogin: (user: User, csrfToken: string) => void;
}) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const csrf = useQuery({
    queryKey: ["csrf"],
    queryFn: getCsrf,
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
      loginWithPassword(values, csrf.data?.csrfToken ?? ""),
    onSuccess: (data) => {
      onLogin(data.user, data.csrfToken);
      notify("با موفقیت وارد شدید");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: ["csrf"] });
      }
    },
  });
  const submit = useMutationSubmit(handleSubmit, Boolean(csrf.data) && !csrf.isFetching);
  return (
    <main className="login-page">
      <div className="mb-7 space-y-3">
        <div className="brand-mark size-14">
          <Headphones size={28} />
        </div>
        <h1 className="text-2xl font-bold">ورود به سامانه پشتیبانی</h1>
        <p className="text-sm text-slate-600">
          برای پیگیری درخواست‌ها وارد حساب خود شوید.
        </p>
      </div>
      <section className="panel p-5 sm:p-7">
        <form
          noValidate
          onSubmit={submit((values) => login.mutateAsync(values))}
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
          )}
          {login.isError && <Failure error={login.error} />}
          <Button
            type="submit"
            className="w-full py-3"
            disabled={!csrf.data || csrf.isFetching || login.isPending}
          >
            {login.isPending ? (
              <span className="button-skeleton" aria-hidden="true" />
            ) : (
              <LogIn size={18} />
            )}
            {login.isPending ? "در حال ورود…" : "ورود به حساب"}
          </Button>
        </form>
        <a href="/register" className="mt-5 block text-sm text-primary">ساخت حساب مشتری</a>
      </section>
    </main>
  );
}

