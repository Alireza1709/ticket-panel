import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Field, TextInput } from "@/components/ui/field";
import { useMutationSubmit } from "@/lib/mutation-submit";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/feedback/failure";
import { useToast } from "@/components/feedback/toast";
import { getCsrf, registerCustomer, type Registration } from "@/lib/auth";
import { navigate } from "@/lib/navigation";

const fields = [
  { key: "name", label: "نام", type: "text", complete: "name", maxLength: 100 },
  { key: "email", label: "ایمیل", type: "email", complete: "email", maxLength: 254 },
  { key: "password", label: "گذرواژه", type: "password", complete: "new-password", maxLength: 128 },
  { key: "confirmation", label: "تکرار گذرواژه", type: "password", complete: "new-password", maxLength: 128 },
] as const;

export function Register() {
  const notify = useToast();
  const csrf = useQuery({ queryKey: ["csrf"], queryFn: getCsrf, staleTime: Infinity, retry: false });
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<Registration>();
  const registration = useMutation({
    mutationFn: (values: Registration) => registerCustomer(values, csrf.data?.csrfToken ?? ""),
    onSuccess: ({ message }) => {
      notify(message);
      navigate("/login");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) void csrf.refetch();
    },
  });
  const submit = useMutationSubmit(handleSubmit, Boolean(csrf.data) && !csrf.isFetching);
  return (
    <main className="login-page">
      <h1 className="mb-5 text-2xl font-bold">ساخت حساب مشتری</h1>
      <form className="panel space-y-4 p-5 sm:p-7" onSubmit={submit((values) => registration.mutateAsync(values))}>
        {fields.map(({ key, label, type, complete, maxLength }) => (
          <Field key={key} id={key} label={label} error={errors[key]?.message}>
            <TextInput id={key} type={type} autoComplete={complete} maxLength={maxLength}
              dir={key === "name" ? "auto" : "ltr"}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={errors[key] ? `${key}-error` : undefined}
              {...register(key, {
                required: "این فیلد الزامی است",
                validate: (value) => {
                  if (key === "name" && !value.trim()) return "نام را وارد کنید";
                  if (key === "password" && value.length < 12) return "حداقل ۱۲ نویسه وارد کنید";
                  if (key === "confirmation" && value !== getValues("password")) return "گذرواژه‌ها یکسان نیستند";
                  return true;
                },
              })}
            />
          </Field>
        ))}
        {csrf.isPending && <p role="status">در حال آماده‌سازی…</p>}
        {csrf.isError && <Failure error={csrf.error} retry={() => void csrf.refetch()} />}
        {registration.isError && <Failure error={registration.error} />}
        <Button type="submit" className="w-full" disabled={!csrf.data || csrf.isFetching || registration.isPending}>
          {registration.isPending ? "در حال ثبت‌نام…" : "ثبت‌نام"}
        </Button>
        <a href="/login" className="block text-sm text-primary">ورود به حساب</a>
      </form>
    </main>
  );
}
