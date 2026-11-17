import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  CsrfState,
  Failure,
  Pending,
  inputClass,
  useAuthFailure,
  useCustomerPost as useTicketPost,
} from "@/components/customer/shared";
import { api } from "@/lib/api";
import {
  statuses,
  statusSchema,
  successSchema,
  type Detail,
} from "@/lib/tickets";
import { allowedTransitions, membersSchema } from "@/lib/staff-tickets";

const changeSchema = z.object({ status: statusSchema });
function StatusForm({
  ticket,
  onChanged,
}: {
  ticket: Detail["ticket"];
  onChanged: (message: string) => Promise<void>;
}) {
  const state = useTicketPost();
  const client = useQueryClient();
  const options = allowedTransitions[ticket.status];
  const { register, handleSubmit } = useForm<z.infer<typeof changeSchema>>({
    resolver: zodResolver(changeSchema),
    defaultValues: { status: options[0] },
  });
  const mutation = useMutation({
    mutationFn: (body: z.infer<typeof changeSchema>) =>
      state.post(`/api/staff/tickets/${ticket.id}/status`, body, successSchema),
    onSuccess: (result) => onChanged(result.message),
    onError: () => {
      void client.invalidateQueries({ queryKey: ["staff-ticket"] });
    },
  });
  if (options.length === 0)
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm">
        این تیکت بسته است و امکان تغییر وضعیت ندارد.
      </p>
    );
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-3"
    >
      <label htmlFor="next-status" className="block font-semibold">
        تغییر وضعیت
      </label>
      <select
        id="next-status"
        {...register("status")}
        className={inputClass}
        disabled={mutation.isPending}
      >
        {options.map((value) => (
          <option value={value} key={value}>
            {statuses[value]}
          </option>
        ))}
      </select>
      <CsrfState state={state} />
      {mutation.isError && <Failure error={mutation.error} />}
      <Button type="submit" disabled={!state.ready || mutation.isPending}>
        {mutation.isPending ? "در حال ذخیره…" : "ثبت وضعیت"}
      </Button>
    </form>
  );
}
const assignSchema = z.object({
  assigned_to: z.string().uuid("کارشناس فعال انتخاب کنید"),
});
function AssignmentForm({
  ticket,
  members,
  onChanged,
}: {
  ticket: Detail["ticket"];
  members: z.infer<typeof membersSchema>["members"];
  onChanged: (message: string) => Promise<void>;
}) {
  const state = useTicketPost();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof assignSchema>>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      assigned_to: members.some((member) => member.id === ticket.assigned_to)
        ? (ticket.assigned_to ?? "")
        : "",
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof assignSchema>) =>
      state.post(
        `/api/staff/tickets/${ticket.id}/assignment`,
        values,
        successSchema,
      ),
    onSuccess: (result) => onChanged(result.message),
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-3"
    >
      <label htmlFor="assigned-staff" className="block font-semibold">
        واگذاری به کارشناس
      </label>
      <select
        id="assigned-staff"
        {...register("assigned_to")}
        disabled={mutation.isPending}
        className={inputClass}
      >
        <option value="">انتخاب کارشناس</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      {errors.assigned_to && (
        <p role="alert" className="text-sm text-red-700">
          {errors.assigned_to.message}
        </p>
      )}
      <CsrfState state={state} />
      {mutation.isError && <Failure error={mutation.error} />}
      <Button type="submit" disabled={!state.ready || mutation.isPending}>
        {mutation.isPending ? "در حال واگذاری…" : "ثبت کارشناس"}
      </Button>
    </form>
  );
}
export function TicketControls({
  ticket,
  onChanged,
}: {
  ticket: Detail["ticket"];
  onChanged: (message: string) => Promise<void>;
}) {
  const query = useQuery({
    queryKey: ["staff-members"],
    queryFn: () => api("/api/staff/members", membersSchema),
    retry: false,
  });
  useAuthFailure(query.error);
  return (
    <section
      aria-label="مدیریت تیکت"
      className="grid gap-6 rounded-xl border border-border p-4 sm:grid-cols-2"
    >
      <StatusForm key={ticket.status} ticket={ticket} onChanged={onChanged} />
      {query.isPending ? (
        <Pending />
      ) : query.isError ? (
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.members.length === 0 ? (
        <p>کارشناس فعالی برای واگذاری وجود ندارد.</p>
      ) : (
        <AssignmentForm
          key={ticket.assigned_to}
          ticket={ticket}
          members={query.data.members}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}
