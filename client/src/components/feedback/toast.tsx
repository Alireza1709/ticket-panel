import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

const icons = {
  success: CircleCheck,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};
type Tone = keyof typeof icons;
type Notify = (message: string, tone?: Tone, duration?: number) => void;
type Toast = { id: number; message: string; tone: Tone; duration: number };

const ToastContext = createContext<{ notify: Notify; clear: () => void }>({
  notify: () => {},
  clear: () => {},
});
let nextId = 0;

export function useToast() {
  return useContext(ToastContext).notify;
}

export function useClearToasts() {
  return useContext(ToastContext).clear;
}

function Notification({ toast, remove }: { toast: Toast; remove: () => void }) {
  const [closing, setClosing] = useState(false);
  const Icon = icons[toast.tone];
  return (
    <div
      className="toast"
      data-tone={toast.tone}
      data-closing={closing}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && closing) remove();
      }}
    >
      <div className="flex min-w-0 items-start gap-3" role={toast.tone === "error" ? "alert" : "status"}>
        <Icon size={20} className="shrink-0 text-[var(--toast-accent)]" aria-hidden="true" />
        <p className="min-w-0 break-words">{toast.message}</p>
      </div>
      <button
        type="button"
        className="icon-action -my-1"
        title="بستن اعلان"
        aria-label="بستن اعلان"
        onClick={() => setClosing(true)}
      >
        <X size={17} aria-hidden="true" />
      </button>
      <div
        className="toast-progress"
        aria-hidden="true"
        style={{ animationDuration: `${toast.duration}ms` }}
        onAnimationEnd={() => setClosing(true)}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const clear = useCallback(() => setToasts([]), []);
  const notify = useCallback<Notify>((message, tone = "success", duration = 5000) => {
    setToasts((current) =>
      current.some((toast) => toast.message === message && toast.tone === tone)
        ? current
        : [...current.slice(-3), { id: ++nextId, message, tone, duration }],
    );
  }, []);
  const value = useMemo(() => ({ notify, clear }), [notify, clear]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div dir="rtl" className="toast-stack" aria-label="اعلان‌ها">
        {toasts.map((toast) => (
          <Notification
            key={toast.id}
            toast={toast}
            remove={() => setToasts((current) => current.filter(({ id }) => id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
