import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { successSchema } from "@/lib/tickets";
import { CsrfState, Failure, useCustomerPost } from "./shared";

export function CancelTicketDialog({
  ticketId,
  userId,
  onCancelled,
}: {
  ticketId: string;
  userId: string;
  onCancelled: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useCustomerPost();
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () =>
      state.post(`/api/customer/tickets/${ticketId}/cancel`, {}, successSchema),
    onSuccess: (result) => {
      setOpen(false);
      client.removeQueries({ queryKey: ["ticket", userId, ticketId] });
      onCancelled(result.message);
      void client.invalidateQueries({ queryKey: ["tickets", userId] });
    },
  });
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  return (
    <>
      <Button
        variant="outline"
        className="text-red-700"
        onClick={() => {
          cancel.reset();
          setOpen(true);
        }}
      >
        لغو تیکت
      </Button>
      <dialog
        ref={dialog}
        dir="rtl"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-description"
        className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl backdrop:bg-slate-900/50"
        onCancel={(event) => {
          event.preventDefault();
          if (!cancel.isPending) setOpen(false);
        }}
      >
        <div className="space-y-5">
          <h3 id="cancel-title" className="text-xl font-bold">
            تأیید لغو تیکت
          </h3>
          <p id="cancel-description" className="leading-7 text-slate-600">
            آیا از لغو این تیکت مطمئن هستید؟ پس از تأیید، تیکت از فهرست شما خارج
            می‌شود و دیگر قابل پاسخ‌گویی نیست.
          </p>
          <CsrfState state={state} />
          {cancel.isError && <Failure error={cancel.error} />}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              autoFocus
              disabled={cancel.isPending}
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button
              className="bg-red-700 text-white"
              disabled={!state.ready || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "در حال لغو…" : "تأیید لغو تیکت"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
