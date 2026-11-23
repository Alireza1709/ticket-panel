import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

export function Select<T extends string>({
  id, value, options, onChange, disabled, searchable,
}: {
  id: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [search, setSearch] = useState("");
  const expanded = open && !disabled;
  const visible = options.filter(({ label }) => !searchable || label.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    if (!expanded) return;
    if (searchable) searchInput.current?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded, searchable]);

  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, expanded, listId]);

  function show() {
    setSearch("");
    setActive(Math.max(0, options.findIndex((item) => item.value === value)));
    setOpen(true);
  }
  function choose(next: T) {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      if (!expanded && (event.key === "Home" || event.key === "End")) return;
      event.preventDefault();
      if (!expanded) show();
      else if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(visible.length - 1);
      else setActive((index) => Math.max(0, Math.min(visible.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (expanded && (event.key === "Enter" || (event.key === " " && !searchable))) {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option.value);
    }
  }

  return (
    <div className="select-root" ref={root} onKeyDown={keydown}>
      <button ref={trigger} id={id} type="button" disabled={disabled} className="select-trigger"
        role={searchable ? undefined : "combobox"} aria-haspopup="listbox"
        aria-expanded={expanded} aria-controls={listId}
        aria-activedescendant={!searchable && expanded && visible[active] ? `${listId}-${active}` : undefined}
        onClick={() => expanded ? setOpen(false) : show()}>
        <span>{options.find((item) => item.value === value)?.label ?? "انتخاب کنید"}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      <div className="select-panel" data-open={expanded} inert={!expanded}>
        {searchable && <input ref={searchInput} value={search} role="combobox" aria-expanded={expanded}
          aria-controls={listId} aria-label="جست‌وجوی گزینه‌ها" autoComplete="off"
          aria-activedescendant={expanded && visible[active] ? `${listId}-${active}` : undefined}
          onChange={(event) => { setSearch(event.target.value); setActive(0); }} />}
        <ul id={listId} role="listbox" aria-labelledby={id}>
          {visible.map((option, index) => (
            <li key={option.value} id={`${listId}-${index}`} role="option"
              aria-selected={option.value === value} data-active={active === index}
              onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}>
              {option.label}
              {option.value === value && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
        {visible.length === 0 && <p role="status">گزینه‌ای یافت نشد</p>}
      </div>
    </div>
  );
}

export const selectOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
