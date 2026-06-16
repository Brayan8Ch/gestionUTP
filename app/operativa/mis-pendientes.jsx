/* Mis Pendientes — Execution Dashboard per analyst (consulting-style).
   Consumes the enriched task rows from the Command Center (overdue/daysLeft/critical/upcoming). */
(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useMemo, useState, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Input, Checkbox, DatePicker } = window;
  const cn = window.cn;

  const DAY = 86400000;
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const fmtShort = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";
  const relTime = (ts) => {
    if (!ts) return null;
    const days = Math.floor((today0().getTime() - new Date(ts).setHours(0, 0, 0, 0)) / DAY);
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    return `hace ${days}d`;
  };
  const lastUpdateTs = (r) => {
    const u = Array.isArray(r.updates) && r.updates.length ? r.updates[r.updates.length - 1].ts : null;
    return u || (r.createdAt ? new Date(r.createdAt).getTime() : null);
  };
  const lastUpdateText = (r) => {
    if (Array.isArray(r.updates) && r.updates.length) { const u = r.updates[r.updates.length - 1]; return u.text || (window.UPDATE_LABELS ? window.UPDATE_LABELS[u.type] : "") || "Actualización"; }
    return null;
  };

  const PRIO_DOT = { high: "bg-destructive", med: "bg-accent-amber", low: "bg-muted-foreground/40" };
  const PRIO_LABEL = { high: "Alta", med: "Media", low: "Baja" };
  const ST_LABEL = { todo: "No iniciado", in_progress: "En progreso", blocked: "En revisión", done: "Completado" };
  const ST_TONE = {
    todo: "bg-muted text-muted-foreground", in_progress: "bg-brand/10 text-brand",
    blocked: "bg-accent-amber/15 text-accent-amber", done: "bg-accent-green/10 text-accent-green",
  };

  // staleDays: days since last update/creation (only meaningful for in-progress work).
  const _DAY = 86400000;
  function drDaysLeft(deadline) {
    if (!deadline) return null;
    const d = new Date(deadline + "T00:00:00"); if (isNaN(d)) return null;
    return Math.round((d.setHours(0,0,0,0) - today0().getTime()) / _DAY);
  }
  function drOverdue(deadline, status) {
    if (status === "approved" || status === "cancelled") return false;
    const dl = drDaysLeft(deadline); return dl != null && dl < 0;
  }
  function enrich(r) {
    const lu = lastUpdateTs(r);
    const staleDays = lu ? Math.floor((today0().getTime() - new Date(lu).setHours(0, 0, 0, 0)) / DAY) : null;
    const stale = r.status === "in_progress" && staleDays != null && staleDays >= 3;
    const reasons = [];
    if (r.overdue) reasons.push({ t: `Retrasada ${Math.abs(r.daysLeft)}d`, tone: "red" });
    else if (r.daysLeft === 0) reasons.push({ t: "Vence hoy", tone: "amber" });
    else if (r.daysLeft != null && r.daysLeft <= 2) reasons.push({ t: `Vence en ${r.daysLeft}d`, tone: "amber" });
    if (r.status === "blocked") reasons.push({ t: "En revisión", tone: "amber" });
    if (r.priority === "high") reasons.push({ t: "Prioridad alta", tone: "violet" });
    if (stale) reasons.push({ t: `${staleDays}d sin avance`, tone: "amber" });
    if (r.campaignTitle && !reasons.some((x) => x.tone === "red")) reasons.push({ t: "Depende de campaña", tone: "neutral" });
    let group = "later";
    if (r.overdue || r.daysLeft === 0 || (r.priority === "high" && r.daysLeft != null && r.daysLeft <= 2)) group = "critical";
    else if (r.upcoming || r.priority === "high") group = "week";
    const score = (r.overdue ? 0 : r.daysLeft === 0 ? 1 : r.status === "blocked" ? 2.5 : r.critical ? 3 : r.upcoming ? 4 : 5)
      - (r.priority === "high" ? 0.5 : 0);
    return { ...r, staleDays, stale, reasons, group, score };
  }

  /* ================= Modo Ejecución: cronómetro persistente =================
     Un solo pendiente en ejecución a la vez. Sobrevive recargas (localStorage). */
  const EXEC_KEY = "exec-timer:v1";
  const EXEC_EVT = "exec-timer-change";
  const readExec = () => { try { return JSON.parse(localStorage.getItem(EXEC_KEY) || "null"); } catch { return null; } };
  const writeExec = (v) => { try { v ? localStorage.setItem(EXEC_KEY, JSON.stringify(v)) : localStorage.removeItem(EXEC_KEY); } catch {} window.dispatchEvent(new CustomEvent(EXEC_EVT)); };
  function useExecTimer() {
    const [exec, setExec] = useState(readExec);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
      const on = () => setExec(readExec());
      window.addEventListener(EXEC_EVT, on); window.addEventListener("storage", on);
      return () => { window.removeEventListener(EXEC_EVT, on); window.removeEventListener("storage", on); };
    }, []);
    useEffect(() => {
      if (!exec) return;
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
    }, [exec ? exec.taskId : null]);
    return {
      exec, now,
      start: (payload) => writeExec(payload),
      extend: (min) => { const e = readExec(); if (e) { e.endsAt += min * 60000; e.totalMin += min; writeExec(e); } },
      pause: () => { const e = readExec(); if (e && !e.pausedAt) { e.pausedAt = Date.now(); writeExec(e); } },
      resume: () => { const e = readExec(); if (e && e.pausedAt) { e.endsAt += Date.now() - e.pausedAt; e.pausedAt = null; writeExec(e); } },
      clear: () => writeExec(null),
    };
  }
  const fmtClock = (ms) => {
    const s = Math.max(0, Math.round(Math.abs(ms) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  /* Modal: ¿cuánto tiempo le quieres dar? */
  function ExecModal({ r, onClose, onStart }) {
    const [min, setMin] = useState(r.estimateMin || 30);
    const PRESETS = [15, 25, 30, 45, 60, 90];
    const valid = Number(min) >= 1 && Number(min) <= 480;
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-label="Poner en ejecución">
        <button type="button" aria-label="Cerrar" onClick={onClose} className="fade-in absolute inset-0 w-full bg-foreground/30 backdrop-blur-[2px]"></button>
        <div className="sheet-up relative w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">Poner en ejecución</p>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">{r.title || "Pendiente"}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">¿Cuánto tiempo quieres darle? Se iniciará un cronómetro.</p>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setMin(p)}
                className={cn("h-10 rounded-xl border text-[13px] font-semibold tabular-nums transition-colors",
                  Number(min) === p ? "border-brand bg-brand text-white" : "border-border bg-surface text-foreground hover:border-foreground/30")}>
                {p} min
              </button>
            ))}
          </div>
          <label className="mt-2.5 flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3">
            <LucideIcon name="Timer" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input type="number" min="1" max="480" value={min} onChange={(e) => setMin(e.target.value)}
              className="w-full bg-transparent text-[13px] font-medium tabular-nums text-foreground focus-visible:outline-none" />
            <span className="shrink-0 text-[11px] text-muted-foreground">minutos</span>
          </label>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-full border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">Cancelar</button>
            <button type="button" disabled={!valid} onClick={() => valid && onStart(Math.round(Number(min)))}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-40">
              <LucideIcon name="Play" className="h-3.5 w-3.5" /> Iniciar cronómetro
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* Barra de ejecución activa: cronómetro grande + acciones */
  function ExecBar({ exec, now, onExtend, onPause, onResume, onStop, onFinish }) {
    const paused = !!exec.pausedAt;
    const remaining = paused ? exec.endsAt - exec.pausedAt : exec.endsAt - now;
    const over = remaining < 0;
    const totalMs = Math.max(1, exec.totalMin * 60000);
    const pct = over ? 100 : Math.min(100, Math.max(0, 100 - (remaining / totalMs) * 100));
    return (
      <div className={cn("rounded-2xl p-4 text-background shadow-elevated sm:p-5", over ? "bg-destructive" : "bg-foreground")}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/15">
            <LucideIcon name={paused ? "Pause" : "Timer"} className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-background/70">
              <span className={cn("h-1.5 w-1.5 rounded-full bg-background", !paused && "animate-pulse")}></span>
              {paused ? "En pausa" : over ? "Tiempo agotado" : "En ejecución"}
            </p>
            <p className="mt-0.5 truncate text-[14px] font-semibold leading-snug" title={exec.title}>{exec.title || "Pendiente"}</p>
            <p className="mt-0.5 truncate text-[11px] text-background/60">{exec.owner || "—"} · {exec.totalMin} min asignados</p>
          </div>
          <p className={cn("shrink-0 text-[34px] font-bold tabular-nums leading-none tracking-tight sm:text-[40px]", paused && "opacity-60")}>
            {over ? "+" : ""}{fmtClock(remaining)}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button type="button" onClick={paused ? onResume : onPause} title={paused ? "Reanudar" : "Pausar"}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-background/30 px-3 text-[12px] font-semibold transition-colors hover:bg-background/10">
              <LucideIcon name={paused ? "Play" : "Pause"} className="h-3.5 w-3.5" /> {paused ? "Reanudar" : "Pausar"}
            </button>
            <button type="button" onClick={() => onExtend(5)} title="Añadir 5 minutos"
              className="h-9 whitespace-nowrap rounded-full border border-background/30 px-3 text-[12px] font-semibold transition-colors hover:bg-background/10">+5 min</button>
            <button type="button" onClick={onStop} title="Detener sin completar"
              className="h-9 whitespace-nowrap rounded-full border border-background/30 px-3 text-[12px] font-semibold transition-colors hover:bg-background/10">Detener</button>
            <button type="button" onClick={onFinish}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-background px-3.5 text-[12px] font-bold text-foreground transition-colors hover:bg-background/90">
              <LucideIcon name="Check" className="h-3.5 w-3.5" /> Completar
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/20">
          <span className={cn("block h-full rounded-full bg-background", !paused && "transition-[width] duration-1000 ease-linear")} style={{ width: `${pct}%` }}></span>
        </div>
      </div>
    );
  }

  const REASON_TONE = {
    red: "bg-destructive/10 text-destructive", amber: "bg-accent-amber/15 text-accent-amber",
    violet: "bg-accent-violet/10 text-accent-violet", neutral: "bg-surface text-muted-foreground",
  };
  function ReasonPills({ reasons }) {
    return (
      <div className="flex flex-wrap gap-1">
        {reasons.map((r, i) => <span key={i} className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", REASON_TONE[r.tone])}>{r.t}</span>)}
      </div>
    );
  }

  /* ---------- KPI card ---------- */
  function Kpi({ label, value, tone = "neutral", sub }) {
    const toneMap = { neutral: "text-foreground", danger: "text-destructive", warning: "text-accent-amber", success: "text-accent-green", brand: "text-brand" };
    return (
      <div className="rounded-xl border border-border bg-surface-elevated px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums leading-none", toneMap[tone])}>{value}</p>
        {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    );
  }

  /* ---------- Priority item (hero block) ---------- */
  function PriorityItem({ r, idx, toggle, updateTask, canEdit, myName, execKey, onExec, approve, canApprove }) {
    const isExec = execKey === `${r.origin}-${r.id}`;
    const inReview = r.status === "blocked";
    return (
      <div className={cn("flex items-start gap-3 rounded-xl border bg-surface-elevated p-3 transition-colors", isExec ? "border-brand/50 ring-1 ring-brand/25" : "border-border hover:border-foreground/20")}>
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">{idx}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold leading-snug text-foreground">{r.title || "—"}</p>
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", ST_TONE[r.status])}>{ST_LABEL[r.status]}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            {r.campaignTitle ? <a href={`#/brief/${r.slug}`} className="text-brand hover:underline">{r.campaignTitle}</a> : <span>{r.source || "Operativa diaria"}</span>}
            {r.deadlineDate && <><span className="text-border">·</span><span className={cn(r.overdue && "text-destructive", r.daysLeft === 0 && "text-accent-amber")}>{fmtShort(r.deadlineDate)}</span></>}
            {r.estimateMin && <><span className="text-border">·</span><span className="inline-flex items-center gap-0.5"><LucideIcon name="Timer" className="h-3 w-3" />~{r.estimateMin} min</span></>}
            {r.createdBy && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", r.createdBy === myName ? "bg-brand/10 text-brand" : "bg-surface text-muted-foreground")}>
                {r.createdBy === myName ? "Generado por mí" : `Generado por ${r.createdBy}`}
              </span>
            )}
          </p>
          <div className="mt-1.5"><ReasonPills reasons={r.reasons} /></div>
          {canEdit && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isExec ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand"></span> En ejecución
                </span>
              ) : inReview ? (
                canApprove ? (
                  <React.Fragment>
                    <button type="button" onClick={() => approve(r)}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-green px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-accent-green/90">
                      <LucideIcon name="Check" className="h-3 w-3" strokeWidth={2.4} /> Aprobar
                    </button>
                    <button type="button" onClick={() => updateTask(r, { status: "in_progress" })}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
                      <LucideIcon name="CornerUpLeft" className="h-3 w-3" /> Devolver
                    </button>
                  </React.Fragment>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-amber/15 px-2.5 py-1 text-[11px] font-semibold text-accent-amber">
                    <LucideIcon name="Hourglass" className="h-3 w-3" /> Esperando aprobación
                  </span>
                )
              ) : (
                <React.Fragment>
                  <button type="button" onClick={() => onExec(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90">
                    <LucideIcon name="Play" className="h-3 w-3" /> Poner en ejecución
                  </button>
                  <button type="button" onClick={() => toggle(r)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
                    <LucideIcon name="Check" className="h-3 w-3" /> {canApprove ? "Completar" : "Marcar terminada"}
                  </button>
                </React.Fragment>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Item de pedido de DISEÑO dentro de Mis pendientes ----------
     Mezclado con las tareas normales, pero con las acciones reales del flujo
     de diseño: iniciar (→ en diseño), entregar (con enlace/nota), y atajo al
     módulo para revisión completa. "Iniciar" mueve el pedido a En diseño. */
  function DesignItem({ r, idx, canEdit, myName }) {
    const d = r._dr;
    const [delivering, setDelivering] = useState(false);
    const [note, setNote] = useState("");
    const [link, setLink] = useState("");
    const STATUS_META = {
      pending: { label: "Solicitado", tone: "bg-muted text-muted-foreground" },
      in_design: { label: "En diseño", tone: "bg-accent-violet/10 text-accent-violet" },
      delivered: { label: "Entregado", tone: "bg-brand/10 text-brand" },
      in_review: { label: "En revisión", tone: "bg-accent-amber/15 text-accent-amber" },
      feedback: { label: "Con feedback", tone: "bg-destructive/10 text-destructive" },
      approved: { label: "Aprobado", tone: "bg-accent-green/10 text-accent-green" },
    };
    const m = STATUS_META[d.status] || STATUS_META.pending;
    const start = () => { S.mutateDR ? S.setDRStatus(d.id, "in_design") : null; if (window.toast) window.toast("Diseño iniciado — en diseño"); };
    const submit = () => {
      if (!note.trim() && !link.trim()) { if (window.toast) window.toast("Agrega una nota o enlace"); return; }
      S.addDRDelivery(d.id, { note, links: link.trim() ? [link.trim()] : [] });
      setNote(""); setLink(""); setDelivering(false);
      if (window.toast) window.toast("Entrega registrada · en revisión");
    };
    const lastFeedback = (d.reviews || []).filter((v) => v.verdict === "feedback").slice(-1)[0];
    const canDeliver = d.status === "in_design" || d.status === "feedback" || d.status === "pending";
    return (
      <div className="flex items-start gap-3 rounded-xl border border-accent-pink/30 bg-accent-pink/[0.03] p-3 transition-colors hover:border-accent-pink/50">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-pink text-[11px] font-semibold text-white">{idx}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold leading-snug text-foreground">{r.title}</p>
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", m.tone)}>{m.label}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-pink/10 px-1.5 py-0.5 font-medium text-accent-pink"><LucideIcon name="Palette" className="h-3 w-3" /> Diseño</span>
            {typeof d.num === "number" && <span className="font-mono">#{d.num}</span>}
            {r.deadlineDate && <><span className="text-border">·</span><span className={cn(r.overdue && "text-destructive", r.daysLeft === 0 && "text-accent-amber")}>{fmtShort(r.deadlineDate)}</span></>}
            {d.requester && <><span className="text-border">·</span><span>pidió {d.requester}</span></>}
          </p>

          {lastFeedback && d.status === "feedback" && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
              <LucideIcon name="MessageSquareWarning" className="mt-0.5 h-3 w-3 shrink-0" />
              <span><span className="font-semibold">Feedback:</span> {lastFeedback.comment || "Requiere ajustes"}</span>
            </p>
          )}

          {canEdit && !delivering && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(d.status === "pending") && (
                <button type="button" onClick={start}
                  className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90">
                  <LucideIcon name="Play" className="h-3 w-3" /> Iniciar diseño
                </button>
              )}
              {canDeliver && (
                <button type="button" onClick={() => setDelivering(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-pink px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-accent-pink/90">
                  <LucideIcon name="Upload" className="h-3 w-3" /> {d.status === "feedback" ? "Reenviar entrega" : "Entregar"}
                </button>
              )}
              {(d.status === "delivered" || d.status === "in_review") && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-amber/15 px-2.5 py-1 text-[11px] font-semibold text-accent-amber">
                  <LucideIcon name="Hourglass" className="h-3 w-3" /> Esperando revisión
                </span>
              )}
              <a href="#/operativa/solicitudes" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
                <LucideIcon name="ExternalLink" className="h-3 w-3" /> Ver pedido
              </a>
            </div>
          )}

          {canEdit && delivering && (
            <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface-elevated p-2.5">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Nota de entrega: qué incluye esta versión…"
                className="w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Enlace (Drive, Figma…) — opcional"
                className="h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setDelivering(false); setNote(""); setLink(""); }} className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface">Cancelar</button>
                <button type="button" onClick={submit} className="inline-flex items-center gap-1 rounded-full bg-accent-pink px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-accent-pink/90"><LucideIcon name="Upload" className="h-3 w-3" /> Registrar entrega</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Risk / list mini-row ---------- */
  function MiniRow({ r, right, sub }) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIO_DOT[r.priority || "med"])} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-foreground" title={r.title}>{r.title || "—"}</p>
          <p className="truncate text-[10px] text-muted-foreground">{sub || (r.campaignTitle || r.source || "Operativa diaria")}</p>
        </div>
        {right && <span className="shrink-0 whitespace-nowrap text-[10px] font-medium tabular-nums">{right}</span>}
      </div>
    );
  }

  function RiskBlock({ icon, title, tone, items, render, empty }) {
    const toneCls = { red: "text-destructive", amber: "text-accent-amber", violet: "text-accent-violet" }[tone] || "text-foreground";
    return (
      <div className="rounded-xl border border-border bg-surface-elevated">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <LucideIcon name={icon} className={cn("h-3.5 w-3.5", toneCls)} />
          <span className="text-[12px] font-semibold text-foreground">{title}</span>
          <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", items.length ? "bg-surface text-foreground" : "bg-surface text-muted-foreground")}>{items.length}</span>
        </div>
        <div className="space-y-0.5 p-1.5">
          {items.length === 0 ? <p className="px-2 py-2.5 text-center text-[11px] text-muted-foreground">{empty}</p> : items.map(render)}
        </div>
      </div>
    );
  }

  /* ================= main ================= */
  function MisPendientes({ rows, toggle, updateTask, approve, reject, removeRow, canDelete, canApprove, addUpdate, period }) {
    const members = S.useMembers();
    const canEdit = S.useCan("editTasks");
    const session = S.useSession ? S.useSession() : null;
    const gp = S.useGeneralPendings();
    const active = members.filter((m) => m.status === "active");
    const myName = session && session.name;
    const [roleKey] = S.useCurrentRole();
    const isAdmin = roleKey === "admin";
    const [person, setPerson] = useState(() => {
      if (myName && members.some((m) => m.name === myName)) return myName;
      return active[0] ? active[0].name : "";
    });
    /* Privacidad operativa: quien no es admin solo ve SUS pendientes.
       Si la sesión cambia (o llega tarde por el auto-login), realinear. */
    useEffect(() => {
      if (!isAdmin && myName && person !== myName) setPerson(myName);
    }, [isAdmin, myName, person]);

    /* ---------- modo ejecución ---------- */
    const ET = useExecTimer();
    const [execTarget, setExecTarget] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [tracking, setTracking] = useState(null); // tracking del pendiente (BUG-A25A)
    const execKey = ET.exec ? `${ET.exec.origin}-${ET.exec.taskId}` : null;
    const startExec = (r, min) => {
      if (r.status !== "in_progress") updateTask(r, { status: "in_progress" });
      ET.start({ taskId: r.id, origin: r.origin, slug: r.slug || null, title: r.title, owner: r.owner || person, startedAt: Date.now(), endsAt: Date.now() + min * 60000, totalMin: min });
      setExecTarget(null);
    };
    const findExecRow = () => ET.exec ? rows.find((x) => x.id === ET.exec.taskId && x.origin === ET.exec.origin) : null;
    const finishExec = () => { const row = findExecRow(); if (row && row.status !== "done") toggle(row); ET.clear(); };

    /* ---------- alta rápida de pendientes propios ----------
       Campaña y periodo opcionales: sin periodo = punto puntual, del momento. */
    const [nTitle, setNTitle] = useState("");
    const [nDate, setNDate] = useState("");
    const [nEst, setNEst] = useState("");
    const [nPrio, setNPrio] = useState("med");
    const [nCamp, setNCamp] = useState("");
    const [nPer, setNPer] = useState("");
    const [nSrc, setNSrc] = useState("");
    const nOrigins = S.usePendingOrigins();
    S.useAvailablePeriods();
    const allPeriods = S.listAvailablePeriods();
    const addPending = (e) => {
      e.preventDefault();
      const title = nTitle.trim();
      if (!title) return;
      gp.add({ title, owner: person, deadline: nDate || "", priority: nPrio, estimateMin: nEst ? Number(nEst) : undefined, period: nPer || undefined, campaignSlug: nCamp || undefined, source: nSrc || undefined, createdBy: myName || person });
      setNTitle(""); setNDate(""); setNEst(""); setNPrio("med"); setNCamp(""); setNPer(""); setNSrc("");
      if (window.toast) window.toast(nPer ? "Pendiente añadido a tu lista" : "Pendiente puntual añadido (sin periodo)");
    };

    /* Pedidos de diseño asignados a la persona, como filas-pendiente mezcladas
       con sus tareas normales. origin "design" → se renderizan con DesignItem y
       sus acciones reales (iniciar, entregar, revisar) van contra la API DR. */
    const designReqs = S.useDesignRequests ? S.useDesignRequests() : [];
    const DR_TO_TASK = { pending: "todo", in_design: "in_progress", delivered: "blocked", in_review: "blocked", feedback: "in_progress", approved: "done", cancelled: "done" };
    const myDesigns = useMemo(() => designReqs
      .filter((d) => d.designer === person && d.status !== "cancelled")
      .map((d) => enrich({
        id: d.id, origin: "design", slug: null, title: d.title || "(diseño sin título)",
        owner: d.designer, status: DR_TO_TASK[d.status] || "todo",
        priority: d.priority || "med", deadline: d.deadline || "",
        source: `Diseño · ${d.type || "pedido"}`, createdBy: d.requester,
        _dr: d, daysLeft: drDaysLeft(d.deadline), overdue: drOverdue(d.deadline, d.status),
      })), [designReqs, person]);

    const mine = useMemo(() => [
      ...rows.filter((r) => (r.owner || "").trim() === person).map(enrich),
      ...myDesigns,
    ], [rows, person, myDesigns]);
    const open = mine.filter((r) => r.status !== "done");
    const done = mine.filter((r) => r.status === "done");

    const k = useMemo(() => {
      const overdue = open.filter((r) => r.overdue).length;
      const todayC = open.filter((r) => r.daysLeft === 0).length;
      const critical = open.filter((r) => r.group === "critical").length;
      const upcoming = open.filter((r) => r.upcoming && r.daysLeft !== 0).length;
      const blocked = open.filter((r) => r.status === "blocked").length;
      const stale = open.filter((r) => r.stale).length;
      const total = mine.length;
      const percent = total ? Math.round((done.length / total) * 100) : 0;
      return { overdue, today: todayC, critical, upcoming, blocked, stale, active: open.length, done: done.length, total, percent };
    }, [mine]);

    const health = k.overdue > 0
      ? { label: "Riesgo de atraso", dot: "bg-destructive", cls: "border-destructive/30 bg-destructive/5 text-destructive", icon: "AlertTriangle" }
      : k.today > 0 || k.critical > 0
        ? { label: "Requiere atención", dot: "bg-accent-amber", cls: "border-accent-amber/30 bg-accent-amber/5 text-accent-amber", icon: "Clock" }
        : { label: "Bajo control", dot: "bg-accent-green", cls: "border-accent-green/30 bg-accent-green/5 text-accent-green", icon: "CheckCircle2" };

    const smart = (() => {
      if (k.active === 0) return done.length ? "Todo al día. No tienes pendientes activos." : "No tienes pendientes asignados.";
      const parts = [`Hoy tienes ${k.active} pendiente${k.active === 1 ? "" : "s"} activo${k.active === 1 ? "" : "s"}`];
      if (k.critical) parts.push(`${k.critical} requiere${k.critical === 1 ? "" : "n"} atención inmediata`);
      if (k.overdue) parts.push(`${k.overdue} ${k.overdue === 1 ? "está retrasado" : "están retrasados"}`);
      return parts.join(" · ") + ".";
    })();

    const sortByScore = (a, b) => a.score - b.score || ((a.deadlineDate ? a.deadlineDate.getTime() : Infinity) - (b.deadlineDate ? b.deadlineDate.getTime() : Infinity));
    const critical = open.filter((r) => r.group === "critical").sort(sortByScore);
    const week = open.filter((r) => r.group === "week").sort(sortByScore);
    const later = open.filter((r) => r.group === "later").sort(sortByScore);
    const priorityGroups = [
      { key: "critical", label: "Crítico hoy", dot: "bg-destructive", items: critical },
      { key: "week", label: "Importante esta semana", dot: "bg-accent-amber", items: week },
      { key: "later", label: "Puede programarse", dot: "bg-accent-green", items: later },
    ].filter((g) => g.items.length);

    // Risks
    const overdueList = open.filter((r) => r.overdue).sort(sortByScore);
    const blockedList = open.filter((r) => r.status === "blocked");
    const staleList = open.filter((r) => r.stale && !r.overdue);
    const quickWins = open.filter((r) => r.priority === "low" && r.status !== "blocked" && !r.overdue).slice(0, 6);

    // Tracking table
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const QUICK = [
      { key: "all", label: "Todos" }, { key: "today", label: "Hoy" }, { key: "week", label: "Esta semana" },
      { key: "overdue", label: "Retrasados" }, { key: "critical", label: "Críticos" },
      { key: "blocked", label: "En revisión" }, { key: "stale", label: "Sin avances" }, { key: "done", label: "Completados" },
    ];
    const tableRows = useMemo(() => {
      const q = query.trim().toLowerCase();
      return mine.filter((r) => {
        if (filter === "today" && !(r.daysLeft === 0 && r.status !== "done")) return false;
        if (filter === "week" && !(r.upcoming && r.status !== "done")) return false;
        if (filter === "overdue" && !r.overdue) return false;
        if (filter === "critical" && r.group !== "critical") return false;
        if (filter === "blocked" && r.status !== "blocked") return false;
        if (filter === "stale" && !r.stale) return false;
        if (filter === "done" && r.status !== "done") return false;
        if (filter === "all" && r.status === "done") return false;
        if (q && !(r.title || "").toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || sortByScore(a, b));
    }, [mine, filter, query]);

    return (
      <div className="space-y-4">
        {/* Cronómetro activo */}
        {ET.exec && <ExecBar exec={ET.exec} now={ET.now} onExtend={ET.extend} onPause={ET.pause} onResume={ET.resume} onStop={ET.clear} onFinish={finishExec} />}
        {execTarget && <ExecModal r={execTarget} onClose={() => setExecTarget(null)} onStart={(min) => startExec(execTarget, min)} />}

        {/* Header */}
        <div className="rounded-2xl border border-border bg-surface-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {window.Avatar
                ? <window.Avatar name={person} className="h-11 w-11 text-base" />
                : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base font-semibold text-brand">{(person || "?").trim().slice(0, 1).toUpperCase()}</span>}
              <div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <select value={person} onChange={(e) => setPerson(e.target.value)}
                      className="cursor-pointer rounded-md border-0 bg-transparent p-0 text-lg font-semibold text-foreground focus-visible:outline-none">
                      {active.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                      {!active.some((m) => m.name === person) && person && <option value={person}>{person}</option>}
                    </select>
                  ) : (
                    <span className="text-lg font-semibold text-foreground">{person || "—"}</span>
                  )}
                  {myName === person && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">Tú</span>}
                  {isAdmin && myName !== person && <span className="rounded-full bg-accent-amber/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-amber" title="Estás viendo los pendientes de otra persona (vista de administrador)">Vista admin</span>}
                </div>
                <p className="text-[11px] text-muted-foreground">{(active.find((m) => m.name === person) || {}).cargo || "Analista"}</p>
              </div>
            </div>
            <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", health.cls)}>
              <span className={cn("h-2 w-2 rounded-full", health.dot)} /> {health.label}
            </div>
          </div>
          <p className="mt-3 text-[13px] text-foreground">{smart}</p>
        </div>

        {/* Alta rápida: cada miembro registra sus propios pendientes */}
        {canEdit && (
          <form onSubmit={addPending} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-elevated p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <LucideIcon name="Plus" className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <Input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder={`¿Qué tienes pendiente${person ? `, ${person.split(" ")[0]}` : ""}?`}
              className="!h-9 !rounded-full min-w-[160px] flex-1 bg-surface px-3.5 text-[13px]" />
            <DatePicker value={nDate} onChange={(v) => setNDate(v)} placeholder="Fecha compromiso" align="start"
              className="!h-9 !rounded-full w-[138px] bg-surface px-3 text-[12px]" />
            <select value={nEst} onChange={(e) => setNEst(e.target.value)} title="Tiempo estimado"
              className="h-9 cursor-pointer rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-foreground focus-visible:outline-none">
              <option value="">Sin estimado</option>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>~{m} min</option>)}
            </select>
            <select value={nPrio} onChange={(e) => setNPrio(e.target.value)} title="Prioridad"
              className="h-9 cursor-pointer rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-foreground focus-visible:outline-none">
              <option value="high">Alta</option><option value="med">Media</option><option value="low">Baja</option>
            </select>
            <select value={nSrc} onChange={(e) => setNSrc(e.target.value)} title="Origen del pendiente (Comité, Daily, …)"
              className="h-9 cursor-pointer rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-muted-foreground focus-visible:outline-none">
              <option value="">Origen…</option>
              {nOrigins.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={nCamp} onChange={(e) => setNCamp(e.target.value)} title="Campaña (opcional)"
              className="h-9 cursor-pointer rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-muted-foreground focus-visible:outline-none">
              <option value="">Sin campaña</option>
              {S.campaigns.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
            </select>
            <select value={nPer} onChange={(e) => setNPer(e.target.value)} title="Periodo (opcional) — sin periodo = puntual, del momento"
              className="h-9 cursor-pointer rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-muted-foreground focus-visible:outline-none">
              <option value="">Sin periodo · puntual</option>
              {allPeriods.map((p) => <option key={p} value={p}>{S.formatPeriodLabel(p)}</option>)}
            </select>
            <button type="submit" disabled={!nTitle.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-40">
              Añadir
            </button>
          </form>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Activos" value={k.active} tone="brand" />
          <Kpi label="Críticos" value={k.critical} tone={k.critical ? "warning" : "neutral"} />
          <Kpi label="Retrasados" value={k.overdue} tone={k.overdue ? "danger" : "neutral"} />
          <Kpi label="Próx. a vencer" value={k.upcoming} tone={k.upcoming ? "warning" : "neutral"} sub="≤ 7 días" />
          <Kpi label="En revisión" value={k.blocked} tone={k.blocked ? "warning" : "neutral"} />
          <Kpi label="Cumplimiento" value={k.percent + "%"} tone="success" sub={`${k.done}/${k.total} cerrados`} />
        </div>

        {/* Tu día: Prioridades + Organizador lado a lado — misma función, mismo lugar (BUG-E7A7) */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <LucideIcon name="Target" className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Prioridades de hoy</h2>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">orden sugerido · planifícalas en el horario de al lado →</span>
            </div>
            {priorityGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-elevated/60 p-6 text-center text-xs text-muted-foreground">Sin pendientes abiertos. Buen trabajo.</div>
            ) : (
              <div className="space-y-3">
                {priorityGroups.map((g) => {
                  let n = 0;
                  return (
                    <div key={g.key}>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", g.dot)} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</span>
                        <span className="text-[11px] text-muted-foreground">· {g.items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {g.items.slice(0, g.key === "later" ? 3 : 6).map((r) => (
                          r.origin === "design"
                            ? <DesignItem key={`design-${r.id}`} r={r} idx={++n} canEdit={canEdit} myName={myName} />
                            : <PriorityItem key={`${r.origin}-${r.slug}-${r.id}`} r={r} idx={++n} toggle={toggle} updateTask={updateTask} canEdit={canEdit} myName={myName} execKey={execKey} onExec={setExecTarget} approve={approve} canApprove={canApprove} />
                        ))}
                        {g.items.length > (g.key === "later" ? 3 : 6) && <p className="px-1 text-[10px] text-muted-foreground">+{g.items.length - (g.key === "later" ? 3 : 6)} más en la tabla</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            {window.DayPlanner && <window.DayPlanner tasks={mine} person={person} canEdit={canEdit} onExec={setExecTarget} execKey={execKey} embedded />}
          </div>
        </div>

        {/* Riesgos en su propia fila */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RiskBlock icon="AlertTriangle" title="Retrasados" tone="red" items={overdueList} empty="Nada retrasado."
            render={(r) => <MiniRow key={`o-${r.id}`} r={r} right={<span className="text-destructive">{Math.abs(r.daysLeft)}d</span>} />} />
          <RiskBlock icon="Hourglass" title={canApprove ? "En revisión — por aprobar" : "En revisión"} tone="amber" items={blockedList} empty="Nada en revisión."
            render={(r) => <MiniRow key={`b-${r.id}`} r={r} sub={r.createdBy ? `Marcada por ${r.createdBy}` : "Esperando aprobación"} right={canApprove ? <button type="button" onClick={() => approve(r)} className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] font-bold text-accent-green hover:bg-accent-green hover:text-white">Aprobar</button> : <span className="text-accent-amber">en revisión</span>} />} />
          <RiskBlock icon="Activity" title="Sin avances" tone="amber" items={staleList} empty="Todo con seguimiento."
            render={(r) => <MiniRow key={`s-${r.id}`} r={r} right={<span className="text-accent-amber">{r.staleDays}d</span>} />} />
          <RiskBlock icon="Zap" title="Quick wins" tone="amber" items={quickWins} empty="Sin tareas rápidas."
            render={(r) => <MiniRow key={`q-${r.id}`} r={r} right={canEdit ? <button type="button" onClick={() => toggle(r)} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">Cerrar</button> : null} />} />
        </div>

        {/* Tracking table */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LucideIcon name="ListChecks" className="h-4 w-4 text-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Seguimiento</h2>
            </div>
            <div className="relative">
              <LucideIcon name="Search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="h-7 w-44 pl-7 text-xs" />
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {QUICK.map((q) => (
              <button key={q.key} type="button" onClick={() => setFilter(q.key)}
                className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", filter === q.key ? "border-foreground bg-foreground text-background" : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground")}>
                {q.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-2 py-2 text-left font-medium">Tarea</th>
                  <th className="px-2 py-2 text-left font-medium">Campaña</th>
                  <th className="px-2 py-2 text-left font-medium">Origen</th>
                  <th className="px-2 py-2 text-left font-medium">Estado</th>
                  <th className="px-2 py-2 text-left font-medium">Prio</th>
                  <th className="px-2 py-2 text-left font-medium">Deadline</th>
                  <th className="px-2 py-2 text-left font-medium">Track</th>
                  <th className="px-2 py-2 text-left font-medium">Restante</th>
                  <th className="px-2 py-2 text-left font-medium">Último update</th>
                  <th className="w-9 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 && <tr><td colSpan={11} className="px-2 py-8 text-center text-xs text-muted-foreground">Sin pendientes para este filtro.</td></tr>}
                {tableRows.map((r) => (
                  <tr key={`${r.origin}-${r.slug}-${r.id}`} className="border-t border-border/60 align-top hover:bg-surface/50">
                    <td className="px-2 py-1.5">{r.origin === "design"
                      ? <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-accent-pink/10 text-accent-pink" title="Pedido de diseño"><LucideIcon name="Palette" className="h-2.5 w-2.5" /></span>
                      : <Checkbox checked={r.status === "done"} onCheckedChange={() => canEdit && toggle(r)} className={cn("mt-0.5", !canEdit && "opacity-60")} />}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-start gap-1">
                        {canEdit && r.origin !== "design" ? (
                          <input defaultValue={r.title || ""} key={`${r.origin}-${r.id}-t`} onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== r.title) updateTask(r, { title: t }); }}
                            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} title={r.title}
                            className={cn("min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] font-medium outline-none focus:rounded focus:bg-surface focus:px-1", r.status === "done" && "text-muted-foreground line-through")} />
                        ) : (
                          <p className={cn("max-w-[240px] truncate text-[12px] font-medium", r.status === "done" && "text-muted-foreground line-through")} title={r.title}>{r.title || "—"}</p>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {r.estimateMin ? `~${r.estimateMin} min` : ""}
                        {r.createdBy && <span className={cn(r.createdBy === myName ? "text-brand" : "")}>{r.estimateMin ? " · " : ""}{r.createdBy === myName ? "Generado por mí" : `Generado por ${r.createdBy}`}</span>}
                      </p>
                    </td>
                    <td className="px-2 py-1.5">
                      {r.campaignTitle
                        ? <a href={`#/brief/${r.slug}${r.period ? `?p=${r.period}` : ""}`} className="text-[11px] font-medium text-brand hover:underline">{r.campaignTitle}</a>
                        : <span className="text-[11px] text-muted-foreground">{r.origin === "design" ? "Diseño" : "—"}</span>}
                    </td>
                    <td className="px-2 py-1.5"><span className="text-[11px] text-muted-foreground">{r.origin === "campaign" ? "Operativa" : r.origin === "design" ? (r._dr && r._dr.type) || "Diseño" : (r.source || "—")}</span></td>
                    <td className="px-2 py-1.5">
                      {r.origin === "design" ? (
                        <a href="#/operativa/solicitudes" className="inline-flex items-center gap-1 rounded-full bg-accent-pink/10 px-2 py-0.5 text-[10px] font-semibold text-accent-pink hover:bg-accent-pink/20">
                          {ST_LABEL[r.status] || r.status} <LucideIcon name="ExternalLink" className="h-2.5 w-2.5" />
                        </a>
                      ) : canEdit ? (
                        <div className="flex items-center gap-1">
                          <select value={r.status} onChange={(e) => updateTask(r, { status: e.target.value })} className={cn("h-6 cursor-pointer rounded border-0 px-1 text-[10px] font-medium", ST_TONE[r.status])}>
                            {(canApprove ? ["todo", "in_progress", "blocked", "done"] : ["todo", "in_progress", "blocked"]).map((s) => <option key={s} value={s}>{ST_LABEL[s]}</option>)}
                            {!canApprove && r.status === "done" && <option value="done">{ST_LABEL.done}</option>}
                          </select>
                          {r.status === "blocked" && canApprove && (
                            <button type="button" title="Aprobar" onClick={() => approve(r)} className="shrink-0 rounded-full bg-accent-green/15 px-1.5 py-0.5 text-[9px] font-bold text-accent-green transition-colors hover:bg-accent-green hover:text-white">Aprobar</button>
                          )}
                        </div>
                      ) : <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", ST_TONE[r.status])}>{ST_LABEL[r.status]}</span>}
                    </td>
                    <td className="px-2 py-1.5"><span className="inline-flex items-center gap-1 text-[11px]"><span className={cn("h-1.5 w-1.5 rounded-full", PRIO_DOT[r.priority || "med"])} />{PRIO_LABEL[r.priority || "med"]}</span></td>
                    <td className="px-2 py-1.5 text-[11px] tabular-nums text-muted-foreground">{fmtShort(r.deadlineDate)}</td>
                    <td className="px-2 py-1.5">
                      <button type="button" title="Ver trazabilidad del pendiente" onClick={() => setTracking(r)}
                        className="relative inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand">
                        <LucideIcon name="History" className="h-3.5 w-3.5" />
                        {(r.updates || []).length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-brand px-0.5 text-[7px] font-bold text-white">{(r.updates || []).length}</span>}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-[11px] tabular-nums">
                      {r.daysLeft == null ? <span className="text-muted-foreground">—</span>
                        : r.status === "done" ? <span className="text-accent-green">ok</span>
                          : r.overdue ? <span className="font-medium text-destructive">{Math.abs(r.daysLeft)}d atraso</span>
                            : r.daysLeft === 0 ? <span className="font-medium text-accent-amber">Hoy</span>
                              : <span className={cn(r.daysLeft <= 7 ? "text-accent-amber" : "text-muted-foreground")}>{r.daysLeft}d</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {lastUpdateText(r) ? (
                        <span className="block max-w-[150px] truncate text-[11px] text-muted-foreground" title={lastUpdateText(r)}>
                          <span className="text-foreground/70">{relTime(lastUpdateTs(r))}</span> · {lastUpdateText(r)}
                        </span>
                      ) : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {canEdit && r.status !== "done" && execKey === `${r.origin}-${r.id}` && (
                        <span className="flex h-7 w-7 items-center justify-center" title="En ejecución">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-brand"></span>
                        </span>
                      )}
                      {canDelete && removeRow && r.origin !== "design" && (
                        <button type="button" title="Eliminar tarea" onClick={() => setDeleting(r)}
                          className="ml-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {tracking && window.TaskTrackingModal && <window.TaskTrackingModal row={(rows.find((x) => x.id === tracking.id && x.origin === tracking.origin) || tracking)} canEdit={true} onAddUpdate={addUpdate || (() => {})} onClose={() => setTracking(null)} />}
        {deleting && window.ConfirmDelete && <window.ConfirmDelete requireClave={false} title="Eliminar tarea" message={`Se eliminará «${deleting.title || "(sin título)"}». Esta acción no se puede deshacer.`} confirmLabel="Eliminar" onClose={() => setDeleting(null)} onConfirm={() => { removeRow(deleting); setDeleting(null); if (window.toast) window.toast("Tarea eliminada"); }} />}
      </div>
    );
  }

  window.MisPendientes = MisPendientes;
})();
