/* Shared UI primitives — shadcn-style, matching the original component classes. */
(function () {
  const React = window.React;
  const cn = (...a) => a.filter(Boolean).join(" ");
  window.cn = cn;

  /* Last-modified formatter: relative for recent, absolute date otherwise. */
  function fmtDateShort(ts) {
    if (!ts) return "—";
    const d = new Date(ts), now = Date.now(), diff = Math.round((now - ts) / 1000);
    if (diff < 60) return "hace un momento";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 172800) return "ayer";
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  window.fmtDateShort = fmtDateShort;

  /* ---------------- Lucide icon renderer ---------------- */
  function LucideIcon({ name, className, size = 24, strokeWidth = 2, style }) {
    const lib = window.lucide && window.lucide.icons;
    const data = lib && lib[name];
    // Lucide node shape: ["svg", attrs, [ [tag, attrs], ... ]]
    const nodes = Array.isArray(data) && Array.isArray(data[2]) ? data[2] : [];
    const children = nodes.map((node, i) => {
      const tag = node[0], attrs = node[1] || {};
      return React.createElement(tag, Object.assign({ key: i }, attrs));
    });
    return React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: size, height: size, viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor", strokeWidth,
        strokeLinecap: "round", strokeLinejoin: "round",
        className, style, "aria-hidden": true,
      },
      children
    );
  }

  /* ---------------- Button — Liquid Glass hierarchy ----------------
     primary (tinted brand) · default (Ink fill) · glass (secondary) · plain/ghost (text) · destructive.
     States: hover tint, pressed scale .97 (spring), disabled, focus ring. Pill-shaped. */
  const BTN_BASE = "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-150 ease-glide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]";
  const BTN_VARIANT = {
    primary: "bg-brand text-brand-foreground shadow-soft hover:bg-brand/90",
    default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
    glass: "glass-tile text-foreground hover:brightness-[1.03]",
    outline: "border border-border bg-surface-elevated text-foreground shadow-soft hover:bg-surface",
    ghost: "text-foreground hover:bg-muted",
    plain: "text-foreground hover:bg-muted",
    destructive: "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90",
  };
  const BTN_SIZE = {
    default: "h-9 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    icon: "h-9 w-9",
  };
  function Button({ variant = "default", size = "default", className, children, ...rest }) {
    return React.createElement("button", { type: "button", ...rest, className: cn(BTN_BASE, BTN_VARIANT[variant] || BTN_VARIANT.default, BTN_SIZE[size], className) }, children);
  }

  /* ---------------- Badge — standardized pill marker ---------------- */
  const BADGE_TONE = {
    neutral: "bg-muted text-muted-foreground",
    brand: "bg-brand/10 text-brand",
    green: "bg-accent-green/10 text-accent-green",
    amber: "bg-accent-amber/15 text-accent-amber",
    red: "bg-destructive/10 text-destructive",
    violet: "bg-accent-violet/10 text-accent-violet",
  };
  function Badge({ tone = "neutral", className, children }) {
    return React.createElement("span", { className: cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight", BADGE_TONE[tone] || BADGE_TONE.neutral, className) }, children);
  }

  /* ---------------- SectionTitle — standardized heading block ---------------- */
  function SectionTitle({ eyebrow, title, description, className }) {
    return React.createElement(
      "div", { className: cn("min-w-0", className) },
      eyebrow ? React.createElement("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" }, eyebrow) : null,
      React.createElement("h2", { className: "text-base font-semibold tracking-tight text-foreground sm:text-lg" }, title),
      description ? React.createElement("p", { className: "mt-0.5 text-xs text-muted-foreground" }, description) : null
    );
  }

  /* ---------------- Card — solid (elevated white) or glass material ---------------- */
  function Card({ glass, className, children, ...rest }) {
    return React.createElement("div", { ...rest, className: cn("rounded-2xl", glass ? "glass-panel" : "border border-border/60 bg-surface-elevated shadow-soft", className) }, children);
  }

  /* ---------------- Input ---------------- */
  function Input({ className, ...rest }) {
    return React.createElement("input", {
      ...rest,
      className: cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      ),
    });
  }

  /* ---------------- Textarea ---------------- */
  const Textarea = React.forwardRef(function Textarea({ className, ...rest }, ref) {
    return React.createElement("textarea", {
      ref,
      ...rest,
      className: cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      ),
    });
  });

  /* ---------------- Label ---------------- */
  function Label({ className, children, ...rest }) {
    return React.createElement("label", { ...rest, className: cn("text-sm font-medium leading-none", className) }, children);
  }

  /* ---------------- Checkbox ---------------- */
  function Checkbox({ checked, onCheckedChange, className }) {
    return React.createElement(
      "button",
      {
        type: "button",
        role: "checkbox",
        "aria-checked": !!checked,
        onClick: () => onCheckedChange && onCheckedChange(!checked),
        className: cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 bg-transparent",
          className
        ),
      },
      checked ? React.createElement(LucideIcon, { name: "Check", className: "h-3 w-3", strokeWidth: 3 }) : null
    );
  }

  /* ---------------- Native select styled like shadcn trigger ----------------
     options: array of [value, label] or {value,label}; or pass children. */
  function Select({ value, onChange, options, className, children, ariaLabel, title }) {
    const opts = (options || []).map((o) => Array.isArray(o) ? { value: o[0], label: o[1] } : o);
    return React.createElement(
      "div",
      { className: cn("relative inline-flex w-full items-center", className) },
      React.createElement(
        "select",
        {
          value, onChange: (e) => onChange && onChange(e.target.value),
          "aria-label": ariaLabel, title,
          className: "h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-transparent pl-3 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        },
        children || opts.map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label))
      ),
      React.createElement(LucideIcon, { name: "ChevronDown", className: "pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground opacity-60" })
    );
  }

  /* ---------------- Popover (lightweight) ---------------- */
  function Popover({ trigger, children, align = "start", className, width = "w-40" }) {
    const [open, setOpen] = React.useState(false);
    const [pos, setPos] = React.useState(null);
    const triggerRef = React.useRef(null);
    const panelRef = React.useRef(null);
    const RD = window.ReactDOM;

    const place = React.useCallback(() => {
      const el = triggerRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const p = { top: Math.round(r.bottom + 4) };
      if (align === "end") p.right = Math.round(Math.max(8, window.innerWidth - r.right));
      else p.left = Math.round(Math.min(r.left, window.innerWidth - 8));
      setPos(p);
    }, [align]);

    React.useLayoutEffect(() => { if (open) place(); }, [open, place]);
    // Clamp horizontally if the rendered panel would overflow the viewport.
    React.useLayoutEffect(() => {
      if (!open || !panelRef.current || !pos) return;
      const pr = panelRef.current.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8 && pos.left != null) {
        setPos((p) => ({ top: p.top, left: Math.max(8, window.innerWidth - 8 - pr.width) }));
      }
    });
    React.useEffect(() => {
      if (!open) return;
      const onDoc = (e) => {
        if (triggerRef.current && triggerRef.current.contains(e.target)) return;
        if (panelRef.current && panelRef.current.contains(e.target)) return;
        setOpen(false);
      };
      const reposition = () => place();
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("scroll", reposition, true);
      window.addEventListener("resize", reposition);
      return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
    }, [open, place]);

    return React.createElement(
      React.Fragment, null,
      React.createElement("div", { ref: triggerRef, className: "relative", onClick: () => setOpen((o) => !o) }, trigger),
      open && pos && RD
        ? RD.createPortal(
            React.createElement(
              "div",
              { ref: panelRef, style: { position: "fixed", top: pos.top, left: pos.left, right: pos.right, zIndex: 80 },
                className: cn("rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-elevated", width, className) },
              typeof children === "function" ? children(setOpen) : children
            ),
            document.body
          )
        : null
    );
  }

  /* ---------------- SectionCard ---------------- */
  const SECTION_ACCENT = {
    brand: "bg-brand/10 text-brand",
    violet: "bg-accent-violet/10 text-accent-violet",
    pink: "bg-accent-pink/10 text-accent-pink",
    amber: "bg-accent-amber/15 text-accent-amber",
    green: "bg-accent-green/10 text-accent-green",
  };
  function SectionCard({ icon, eyebrow, title, description, children, className, accent = "brand" }) {
    return React.createElement(
      "section",
      { className: cn("rounded-2xl border border-border bg-surface-elevated p-4 shadow-soft transition-shadow hover:shadow-elevated sm:p-5", className), "data-screen-label": title },
      React.createElement(
        "div", { className: "mb-3 flex items-center gap-3" },
        icon ? React.createElement("div", { className: cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", SECTION_ACCENT[accent]) }, icon) : null,
        React.createElement(
          "div", { className: "min-w-0 flex-1" },
          eyebrow ? React.createElement("p", { className: "text-[10px] font-medium uppercase tracking-wider text-muted-foreground" }, eyebrow) : null,
          React.createElement("h2", { className: "text-base font-semibold tracking-tight text-foreground sm:text-lg" }, title),
          description ? React.createElement("p", { className: "text-xs text-muted-foreground" }, description) : null
        )
      ),
      children
    );
  }

  /* ---------------- Toast (sonner-ish) ---------------- */
  function toast(message) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "fixed bottom-4 right-4 z-[100] flex flex-col gap-2";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium text-foreground shadow-elevated";
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.textContent = "✓  " + message;
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 300); }, 2600);
  }

  /* ---------------- OwnerSelect — responsable dropdown fed by Members ---------------- */
  function OwnerSelect({ value, onChange, disabled, className, placeholder = "Sin asignar", framed }) {
    const S = window.Store;
    const members = S.useMembers();
    const names = members.map((m) => m.name);
    const active = members.filter((m) => m.status === "active");
    const inactive = members.filter((m) => m.status !== "active");
    const missing = value && !names.includes(value);
    return React.createElement(
      "select",
      {
        value: value || "", disabled,
        onChange: (e) => onChange && onChange(e.target.value),
        className: cn(
          framed
            ? "h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            : "cursor-pointer appearance-none rounded-md border-0 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-default disabled:opacity-100",
          className
        ),
      },
      React.createElement("option", { value: "" }, "— " + placeholder + " —"),
      active.map((m) => React.createElement("option", { key: m.id, value: m.name }, m.name)),
      inactive.map((m) => React.createElement("option", { key: m.id, value: m.name }, m.name + " (inactivo)")),
      missing ? React.createElement("option", { value: value }, value + " (eliminado)") : null
    );
  }

  /* ===== DatePicker: calendario propio al estilo de la app (BUG-3104/CAD8) =====
     Reemplaza el <input type=date> nativo (que mostraba formatos confusos sin mes).
     Muestra un mini-calendario mensual; value/onChange en ISO "YYYY-MM-DD". */
  function DatePicker({ value, onChange, disabled, className, placeholder = "Fecha", align = "start" }) {
    const { useState } = React;
    const MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const MES_COR = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const DOW = ["L","M","M","J","V","S","D"];
    const parse = (iso) => { if (!iso) return null; const [y,m,d] = iso.split("-").map(Number); if (!y||!m||!d) return null; const dt = new Date(y, m-1, d); return isNaN(dt) ? null : dt; };
    const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
    const sel = parse(value);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => sel || new Date());
    const label = sel ? `${sel.getDate()} ${MES_COR[sel.getMonth()]} ${sel.getFullYear()}` : "";

    const y = view.getFullYear(), m = view.getMonth();
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // L=0
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const today = new Date(); const todayISO = toISO(today);
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));

    const pick = (dt) => { onChange(toISO(dt)); setOpen(false); };

    if (disabled) {
      return <span className={cn("inline-flex h-7 items-center px-1 text-[11px] text-muted-foreground", className)}>{label || "—"}</span>;
    }
    return (
      <div className="relative inline-block">
        <button type="button" onClick={() => { setView(sel || new Date()); setOpen((v) => !v); }}
          className={cn("inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] font-medium transition-colors hover:border-foreground/30", label ? "text-foreground" : "text-muted-foreground", className)}>
          <LucideIcon name="Calendar" className="h-3 w-3" />
          {label || placeholder}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[140]" onClick={() => setOpen(false)} />
            <div className={cn("absolute z-[141] mt-1 w-60 rounded-2xl border border-border bg-surface-elevated p-3 shadow-elevated", align === "end" ? "right-0" : "left-0")}>
              <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => setView(new Date(y, m-1, 1))} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="ChevronLeft" className="h-4 w-4" /></button>
                <span className="text-[12.5px] font-semibold text-foreground">{MES[m]} {y}</span>
                <button type="button" onClick={() => setView(new Date(y, m+1, 1))} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="ChevronRight" className="h-4 w-4" /></button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {DOW.map((d, i) => <span key={i} className="flex h-6 items-center justify-center text-[9px] font-semibold uppercase text-muted-foreground/70">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((dt, i) => {
                  if (!dt) return <span key={i} />;
                  const iso = toISO(dt);
                  const isSel = value === iso, isToday = iso === todayISO;
                  return (
                    <button key={i} type="button" onClick={() => pick(dt)}
                      className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11.5px] tabular-nums transition-colors",
                        isSel ? "bg-brand font-semibold text-white" : isToday ? "border border-brand/40 text-brand hover:bg-brand/10" : "text-foreground hover:bg-surface")}>
                      {dt.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                <button type="button" onClick={() => pick(new Date())} className="text-[11px] font-medium text-brand hover:underline">Hoy</button>
                {value && <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-[11px] text-muted-foreground hover:text-destructive">Quitar fecha</button>}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  Object.assign(window, { LucideIcon, Button, Badge, SectionTitle, Card, Input, Textarea, Label, Checkbox, Select, OwnerSelect, Popover, SectionCard, toast, DatePicker });
})();
