import { Select } from "@/components/ui/select";
import { useMutationSubmit } from "@/lib/mutation-submit";
import { Skeleton } from "@/components/feedback/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  CsrfState,
  Failure,
  useAuthFailure,
  useTicketPost,
} from "@/components/shared/ticket-form";
import { staffApi } from "@/lib/ticket-api";
import {
  statuses,
  statusSchema,
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
  const { watch, setValue, handleSubmit } = useForm<z.infer<typeof changeSchema>>({
    resolver: zodResolver(changeSchema),
    defaultValues: { status: options[0] },
  });
  const mutation = useMutation({
    mutationFn: (body: z.infer<typeof changeSchema>) =>
      state.post((token) => staffApi.changeStatus(ticket.id, body.status, token)),
    onSuccess: (result) => onChanged(result.message),
    onError: () => {
      void client.invalidateQueries({ queryKey: ["staff-ticket"] });
    },
  });
  const submit = useMutationSubmit(handleSubmit, state.ready);
  if (options.length === 0)
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm">
        این تیکت بسته است و امکان تغییر وضعیت ندارد.
      </p>
    );
  return (
    <form
      noValidate
      onSubmit={submit((values) => mutation.mutateAsync(values))}
      className="space-y-3"
    >
      <label htmlFor="next-status" className="block font-semibold">
        تغییر وضعیت
      </label>
      <Select id="next-status" value={watch("status")} options={options.map((value) => ({ value, label: statuses[value] }))}
        disabled={mutation.isPending}
        onChange={(value) => setValue("status", value, { shouldValidate: true })} />
      <CsrfState state={state} />
      {mutation.isError && <Failure error={mutation.error} />}
      <Button type="submit" disabled={!state.ready || mutation.isPending}>
        {mutation.isPending && <span className="button-skeleton" aria-hidden="true" />}
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
    watch,
    setValue,
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
      state.post((token) => staffApi.assign(ticket.id, values.assigned_to, token)),
    onSuccess: (result) => onChanged(result.message),
  });
  const submit = useMutationSubmit(handleSubmit, state.ready);
  return (
    <form
      noValidate
      onSubmit={submit((values) => mutation.mutateAsync(values))}
      className="space-y-3"
    >
      <label htmlFor="assigned-staff" className="block font-semibold">
        واگذاری به کارشناس
      </label>
      <Select id="assigned-staff" value={watch("assigned_to")} options={members.map(({ id, name }) => ({ value: id, label: name }))}
        disabled={mutation.isPending} searchable
        onChange={(value) => setValue("assigned_to", value, { shouldValidate: true })} />
      {errors.assigned_to && (
        <p role="alert" className="text-sm text-red-700">
          {errors.assigned_to.message}
        </p>
      )}
      <CsrfState state={state} />
      {mutation.isError && <Failure error={mutation.error} />}
      <Button type="submit" disabled={!state.ready || mutation.isPending}>
        {mutation.isPending && <span className="button-skeleton" aria-hidden="true" />}
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
    queryFn: staffApi.members,
    retry: false,
  });
  useAuthFailure(query.error);
  return (
    <section
      aria-label="مدیریت تیکت"
      className="panel grid gap-6 p-4 sm:grid-cols-2 sm:p-5"
    >
      <StatusForm key={ticket.status} ticket={ticket} onChanged={onChanged} />
      {query.isPending ? (
        <Skeleton kind="form" />
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
