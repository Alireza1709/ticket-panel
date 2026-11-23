import { useRef } from "react";
import type { FieldValues, UseFormHandleSubmit } from "react-hook-form";

export function useMutationSubmit<T extends FieldValues>(
  handleSubmit: UseFormHandleSubmit<T>,
  ready: boolean,
) {
  const submitting = useRef(false);
  return (mutate: (values: T) => Promise<unknown>) =>
    handleSubmit(async (values) => {
      if (!ready || submitting.current) return;
      submitting.current = true;
      try {
        await mutate(values);
      } catch {
        // The React Query mutation exposes the error to the form.
      } finally {
        submitting.current = false;
      }
    });
}
