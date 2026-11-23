import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "./toast";

export function Failure({ error, retry }: { error: Error; retry?: () => void }) {
  const notify = useToast();
  useEffect(() => {
    notify(error.message, "error", 7000);
  }, [error, notify]);

  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
    >
      <p>{error.message}</p>
      {retry && <Button variant="outline" onClick={retry}>تلاش دوباره</Button>}
    </div>
  );
}
