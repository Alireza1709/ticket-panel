import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  categories,
  priorities,
  createTicketSchema,
  createdSchema,
  type CreateTicketValues,
} from "@/lib/tickets";
import { CsrfState, Failure, inputClass, useCustomerPost } from "./shared";

export function CreateTicket({
  navigate,
  notify,
}: {
  navigate: (path: string) => void;
  notify: (message: string) => void;
}) {
  const client = useQueryClient();
  const state = useCustomerPost();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTicketValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: "",
      description: "",
      priority: "normal",
      category: "other",
    },
  });
  const create = useMutation({
    mutationFn: (values: CreateTicketValues) =>
      state.post("/api/customer/tickets", values, createdSchema),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["tickets"] });
      notify(`${result.message}؛ شماره پیگیری: ${result.ticket.ticket_number}`);
      navigate(`/customer/tickets/${result.ticket.id}`);
    },
  });
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">ثبت تیکت جدید</h2>
      <p className="text-sm text-slate-500">
        موضوع و توضیحات درخواست خود را بنویسید تا بهتر راهنمایی شوید.
      </p>
      <form
        noValidate
        onSubmit={handleSubmit((values) => create.mutate(values))}
        className="space-y-5"
      >
        <fieldset disabled={create.isPending} className="space-y-5">
          <div>
            <label htmlFor="subject" className="mb-2 block text-sm font-medium">
              موضوع
            </label>
            <input
              id="subject"
              autoFocus
              maxLength={200}
              {...register("subject")}
              className={inputClass}
              aria-invalid={Boolean(errors.subject)}
              aria-describedby={errors.subject ? "subject-error" : undefined}
            />
            {errors.subject && (
              <p
                id="subject-error"
                role="alert"
                className="mt-1 text-sm text-red-700"
              >
                {errors.subject.message}
              </p>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="priority"
                className="mb-2 block text-sm font-medium"
              >
                اولویت
              </label>
              <select
                id="priority"
                {...register("priority")}
                className={inputClass}
              >
                {Object.entries(priorities).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.priority && (
                <p role="alert" className="text-red-700">
                  اولویت معتبر انتخاب کنید
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-medium"
              >
                دسته‌بندی
              </label>
              <select
                id="category"
                {...register("category")}
                className={inputClass}
              >
                {Object.entries(categories).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p role="alert" className="text-red-700">
                  دسته‌بندی معتبر انتخاب کنید
                </p>
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium"
            >
              توضیحات
            </label>
            <textarea
              id="description"
              rows={7}
              maxLength={10000}
              {...register("description")}
              className={inputClass}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "description-error" : undefined
              }
            />
            {errors.description && (
              <p
                id="description-error"
                role="alert"
                className="mt-1 text-sm text-red-700"
              >
                {errors.description.message}
              </p>
            )}
          </div>
        </fieldset>
        <CsrfState state={state} />
        {create.isError && <Failure error={create.error} />}
        <div className="flex gap-3">
          <Button type="submit" disabled={!state.ready || create.isPending}>
            {create.isPending ? "در حال ثبت…" : "ثبت تیکت"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={create.isPending}
            onClick={() => navigate("/customer/tickets")}
          >
            انصراف
          </Button>
        </div>
      </form>
    </div>
  );
}
