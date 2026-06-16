/* Operations Command Center — KPI strip, table, alert sidebar. Ported from checklist.tsx */
(function () {
  const React = window.React;
  const { useMemo, useState, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Input, Checkbox, toast, DatePicker } = window;
  const cn = window.cn;
  const STATUS_LABEL = window.STATUS_LABEL, STATUS_TONE = window.STATUS_TONE, PRIORITY_LABEL = window.PRIORITY_LABEL, PRIORITY_TONE = window.PRIORITY_TONE;

  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseDeadline = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); if (!y || !m || !d) return null; return new Date(y, m - 1, d); };
  const fmtShort = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";
  const daysDiff = (d) => Math.round((d.getTime() - startOfToday().getTime()) / 86400000);

  /* Agrega tareas de los periodos seleccionados. Los hooks se montan para
     campañas × TODOS los periodos (cantidad estable); la selección solo filtra. */
  /* ============ Tracking de un pendiente: historial + comentarios (BUG-CF91/B7DB) ============
     Similar a la trazabilidad de diseño: muestra el log de updates del pendiente
     y permite agregar comentarios. El rebote y los cambios quedan registrados. */
  function TaskTrackingModal({ row, canEdit, onAddUpdate, onClose }) {
    const ReactDOM = window.ReactDOM;
    const { LucideIcon, Button } = window;
    const cn = window.cn;
    const [text, setText] = React.useState("");
    const updates = [...(row.updates || [])].sort((a, b) => a.ts - b.ts);
    const fmt = (ts) => { try { return new Date(ts).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
    const TYPE_META = {
      comment: { icon: "MessageCircle", tone: "text-brand bg-brand/10", label: "Comentario" },
      status: { icon: "GitBranch", tone: "text-accent-violet bg-accent-violet/10", label: "Cambio de estado" },
      progress: { icon: "TrendingUp", tone: "text-accent-green bg-accent-green/10", label: "Avance" },
      block: { icon: "OctagonX", tone: "text-destructive bg-destructive/10", label: "Bloqueo" },
    };
    const add = () => { const t = text.trim(); if (!t) return; onAddUpdate(row, { type: "comment", text: t }); setText(""); };
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]" role="dialog" aria-label="Tracking del pendiente"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-border bg-surface-elevated shadow-elevated">
          <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><LucideIcon name="History" className="h-3.5 w-3.5" /> Tracking del pendiente</p>
              <h3 className="mt-1 truncate text-[15px] font-semibold text-foreground">{row.title || "(sin título)"}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{row.owner ? `Responsable: ${row.owner}` : "Sin responsable"}{row._c ? ` · ${row._c}` : ""}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="X" className="h-4 w-4" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {updates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-surface/40 px-3 py-8 text-center text-[12px] text-muted-foreground">Sin movimientos todavía. Los comentarios y rebotes aparecerán aquí.</p>
            ) : (
              <ol className="relative space-y-3.5 pl-6">
                <span className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
                {updates.map((u) => {
                  const m = TYPE_META[u.type] || TYPE_META.comment;
                  const rebote = (u.text || "").startsWith("Entrega rebotada:");
                  const meta = rebote ? { icon: "Undo2", tone: "text-destructive bg-destructive/10", label: "Entrega rebotada" } : m;
                  return (
                    <li key={u.id} className="relative">
                      <span className={cn("absolute -left-6 top-0 flex h-[19px] w-[19px] items-center justify-center rounded-full ring-2 ring-surface-elevated", meta.tone)}>
                        <LucideIcon name={meta.icon} className="h-2.5 w-2.5" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[12px] font-semibold text-foreground">{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground">{fmt(u.ts)}</span>
                      </div>
                      {u.text && <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/90">{rebote ? u.text.replace("Entrega rebotada:", "").trim() : u.text}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/80">por {u.user || "—"}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {canEdit && (
            <div className="border-t border-border/60 px-5 py-3">
              <div className="flex items-end gap-2">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Agregar un comentario al tracking…"
                  className="flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Button size="sm" onClick={add} disabled={!text.trim()} className="h-9 gap-1.5"><LucideIcon name="Send" className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  window.TaskTrackingModal = TaskTrackingModal;

  function useAllTasks(selPeriods) {
    const camps = React.useRef(S.campaigns.slice()).current;
    S.useAvailablePeriods();
    const allPeriods = S.listAvailablePeriods();
    const perCampaign = [];
    camps.forEach((c) => allPeriods.forEach((p) => perCampaign.push({ c, p, cl: S.useOperativeChecklist(c.slug, p) })));
    const gp = S.useGeneralPendings();
    const canApprove = S.useCan("approveTasks");
    const multi = selPeriods.length > 1;

    const campaignRows = useMemo(() =>
      perCampaign.filter(({ c, p }) => selPeriods.includes(p) && S.isCampaignConfigured(c.slug, p))
        .flatMap(({ c, p, cl }) => cl.tasks.map((t) => ({ ...t, origin: "campaign", slug: c.slug, campaignTitle: multi ? `${c.title} · ${S.formatPeriodLabel(p)}` : c.title, period: p }))),
      [JSON.stringify(perCampaign.map((x) => x.cl.tasks)), selPeriods.join(","), multi]);

    // General pendings relevant to selected periods (period-less ones are always shown).
    const generalRows = useMemo(() =>
      gp.items.filter((i) => !i.period || selPeriods.includes(i.period)).map((i) => {
        const camp = camps.find((c) => c.slug === i.campaignSlug);
        return { ...i, origin: "general", slug: i.campaignSlug || null, campaignTitle: camp ? camp.title : null };
      }),
      [JSON.stringify(gp.items), selPeriods.join(",")]);

    const rawRows = useMemo(() => [...campaignRows, ...generalRows], [campaignRows, generalRows]);

    const setStatusFor = (row, status) => {
      if (row.origin === "design") return; // los diseños se gestionan en su propio item
      if (row.origin === "general") { gp.update(row.id, { status }); return; }
      const e = perCampaign.find((x) => x.c.slug === row.slug && x.p === row.period); if (e) e.cl.update(row.id, { status });
    };
    /* Flujo de aprobación: al "completar", un miembro envía a EN REVISIÓN;
       solo quien tenga approveTasks (admin) puede dejarla en COMPLETADO. */
    const toggle = (row) => {
      const st = row.status || (row.done ? "done" : "todo");
      if (st === "done") setStatusFor(row, "todo");
      else if (st === "blocked") setStatusFor(row, canApprove ? "done" : "in_progress");
      else setStatusFor(row, canApprove ? "done" : "blocked");
    };
    const approve = (row) => setStatusFor(row, "done");
    /* Rebotar una entrega: vuelve a "En curso", deja el comentario de revisión
       en el timeline de la tarea y notifica al responsable. */
    const reject = (row, comment) => {
      const text = (comment || "").trim();
      const patch = { status: "in_progress", done: false };
      if (text) patch.updates = [...(row.updates || []), { id: S.uuid(), ts: Date.now(), user: S.currentUserName() || "", type: "comment", text: `Entrega rebotada: ${text}` }];
      if (row.origin === "general") { gp.update(row.id, patch); }
      else { const e = perCampaign.find((x) => x.c.slug === row.slug && x.p === row.period); if (e) e.cl.update(row.id, patch); }
      if (row.owner) S.notify({ to: row.owner, type: "task", title: "Entrega rebotada — requiere ajustes", detail: (text || row.title || "").slice(0, 160), href: row.slug ? `#/brief/${row.slug}?p=${row.period}` : "#/operativa/pendiente" });
    };
    const updateTask = (row, patch) => {
      if (row.origin === "design") return; // gestionado por DesignItem
      if (patch.owner && patch.owner !== row.owner) {
        S.notify({ to: patch.owner, type: "task", title: "Te asignaron una tarea", detail: row.title || "Tarea", href: row.slug ? `#/brief/${row.slug}?p=${row.period}` : "#/operativa/pendiente" });
      }
      if (row.origin === "general") { gp.update(row.id, patch); return; }
      const e = perCampaign.find((x) => x.c.slug === row.slug && x.p === row.period); if (e) e.cl.update(row.id, patch);
    };
    const addUpdate = (row, upd) => {
      const entry = { id: S.uuid(), ts: Date.now(), user: S.currentUserName() || "", type: upd.type || "comment", text: (upd.text || "").trim() };
      const patch = { updates: [...(row.updates || []), entry] };
      if (row.origin === "general") { gp.update(row.id, patch); }
      else { const e = perCampaign.find((x) => x.c.slug === row.slug && x.p === row.period); if (e) e.cl.update(row.id, patch); }
    };
    /* Eliminar una tarea: pendiente general o tarea de campaña. Los diseños no
       se borran desde aquí (su ciclo vive en el módulo de solicitudes). */
    const removeRow = (row) => {
      if (row.origin === "design") return;
      if (row.origin === "general") { gp.remove(row.id); return; }
      const e = perCampaign.find((x) => x.c.slug === row.slug && x.p === row.period); if (e) e.cl.remove(row.id);
    };
    return { rawRows, toggle, updateTask, approve, reject, addUpdate, removeRow, canApprove };
  }

  /* ============ Modal de rebote de entrega (comentario de revisión) ============ */
  function RejectModal({ row, onConfirm, onClose }) {
    const { LucideIcon, Button } = window;
    const [comment, setComment] = React.useState("");
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]" role="dialog" aria-label="Rebotar entrega"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><LucideIcon name="Undo2" className="h-5 w-5" strokeWidth={1.9} /></span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">Rebotar entrega</h3>
              <p className="mt-0.5 truncate text-[12.5px] font-medium text-muted-foreground">{row.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">La tarea vuelve a <span className="font-medium text-foreground">En curso</span>{row.owner ? ` y ${row.owner} recibirá una notificación con tu comentario` : ""}.</p>
            </div>
          </div>
          <label className="mt-3.5 block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Comentario de revisión</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} autoFocus
              placeholder="¿Qué hay que corregir o ajustar?"
              className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => onConfirm(comment)} className="gap-1.5 bg-destructive text-white hover:bg-destructive/90">
              <LucideIcon name="Undo2" className="h-3.5 w-3.5" /> Rebotar entrega
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const ORIGIN = {
    campaign: { label: "Operativa", icon: "ClipboardCheck", cls: "bg-brand/10 text-brand" },
    general: { label: "Pendiente", icon: "Inbox", cls: "bg-accent-violet/10 text-accent-violet" },
  };

  function Kpi({ label, value, tone = "neutral", hint, active, onClick }) {
    const toneMap = { neutral: "text-foreground", danger: "text-destructive", warning: "text-accent-amber", success: "text-accent-green" };
    const Comp = onClick ? "button" : "div";
    return (
      <Comp onClick={onClick} className={cn("flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors", onClick && "hover:bg-surface", active && "bg-surface ring-1 ring-foreground/15")}>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
          {hint && <span className="text-[9px] text-muted-foreground">{hint}</span>}
        </div>
        <span className={cn("text-base font-semibold tabular-nums", toneMap[tone])}>{value}</span>
      </Comp>
    );
  }

  /* Multi-select filter dropdown with checkboxes + count badge. */
  function MultiSelect({ label, icon, selected, options, onToggle, onClear }) {
    const { Popover } = window;
    const count = selected.length;
    return (
      <Popover width="w-52" trigger={
        <button type="button" className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors", count ? "border-brand/40 bg-brand/5 text-brand" : "border-input bg-transparent text-foreground hover:bg-surface")}>
          {icon && <LucideIcon name={icon} className="h-3 w-3" />}
          {label}
          {count > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">{count}</span>}
          <LucideIcon name="ChevronDown" className="h-3 w-3 opacity-60" />
        </button>
      }>
        <div className="space-y-0.5">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
            {count > 0 && <button type="button" onClick={onClear} className="text-[10px] text-muted-foreground hover:text-foreground">Limpiar</button>}
          </div>
          {options.map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-accent">
              <Checkbox checked={selected.includes(v)} onCheckedChange={() => onToggle(v)} />
              <span className="flex-1 truncate">{l}</span>
            </label>
          ))}
          {options.length === 0 && <p className="px-1.5 py-2 text-[11px] text-muted-foreground">Sin opciones</p>}
        </div>
      </Popover>
    );
  }

  /* Sortable column header — click cycles asc → desc → none.
     Con onResize: muestra un tirador en el borde derecho para ajustar el ancho (BUG-424E). */
  function SortTh({ label, col, sort, setSort, className, onResize }) {
    const active = sort.key === col;
    const dir = active ? sort.dir : null;
    const next = () => setSort(active ? (sort.dir === "asc" ? { key: col, dir: "desc" } : { key: null, dir: null }) : { key: col, dir: "asc" });
    const startResize = (e) => {
      e.preventDefault(); e.stopPropagation();
      const startX = e.clientX;
      const th = e.currentTarget.closest("th");
      const startW = th ? th.offsetWidth : 120;
      const onMove = (ev) => onResize(col, Math.max(60, startW + (ev.clientX - startX)));
      const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    };
    return (
      <th className={cn("relative px-1.5 py-1.5 text-left", className)}>
        <button type="button" onClick={next} className={cn("inline-flex items-center gap-1 font-inherit uppercase tracking-wider transition-colors hover:text-foreground", active ? "text-foreground" : "")}>
          {label}
          <LucideIcon name={dir === "asc" ? "ArrowUp" : dir === "desc" ? "ArrowDown" : "ChevronsUpDown"} className={cn("h-3 w-3", active ? "opacity-100" : "opacity-30")} />
        </button>
        {onResize && <span onMouseDown={startResize} title="Arrastra para ajustar el ancho · doble clic para restablecer"
          onDoubleClick={(e) => { e.stopPropagation(); onResize(col, null); }}
          className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-brand/20"><span className="h-3 w-px bg-border" /></span>}
      </th>
    );
  }

  const STATUS_ORDER = { todo: 0, in_progress: 1, blocked: 2, done: 3 };
  const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };
  const ORIGIN_LABEL = { campaign: "Operativa", general: "Pendiente" };
  const SAVED_VIEWS_KEY = "command-center-views:v1";
  const readViews = () => { try { const v = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const writeViews = (v) => { try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(v)); } catch {} };
  const KPI_LABEL = { overdue: "Atrasadas", today: "Hoy", upcoming: "≤ 7 días", blocked: "En revisión", done: "Hechas" };

  /* ---------- Alertas tempranas: desvío real vs. esperado por campaña ----------
     Predictividad honesta: compara el % de tareas hechas contra el % de tiempo
     transcurrido de la ventana de la campaña (meta sched o fechas del brief).
     Un gap ≥25 pts o atrasos múltiples → "En desvío"; ≥10 pts o un atraso → "En riesgo". */
  const EW_LEVEL = {
    desvio: { label: "En desvío", rank: 0, chip: "bg-destructive/10 text-destructive", bar: "bg-destructive", icon: "TrendingDown" },
    riesgo: { label: "En riesgo", rank: 1, chip: "bg-accent-amber/15 text-accent-amber", bar: "bg-accent-amber", icon: "AlertTriangle" },
    ok: { label: "En plan", rank: 2, chip: "bg-accent-green/10 text-accent-green", bar: "bg-accent-green", icon: "TrendingUp" },
  };
  function EarlyWarnings({ rows, period }) {
    const data = useMemo(() => {
      const by = {};
      rows.forEach((r) => {
        if (!r.slug || r.origin !== "campaign") return;
        const b = by[r.slug] || (by[r.slug] = { slug: r.slug, title: r.campaignTitle, total: 0, done: 0, overdue: 0, review: 0 });
        b.total++;
        if (r.status === "done") b.done++;
        else { if (r.overdue) b.overdue++; if (r.status === "blocked") b.review++; }
      });
      return Object.values(by).map((b) => {
        const meta = S.readConfigMeta(b.slug, period) || {};
        let start = parseDeadline(meta.schedStart), end = parseDeadline(meta.schedEnd);
        if (!start || !end) {
          const snap = S.loadBriefSnapshot(b.slug, period);
          const dates = ((snap && snap.params) || []).map((p) => parseDeadline(p.date)).filter(Boolean);
          if (dates.length >= 2) { start = new Date(Math.min(...dates)); end = new Date(Math.max(...dates)); }
        }
        let expected = null;
        if (start && end && end > start) expected = Math.round(Math.min(1, Math.max(0, (startOfToday() - start) / (end - start))) * 100);
        const donePct = b.total ? Math.round(b.done / b.total * 100) : 0;
        const gap = expected != null ? expected - donePct : null;
        let level = "ok";
        if ((gap != null && gap >= 25) || b.overdue >= 2) level = "desvio";
        else if ((gap != null && gap >= 10) || b.overdue) level = "riesgo";
        return { ...b, donePct, expected, gap, level };
      }).sort((a, z) => EW_LEVEL[a.level].rank - EW_LEVEL[z.level].rank || (z.gap || 0) - (a.gap || 0));
    }, [rows, period]);
    if (!data.length) return null;
    return (
      <section aria-label="Alertas tempranas" className="mb-3">
        <div className="mb-1.5 flex items-center gap-2 px-0.5">
          <LucideIcon name="Activity" className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Alertas tempranas · real vs. esperado</h2>
        </div>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.map((c) => {
            const L = EW_LEVEL[c.level];
            return (
              <a key={c.slug} href={`#/brief/${c.slug}`}
                className="w-[230px] flex-none snap-start rounded-2xl border border-border bg-surface-elevated p-3.5 shadow-soft transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-glow">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{c.title}</p>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", L.chip)}>
                    <LucideIcon name={L.icon} className="h-3 w-3" strokeWidth={2.2} /> {L.label}
                  </span>
                </div>
                <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className={cn("absolute inset-y-0 left-0 rounded-full", L.bar)} style={{ width: `${c.donePct}%` }}></span>
                  {c.expected != null && <span className="absolute inset-y-[-2px] w-[2px] rounded-full bg-foreground/55" style={{ left: `${c.expected}%` }} title={`Esperado a hoy: ${c.expected}%`}></span>}
                </div>
                <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.donePct}% real</span>
                  {c.expected != null && <span> · {c.expected}% esperado</span>}
                  {c.overdue ? <span> · {c.overdue} atrasada{c.overdue === 1 ? "" : "s"}</span> : null}
                  {c.review ? <span> · {c.review} en revisión</span> : null}
                </p>
              </a>
            );
          })}
        </div>
      </section>
    );
  }

  function Chip({ label, onRemove }) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated py-0.5 pl-2 pr-1 text-[11px] font-medium text-foreground shadow-soft">
        {label}
        <button type="button" onClick={onRemove} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive"><LucideIcon name="X" className="h-3 w-3" /></button>
      </span>
    );
  }

  function SavedViews({ views, setViews, current, onApply }) {
    const { Popover } = window;
    const hasFilters = (current.campaignF.length + current.ownerF.length + current.statusF.length + current.priorityF.length + current.originF.length) > 0 || current.query.trim() || current.filter !== "all";
    const [naming, setNaming] = React.useState(false);
    const [name, setName] = React.useState("");
    const save = (setOpen) => {
      const n = name.trim();
      if (!n) return;
      const next = [...views, { id: Date.now().toString(36), name: n, state: { ...current } }];
      setViews(next); writeViews(next); setName(""); setNaming(false); setOpen && setOpen(false);
      if (window.toast) window.toast(`Vista «${n}» guardada`);
    };
    const del = (id) => { const next = views.filter((v) => v.id !== id); setViews(next); writeViews(next); };
    return (
      <Popover width="w-56" trigger={
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input bg-transparent px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-surface">
          <LucideIcon name="Bookmark" className="h-3 w-3" /> Vistas
          {views.length > 0 && <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted-foreground">{views.length}</span>}
        </button>
      }>
        {(setOpen) => (
          <div className="space-y-0.5">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vistas guardadas</p>
            {views.length === 0 && <p className="px-1.5 py-2 text-[11px] text-muted-foreground">Aún no hay vistas. Filtra y guarda.</p>}
            {views.map((v) => (
              <div key={v.id} className="group/v flex items-center gap-1 rounded px-1.5 py-1 hover:bg-accent">
                <button type="button" onClick={() => { onApply(v.state); setOpen(false); }} className="flex flex-1 items-center gap-1.5 text-left text-[12px]">
                  <LucideIcon name="Bookmark" className="h-3 w-3 text-brand" /> <span className="truncate">{v.name}</span>
                </button>
                <button type="button" onClick={() => del(v.id)} aria-label="Eliminar vista" className="h-4 w-4 text-muted-foreground opacity-0 hover:text-destructive group-hover/v:opacity-100"><LucideIcon name="Trash2" className="h-3 w-3" /></button>
              </div>
            ))}
            {!naming ? (
              <button type="button" onClick={() => setNaming(true)} disabled={!hasFilters} title={hasFilters ? "Guarda los filtros actuales como vista" : "Aplica filtros primero para poder guardarlos"} className="mt-1 flex w-full items-center gap-1.5 rounded border-t border-border px-1.5 pt-2 text-[12px] font-medium text-brand disabled:text-muted-foreground/50">
                <LucideIcon name="Plus" className="h-3 w-3" /> Guardar vista actual
              </button>
            ) : (
              <div className="mt-1 space-y-1.5 border-t border-border px-1.5 pt-2">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(setOpen); } if (e.key === "Escape") { setNaming(false); setName(""); } }}
                  placeholder="Nombre de la vista…"
                  className="h-7 w-full rounded-md border border-border bg-surface px-2 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <div className="flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => { setNaming(false); setName(""); }} className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">Cancelar</button>
                  <button type="button" onClick={() => save(setOpen)} disabled={!name.trim()} className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-medium text-background disabled:opacity-40">Guardar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Popover>
    );
  }

  function AlertPanel({ icon, tone, title, count, items, onItemClick }) {
    const toneCls = tone === "danger" ? "text-destructive" : "text-accent-amber";
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", toneCls)}>{icon}{title}</div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
        </div>
        {items.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground">Nada urgente</p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((r) => (
              <li key={`${r.slug}-${r.id}`}>
                <button type="button" onClick={onItemClick} className="block w-full rounded px-1 py-1 text-left hover:bg-surface">
                  <p className="truncate text-[11px] font-medium">{r.title || "—"}</p>
                  <p className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">{r.campaignTitle || (r.origin === "general" ? "Pendiente general" : "—")}</span>
                    <span className="shrink-0">{fmtShort(r.deadlineDate)}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* ---------- BIG switch: operativa de campañas ↔ puntos adicionales ---------- */
  function OriginSwitch({ view, setView, counts }) {
    const opts = [
      { key: "all", icon: "LayoutGrid", title: "Todos", sub: "Todo el equipo" },
      { key: "campaign", icon: "ClipboardCheck", title: "Campañas", sub: "De los briefs" },
      { key: "general", icon: "Inbox", title: "Adicionales", sub: "Operativa diaria" },
      { key: "comite", icon: "Landmark", title: "Comité", sub: "Acuerdos del comité" },
    ];
    return (
      <div className="mb-3 grid w-full max-w-3xl grid-cols-2 gap-1.5 rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-soft lg:grid-cols-4">
        {opts.map((o) => (
          <button key={o.key} type="button" onClick={() => setView(o.key)} title={o.title}
            className={cn("flex items-center justify-center gap-2 rounded-xl px-3 py-3 transition-colors", view === o.key ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground")}>
            <LucideIcon name={o.icon} className="h-5 w-5 shrink-0" />
            <span className="min-w-0 text-left">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold leading-tight sm:text-sm">
                <span>{o.title}</span>
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", view === o.key ? "bg-background/20 text-background" : "bg-surface text-muted-foreground")}>{counts[o.key]}</span>
              </span>
              <span className={cn("block truncate text-[11px] leading-tight", view === o.key ? "text-background/70" : "text-muted-foreground")}>{o.sub}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  /* ---------- Gestor de categorías de origen (Comité, Daily, …) ---------- */
  function OriginManagerModal({ onClose }) {
    const ReactDOM = window.ReactDOM;
    const origins = S.usePendingOrigins();
    const [val, setVal] = useState("");
    const add = (e) => {
      if (e) e.preventDefault();
      const t = val.trim(); if (!t) return;
      if (origins.some((o) => o.toLowerCase() === t.toLowerCase())) { toast("Esa categoría ya existe"); return; }
      S.writePendingOrigins([...origins, t]); setVal("");
    };
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-label="Categorías de origen">
        <button type="button" aria-label="Cerrar" onClick={onClose} className="fade-in absolute inset-0 w-full bg-foreground/30 backdrop-blur-[2px]"></button>
        <div className="sheet-up relative w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand/10 text-brand"><LucideIcon name="Tags" className="h-4 w-4" strokeWidth={2} /></span>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Categorías de origen</h3>
              <p className="text-[11.5px] text-muted-foreground">De dónde nacen los puntos adicionales.</p>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {origins.map((o) => (
              <div key={o} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                <span className="text-[13px] font-medium text-foreground">{o}</span>
                <button type="button" title={`Eliminar «${o}»`} onClick={() => S.writePendingOrigins(origins.filter((x) => x !== o))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                  <LucideIcon name="X" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {origins.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11.5px] text-muted-foreground">Sin categorías. Agrega la primera.</p>}
          </div>
          <form onSubmit={add} className="mt-3 flex items-center gap-2">
            <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Nueva categoría… (ej. Comité)" className="!h-9 !rounded-full flex-1 bg-surface px-3.5 text-[13px]" />
            <button type="submit" disabled={!val.trim()}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-40">
              <LucideIcon name="Plus" className="h-3.5 w-3.5" /> Agregar
            </button>
          </form>
          <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground/80">Eliminar una categoría no borra los puntos que ya la usan.</p>
          <button type="button" onClick={onClose} className="mt-4 h-9 w-full rounded-full border border-border bg-surface-elevated text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">Listo</button>
        </div>
      </div>,
      document.body
    );
  }

  /* ---------- Quick add: punto adicional → general pending ----------
     Campaña y periodo son OPCIONALES: un punto como "Hacer análisis de notas"
     no pertenece a ningún periodo — es del momento en que se pide. */
  function QuickAdd({ owner, compact, defaultSource }) {
    const gp = S.useGeneralPendings();
    const canCreate = S.useCan("createTasks");
    const session = S.useSession();
    S.useAvailablePeriods();
    const periods = S.listAvailablePeriods();
    const [val, setVal] = useState("");
    const [camp, setCamp] = useState("");
    const [per, setPer] = useState(""); // "" = sin periodo (puntual)
    const [src, setSrc] = useState(defaultSource || ""); // origen del pendiente (Comité, Daily, …)
    const [who, setWho] = useState(""); // responsable elegido ("" = yo)
    const [dl, setDl] = useState(""); // deadline opcional desde la creación (BUG-7420)
    const [mgr, setMgr] = useState(false);
    const origins = S.usePendingOrigins();
    const members = S.useMembers();
    if (!canCreate) return null;
    const submit = () => {
      const t = val.trim(); if (!t) return;
      gp.add({ title: t, period: per || undefined, campaignSlug: camp || undefined, source: src || undefined, deadline: dl || undefined, owner: owner != null ? owner : (who || (session && session.name) || "") });
      setVal(""); setCamp(""); setPer(""); setSrc(""); setWho(""); setDl("");
      toast(per ? "Punto añadido al periodo" : "Punto puntual añadido (sin periodo)");
    };
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "" : "rounded-2xl bg-zinc-900 p-2 shadow-md ring-1 ring-white/10")}>
        {!compact && <span className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold text-white"><LucideIcon name="Plus" className="h-3 w-3" /> Nuevo punto</span>}
        {compact && <LucideIcon name="Plus" className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <Input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={compact ? "Añadir punto…" : "Escribe el pendiente y pulsa Enter…"}
          className={cn("min-w-[160px] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0", compact ? "h-7 px-1 text-[12px]" : "h-8 px-1 text-xs text-white placeholder:text-white/50")} />
        {!compact && (
          <React.Fragment>
            <DatePicker value={dl} onChange={(v) => setDl(v)} placeholder="Fecha límite" align="start"
              className="h-7 rounded-full border-white/20 bg-white/10 px-2 text-[11px] font-medium text-white/80" />
            <select value={who} onChange={(e) => setWho(e.target.value)} title="Responsable del pendiente"
              className="h-7 cursor-pointer rounded-full border border-white/20 bg-white/10 px-2 text-[11px] font-medium text-white/80 focus-visible:outline-none [&>option]:text-foreground">
              <option value="">Para mí</option>
              {members.filter((m) => (m.name || "").trim()).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <select value={src} onChange={(e) => setSrc(e.target.value)} title="Origen del pendiente"
              className="h-7 cursor-pointer rounded-full border border-white/20 bg-white/10 px-2 text-[11px] font-medium text-white/80 focus-visible:outline-none [&>option]:text-foreground">
              <option value="">Origen…</option>
              {origins.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button type="button" title="Administrar categorías de origen" onClick={() => setMgr(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20">
              <LucideIcon name="Tags" className="h-3.5 w-3.5" />
            </button>
            <select value={camp} onChange={(e) => setCamp(e.target.value)} title="Campaña (opcional)"
              className="h-7 cursor-pointer rounded-full border border-white/20 bg-white/10 px-2 text-[11px] font-medium text-white/80 focus-visible:outline-none [&>option]:text-foreground">
              <option value="">Sin campaña</option>
              {S.campaigns.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
            </select>
            <select value={per} onChange={(e) => setPer(e.target.value)} title="Periodo (opcional) — sin periodo = puntual, del momento"
              className="h-7 cursor-pointer rounded-full border border-white/20 bg-white/10 px-2 text-[11px] font-medium text-white/80 focus-visible:outline-none [&>option]:text-foreground">
              <option value="">Sin periodo · puntual</option>
              {periods.map((p) => <option key={p} value={p}>{S.formatPeriodLabel(p)}</option>)}
            </select>
          </React.Fragment>
        )}
        {val.trim() && (
          <button type="button" onClick={submit} className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors", compact ? "bg-foreground text-background hover:bg-foreground/90" : "bg-white text-zinc-900 hover:bg-white/90")}>Añadir</button>
        )}
        {mgr && <OriginManagerModal onClose={() => setMgr(false)} />}
      </div>
    );
  }

  /* ---------- Por persona: dashboard de seguimiento individual ---------- */
  function PersonCard({ col, items, toggle, canEdit, period, isMe }) {
    const open = items.filter((r) => r.status !== "done");
    const done = items.length - open.length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const sorted = open.slice().sort((a, b) => {
      const sc = (r) => r.overdue ? 0 : r.daysLeft === 0 ? 1 : r.status === "blocked" ? 2 : r.upcoming ? 3 : 4;
      const s = sc(a) - sc(b); if (s !== 0) return s;
      if (a.deadlineDate && b.deadlineDate) return a.deadlineDate - b.deadlineDate;
      if (a.deadlineDate) return -1; if (b.deadlineDate) return 1; return 0;
    });
    return (
      <div className={cn("flex flex-col rounded-xl border bg-surface-elevated", isMe ? "border-brand/40 ring-1 ring-brand/20" : "border-border")}>
        <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2.5">
          {col.key === "__none" || !window.Avatar ? (
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", col.key === "__none" ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand")}>
              {col.key === "__none" ? "—" : (col.label || "?").trim().slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <window.Avatar name={col.label} className="h-8 w-8 text-[12px]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
              {col.label}
              {isMe && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand">Tú</span>}
            </p>
            {col.cargo && <p className="truncate text-[10px] text-muted-foreground">{col.cargo}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold tabular-nums text-foreground">{done}/{items.length}</p>
            <div className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full origin-left rounded-full bg-accent-green transition-transform duration-300" style={{ transform: `scaleX(${(pct || 0) / 100})` }}></div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-0.5 p-1.5">
          {sorted.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">Sin puntos abiertos</p>}
          {sorted.map((r) => (
            <div key={`${r.origin}-${r.slug}-${r.id}`} className="group flex items-start gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface">
              <Checkbox checked={false} onCheckedChange={() => canEdit && toggle(r)} className={cn("mt-0.5", !canEdit && "opacity-50")} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-foreground" title={r.title}>{r.title || "—"}</p>
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {r.priority === "high" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" title="Prioridad alta"></span>}
                  {r.campaignTitle ? <a href={`#/brief/${r.slug}`} className="truncate text-brand hover:underline">{r.campaignTitle}</a> : <span>Operativa diaria</span>}
                  {r.status === "blocked" && <span className="font-medium text-accent-amber">En revisión</span>}
                </p>
              </div>
              <span className={cn("shrink-0 whitespace-nowrap text-[10px] font-medium tabular-nums",
                r.overdue ? "text-destructive" : r.daysLeft === 0 ? "text-accent-amber" : r.upcoming ? "text-accent-amber" : "text-muted-foreground")}>
                {r.deadlineDate ? (r.overdue ? `${Math.abs(r.daysLeft)}d atraso` : r.daysLeft === 0 ? "Hoy" : fmtShort(r.deadlineDate)) : ""}
              </span>
            </div>
          ))}
        </div>
        {col.key !== "__none" && (
          <div className="border-t border-border/60 px-1.5 py-1"><QuickAdd owner={col.key} compact /></div>
        )}
      </div>
    );
  }

  function PeopleBoard({ rows, toggle, period }) {
    const members = S.useMembers();
    const canEdit = S.useCan("editTasks");
    const session = S.useSession();
    const me = session && session.name;
    const byOwner = useMemo(() => {
      const m = {};
      rows.forEach((r) => { const k = r.owner && r.owner.trim() ? r.owner.trim() : "__none"; (m[k] = m[k] || []).push(r); });
      return m;
    }, [rows]);
    const activeNames = members.filter((m) => m.status === "active").map((m) => m.name);
    const extra = Object.keys(byOwner).filter((k) => k !== "__none" && !activeNames.includes(k)).sort();
    let cols = [
      ...members.filter((m) => m.status === "active").map((m) => ({ key: m.name, label: m.name, cargo: m.cargo })),
      ...extra.map((o) => ({ key: o, label: o, cargo: "" })),
    ];
    if (byOwner["__none"] && byOwner["__none"].some((r) => r.status !== "done")) cols.push({ key: "__none", label: "Sin asignar", cargo: "" });
    if (me) cols = [...cols.filter((c) => c.key === me), ...cols.filter((c) => c.key !== me)];
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cols.map((col) => (
          <PersonCard key={col.key} col={col} items={byOwner[col.key] || []} toggle={toggle} canEdit={canEdit} period={period} isMe={me === col.key} />
        ))}
      </div>
    );
  }

  function CommandCenter(props) {
    /* Remonta el cuerpo si cambia la lista de periodos (mantiene estable el número de hooks). */
    S.useAvailablePeriods();
    const key = S.listAvailablePeriods().join("|");
    return <CommandCenterBody key={key} {...props} />;
  }

  function CommandCenterBody({ initialMode }) {
    const mode = initialMode === "people" ? "people" : "center";
    const [view, setView] = useState("all"); // all | campaign | general | comite (big switch)
    const [currentPeriod] = S.useCurrentPeriod();
    const perSel = S.useSelectedPeriods("all");
    const selPeriods = perSel.periods;
    const periodLabel = perSel.value === "all" ? "Todos los periodos" : selPeriods.length === 1 ? S.formatPeriodLabel(selPeriods[0]) : `${selPeriods.length} periodos`;
    const { rawRows, toggle, updateTask, approve, reject, addUpdate, removeRow, canApprove } = useAllTasks(selPeriods);
    const members = S.useMembers(); // para "Asignar a" de la barra masiva
    const [rejecting, setRejecting] = useState(null); // fila cuya entrega se va a rebotar
    const [tracking, setTracking] = useState(null); // fila cuyo tracking se ve
    const [deleting, setDeleting] = useState(null); // fila a eliminar (confirmación)
    const [selected, setSelected] = useState(() => new Set()); // selección masiva (BUG-C7D9)
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const rowKey = (r) => `${r.origin}-${r.slug}-${r.id}`;
    const toggleSel = (r) => setSelected((s) => { const n = new Set(s); const k = rowKey(r); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const clearSel = () => setSelected(new Set());
    const canEdit = S.useCan("editTasks");
    const canDelete = S.useCan("deleteTasks");
    const today = startOfToday();
    const [filter, setFilter] = useState("all");
    const [campaignF, setCampaignF] = useState([]);
    const [ownerF, setOwnerF] = useState([]);
    const [statusF, setStatusF] = useState([]);
    const [priorityF, setPriorityF] = useState([]);
    const [originF, setOriginF] = useState([]);
    const [sourceF, setSourceF] = useState([]);
    const origins = S.usePendingOrigins();
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState({ key: null, dir: null });
    /* Anchos de columna ajustables y persistentes (BUG-424E). null = automático. */
    const COLW_KEY = "centro-colw:v1";
    const [colW, setColW] = useState(() => { try { return JSON.parse(localStorage.getItem(COLW_KEY)) || {}; } catch { return {}; } });
    const setColWidth = (col, w) => setColW((prev) => { const next = { ...prev }; if (w == null) delete next[col]; else next[col] = w; try { localStorage.setItem(COLW_KEY, JSON.stringify(next)); } catch {} return next; });
    const [views, setViews] = useState(readViews);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const toggleIn = (setter) => (v) => setter((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    const clearAllFilters = () => { setCampaignF([]); setOwnerF([]); setStatusF([]); setPriorityF([]); setOriginF([]); setSourceF([]); setQuery(""); setFilter("all"); };
    const activeFilterCount = campaignF.length + ownerF.length + statusF.length + priorityF.length + originF.length + sourceF.length + (query.trim() ? 1 : 0) + (filter !== "all" ? 1 : 0);

    const rows = useMemo(() => rawRows.map((r) => {
      const d = parseDeadline(r.deadline);
      const dl = d ? daysDiff(d) : null;
      const status = r.status || (r.done ? "done" : "todo");
      const overdue = !!(d && status !== "done" && d < today);
      const upcoming = !!(d && status !== "done" && d >= today && dl <= 7);
      const critical = !!(d && status !== "done" && dl !== null && dl <= 3 && dl >= 0);
      return { ...r, status, deadlineDate: d, overdue, upcoming, critical, daysLeft: dl };
    }), [rawRows, today]);

    const owners = useMemo(() => { const s = new Set(); rows.forEach((r) => r.owner && s.add(r.owner)); return Array.from(s).sort(); }, [rows]);

    // Big-switch scope: campaign operativa vs puntos adicionales (general).
    const isComite = (r) => r.origin === "general" && /^comit/i.test((r.source || "").trim());
    const viewRows = useMemo(() => {
      if (mode !== "center" || view === "all") return rows;
      if (view === "comite") return rows.filter(isComite);
      if (view === "general") return rows.filter((r) => r.origin === "general" && !isComite(r));
      return rows.filter((r) => r.origin === view);
    }, [rows, view, mode]);
    const originCounts = useMemo(() => ({
      all: rows.filter((r) => r.status !== "done").length,
      campaign: rows.filter((r) => r.origin === "campaign" && r.status !== "done").length,
      general: rows.filter((r) => r.origin === "general" && !isComite(r) && r.status !== "done").length,
      comite: rows.filter((r) => isComite(r) && r.status !== "done").length,
    }), [rows]);

    const faceted = useMemo(() => {
      const q = query.trim().toLowerCase();
      return viewRows.filter((r) => {
        if (campaignF.length && !campaignF.includes(r.slug)) return false;
        if (originF.length && !originF.includes(r.origin)) return false;
        if (ownerF.length && !ownerF.includes(r.owner)) return false;
        if (statusF.length && !statusF.includes(r.status)) return false;
        if (priorityF.length && !priorityF.includes(r.priority || "med")) return false;
        if (sourceF.length) {
          const sv = r.origin === "campaign" ? "Operativa" : (r.source || "__none");
          if (!sourceF.includes(sv)) return false;
        }
        if (q && !`${r.title} ${r.owner} ${r.campaignTitle}`.toLowerCase().includes(q)) return false;
        return true;
      });
    }, [viewRows, campaignF, originF, ownerF, statusF, priorityF, sourceF, query]);

    const stats = useMemo(() => {
      const total = faceted.length;
      const done = faceted.filter((r) => r.status === "done").length;
      const overdue = faceted.filter((r) => r.overdue).length;
      const upcoming = faceted.filter((r) => r.upcoming).length;
      const todayC = faceted.filter((r) => r.daysLeft === 0 && r.status !== "done").length;
      const blocked = faceted.filter((r) => r.status === "blocked").length;
      const active = total - done;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);
      const riskCampaigns = new Set();
      faceted.forEach((r) => { if (r.overdue) riskCampaigns.add(r.slug); });
      return { total, done, overdue, upcoming, today: todayC, blocked, active, percent, risk: riskCampaigns.size };
    }, [faceted]);

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      const f = viewRows.filter((r) => {
        if (filter === "overdue" && !r.overdue) return false;
        if (filter === "today" && !(r.daysLeft === 0 && r.status !== "done")) return false;
        if (filter === "upcoming" && !r.upcoming) return false;
        if (filter === "blocked" && r.status !== "blocked") return false;
        if (filter === "done" && r.status !== "done") return false;
        // Los completados se muestran solo en su propia sección (BUG-A991),
        // salvo que el filtro activo sea justamente "Hechas".
        if (filter !== "done" && r.status === "done") return false;
        if (campaignF.length && !campaignF.includes(r.slug)) return false;
        if (originF.length && !originF.includes(r.origin)) return false;
        if (ownerF.length && !ownerF.includes(r.owner)) return false;
        if (statusF.length && !statusF.includes(r.status)) return false;
        if (priorityF.length && !priorityF.includes(r.priority || "med")) return false;
        if (sourceF.length) {
          const sv = r.origin === "campaign" ? "Operativa" : (r.source || "__none");
          if (!sourceF.includes(sv)) return false;
        }
        if (q && !`${r.title} ${r.owner} ${r.campaignTitle}`.toLowerCase().includes(q)) return false;
        return true;
      });
      // Active column sort overrides the default smart triage sort.
      if (sort.key) {
        const val = (r) => {
          switch (sort.key) {
            case "title": return (r.title || "").toLowerCase();
            case "origin": return ORIGIN_LABEL[r.origin] || "";
            case "campaign": return (r.campaignTitle || "").toLowerCase();
            case "owner": return (r.owner || "").toLowerCase();
            case "status": return STATUS_ORDER[r.status] ?? 9;
            case "priority": return PRIORITY_ORDER[r.priority || "med"] ?? 9;
            case "deadline": return r.deadlineDate ? r.deadlineDate.getTime() : Infinity;
            case "daysLeft": return r.daysLeft === null ? Infinity : r.daysLeft;
            case "source": return (r.origin === "campaign" ? "Operativa" : (r.source || "zz-sin origen")).toLowerCase();
            default: return 0;
          }
        };
        const dir = sort.dir === "desc" ? -1 : 1;
        return f.slice().sort((a, b) => {
          const va = val(a), vb = val(b);
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return 0;
        });
      }
      const score = (r) => { if (r.status === "done") return 5; if (r.overdue) return 0; if (r.critical) return 1; if (r.upcoming) return 2; if (r.status === "blocked") return 3; return 4; };
      return f.sort((a, b) => {
        const s = score(a) - score(b); if (s !== 0) return s;
        if (a.deadlineDate && b.deadlineDate) return a.deadlineDate - b.deadlineDate;
        if (a.deadlineDate) return -1; if (b.deadlineDate) return 1; return 0;
      });
    }, [viewRows, filter, campaignF, ownerF, statusF, priorityF, originF, sourceF, query, sort]);

    /* Completados de la vista actual, para la sección "Completados" (BUG-A991). */
    const doneList = useMemo(() => viewRows.filter((r) => r.status === "done")
      .sort((a, b) => (b.deadlineDate?.getTime() || 0) - (a.deadlineDate?.getTime() || 0)), [viewRows]);
    const [showDone, setShowDone] = useState(false);

    const overdueList = rows.filter((r) => r.overdue).slice(0, 5);
    const dueTodayList = rows.filter((r) => r.daysLeft === 0 && r.status !== "done").slice(0, 5);
    const nextWeekList = rows.filter((r) => r.upcoming && r.daysLeft !== 0).slice(0, 5);
    const blockedList = rows.filter((r) => r.status === "blocked").slice(0, 5);

    return (
      <div className="min-h-screen bg-background" data-screen-label="Centro de Operaciones">
        {rejecting && <RejectModal row={rejecting} onClose={() => setRejecting(null)} onConfirm={(c) => { reject(rejecting, c); setRejecting(null); }} />}
        {tracking && <TaskTrackingModal row={(rawRows.find((x) => x.id === tracking.id && x.origin === tracking.origin) || tracking)} canEdit={canEdit} onAddUpdate={addUpdate} onClose={() => setTracking(null)} />}
        {bulkDeleting && window.ConfirmDelete && <window.ConfirmDelete requireClave={false} title="Eliminar tareas seleccionadas" message={`Se eliminarán ${selected.size} tarea${selected.size === 1 ? "" : "s"}. Esta acción no se puede deshacer.`} confirmLabel="Eliminar todas" onClose={() => setBulkDeleting(false)} onConfirm={() => { const sel = filtered.filter((r) => selected.has(rowKey(r))); sel.forEach((r) => removeRow(r)); setBulkDeleting(false); clearSel(); if (window.toast) window.toast(`${sel.length} tarea${sel.length === 1 ? "" : "s"} eliminada${sel.length === 1 ? "" : "s"}`); }} />}
        {deleting && window.ConfirmDelete && <window.ConfirmDelete requireClave={false} title="Eliminar tarea" message={`Se eliminará «${deleting.title || "(sin título)"}». Esta acción no se puede deshacer.`} confirmLabel="Eliminar" onClose={() => setDeleting(null)} onConfirm={() => { removeRow(deleting); setDeleting(null); if (window.toast) window.toast("Tarea eliminada"); }} />}
        <window.SectionWash accent={mode === "people" ? "violet" : "green"} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-0 sm:px-6 lg:px-8">
          <window.PageToolbar back="#/" left={<window.PeriodFilter />}>
            {mode === "center" && (
              <React.Fragment>
                <div className="relative w-56">
                  <LucideIcon name="Search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Buscar tarea, responsable…" className="!h-8 !rounded-full pl-8 text-xs" />
                </div>
                <MultiSelect label="Campaña" icon="Megaphone" selected={campaignF} onToggle={toggleIn(setCampaignF)} onClear={() => setCampaignF([])}
                  options={S.campaigns.map((c) => [c.slug, c.title])} />
                <MultiSelect label="Responsable" icon="User" selected={ownerF} onToggle={toggleIn(setOwnerF)} onClear={() => setOwnerF([])}
                  options={owners.map((o) => [o, o])} />
                <MultiSelect label="Origen" icon="Tags" selected={sourceF} onToggle={toggleIn(setSourceF)} onClear={() => setSourceF([])}
                  options={[["Operativa", "Operativa"], ...origins.map((o) => [o, o]), ["__none", "Sin origen"]]} />
                <MultiSelect label="Estado" icon="Circle" selected={statusF} onToggle={toggleIn(setStatusF)} onClear={() => setStatusF([])}
                  options={[["todo", "Pendiente"], ["in_progress", "En progreso"], ["blocked", "En revisión"], ["done", "Completado"]]} />
                <MultiSelect label="Prioridad" icon="Flag" selected={priorityF} onToggle={toggleIn(setPriorityF)} onClear={() => setPriorityF([])}
                  options={[["high", "Alta"], ["med", "Media"], ["low", "Baja"]]} />
                <SavedViews views={views} setViews={setViews}
                  current={{ campaignF, ownerF, statusF, priorityF, originF, sourceF, query, filter }}
                  onApply={(s) => { setCampaignF(s.campaignF || []); setOwnerF(s.ownerF || []); setStatusF(s.statusF || []); setPriorityF(s.priorityF || []); setOriginF(s.originF || []); setSourceF(s.sourceF || []); setQuery(s.query || ""); setFilter(s.filter || "all"); }} />
                <span className="whitespace-nowrap px-1 text-[11px] text-muted-foreground">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span>
                <span className="mx-0.5 h-6 w-px bg-border" />
              </React.Fragment>
            )}
            {mode === "people"
              ? <a href="#/checklist" className="text-xs font-medium text-muted-foreground hover:text-foreground">Command Center →</a>
              : <a href="#/pendientes" className="text-xs font-medium text-muted-foreground hover:text-foreground">Por persona →</a>}
          </window.PageToolbar>

          <window.SectionHeader accent={mode === "people" ? "violet" : "green"} icon={mode === "people" ? "ListChecks" : "Gauge"}
            title={mode === "people" ? "Mis pendientes" : "Centro de operaciones"}
            subtitle={`${periodLabel}${mode === "people" ? " · dashboard de ejecución" : " · " + rows.length + " tareas"}`} />

          {mode === "people" ? (
            !mounted ? (
              <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-xs text-muted-foreground">Cargando…</div>
            ) : (
              <window.MisPendientes rows={rows} toggle={toggle} updateTask={updateTask} approve={approve} reject={(r) => setRejecting(r)} removeRow={removeRow} canDelete={canDelete} canApprove={canApprove} addUpdate={addUpdate} period={currentPeriod} />
            )
          ) : (
          <React.Fragment>
          <OriginSwitch view={view} setView={setView} counts={originCounts} />
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-elevated p-1 sm:grid-cols-4 lg:grid-cols-7">
            <Kpi label="Activas" value={stats.active} onClick={() => setFilter("all")} active={filter === "all"} />
            <Kpi label="Atrasadas" value={stats.overdue} tone="danger" onClick={() => setFilter("overdue")} active={filter === "overdue"} />
            <Kpi label="Hoy" value={stats.today} tone="warning" onClick={() => setFilter("today")} active={filter === "today"} />
            <Kpi label="≤ 7 días" value={stats.upcoming} tone="warning" onClick={() => setFilter("upcoming")} active={filter === "upcoming"} />
            <Kpi label="En revisión" value={stats.blocked} tone="warning" onClick={() => setFilter("blocked")} active={filter === "blocked"} />
            <Kpi label="Hechas" value={stats.done} tone="success" onClick={() => setFilter("done")} active={filter === "done"} />
            <Kpi label="Avance" value={`${stats.percent}%`} hint={`${stats.risk} en riesgo`} />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              {(view === "general" || view === "all") && <QuickAdd />}
              {view === "comite" && <QuickAdd defaultSource="Comité de retención" />}

              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {filter !== "all" && <Chip label={`Vista: ${KPI_LABEL[filter] || filter}`} onRemove={() => setFilter("all")} />}
                  {query.trim() && <Chip label={`Buscar: “${query.trim()}”`} onRemove={() => setQuery("")} />}
                  {campaignF.map((v) => <Chip key={"c" + v} label={`Campaña: ${(S.campaigns.find((c) => c.slug === v) || {}).title || v}`} onRemove={() => toggleIn(setCampaignF)(v)} />)}
                  {ownerF.map((v) => <Chip key={"w" + v} label={`Resp.: ${v}`} onRemove={() => toggleIn(setOwnerF)(v)} />)}
                  {statusF.map((v) => <Chip key={"s" + v} label={`Estado: ${STATUS_LABEL[v]}`} onRemove={() => toggleIn(setStatusF)(v)} />)}
                  {priorityF.map((v) => <Chip key={"p" + v} label={`Prio: ${PRIORITY_LABEL[v]}`} onRemove={() => toggleIn(setPriorityF)(v)} />)}
                  {sourceF.map((v) => <Chip key={"sr" + v} label={`Origen: ${v === "__none" ? "Sin origen" : v}`} onRemove={() => toggleIn(setSourceF)(v)} />)}
                  <button type="button" onClick={clearAllFilters} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-destructive">
                    <LucideIcon name="X" className="h-3 w-3" /> Limpiar filtros
                  </button>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
                {!mounted ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">Cargando…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">Sin actividades para los filtros seleccionados.</div>
                ) : (
                  <div className="overflow-x-auto">
                  {selected.size > 0 && (
                    <div className="sticky left-0 z-10 flex flex-wrap items-center gap-2 border-b border-brand/20 bg-brand/[0.06] px-3 py-2">
                      <span className="text-[12px] font-semibold text-brand">{selected.size} seleccionada{selected.size === 1 ? "" : "s"}</span>
                      {canEdit && (
                        <button type="button" onClick={() => { const sel = filtered.filter((r) => selected.has(rowKey(r))); sel.forEach((r) => updateTask(r, { status: canApprove ? "done" : "blocked", done: canApprove })); clearSel(); if (window.toast) window.toast(canApprove ? "Marcadas como completadas" : "Enviadas a revisión"); }}
                          className="inline-flex items-center gap-1 rounded-full bg-accent-green px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-accent-green/90">
                          <LucideIcon name="CheckCheck" className="h-3 w-3" /> {canApprove ? "Completar" : "Enviar a revisión"}
                        </button>
                      )}
                      {canEdit && (
                        <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[11px] text-muted-foreground">
                          Asignar a
                          <select defaultValue="" onChange={(e) => { const v = e.target.value; if (!v) return; const sel = filtered.filter((r) => selected.has(rowKey(r))); sel.forEach((r) => updateTask(r, { owner: v })); e.target.value = ""; clearSel(); if (window.toast) window.toast(`Asignadas a ${v}`); }}
                            className="cursor-pointer rounded border-0 bg-transparent text-[11px] font-medium text-foreground focus-visible:outline-none">
                            <option value="">elegir…</option>
                            {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                          </select>
                        </label>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => setBulkDeleting(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10">
                          <LucideIcon name="Trash2" className="h-3 w-3" /> Eliminar
                        </button>
                      )}
                      <button type="button" onClick={clearSel} className="ml-auto rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">Limpiar selección</button>
                    </div>
                  )}
                  <table className="w-full table-fixed text-xs">
                    <colgroup>
                      <col style={{ width: "28px" }} />
                      <col style={{ width: colW.title ? `${colW.title}px` : "auto" }} />
                      <col style={{ width: colW.campaign ? `${colW.campaign}px` : "130px" }} />
                      <col style={{ width: colW.source ? `${colW.source}px` : "110px" }} />
                      <col style={{ width: colW.owner ? `${colW.owner}px` : "120px" }} />
                      <col style={{ width: colW.status ? `${colW.status}px` : "120px" }} />
                      <col style={{ width: colW.priority ? `${colW.priority}px` : "90px" }} />
                      <col style={{ width: colW.deadline ? `${colW.deadline}px` : "100px" }} />
                      <col style={{ width: "70px" }} />
                      <col style={{ width: colW.daysLeft ? `${colW.daysLeft}px` : "90px" }} />
                    </colgroup>
                    <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="w-7 px-2 py-1.5">
                          <Checkbox checked={filtered.length > 0 && filtered.every((r) => selected.has(rowKey(r)))}
                            onCheckedChange={() => setSelected((s) => filtered.every((r) => s.has(rowKey(r))) ? new Set() : new Set(filtered.map(rowKey)))}
                            title="Seleccionar todo lo visible" />
                        </th>
                        <SortTh label="Tarea" col="title" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <SortTh label="Campaña" col="campaign" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <SortTh label="Origen" col="source" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <SortTh label="Responsable" col="owner" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <SortTh label="Estado" col="status" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <SortTh label="Prio" col="priority" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <SortTh label="Deadline" col="deadline" sort={sort} setSort={setSort} onResize={setColWidth} />
                        <th className="px-1.5 py-1.5 text-left font-medium">Track</th>
                        <SortTh label="Restante" col="daysLeft" sort={sort} setSort={setSort} onResize={setColWidth} />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => { return (
                        <React.Fragment key={`${r.origin}-${r.slug}-${r.id}`}>
                        <tr className="border-t border-border/60 hover:bg-surface/50">
                          <td className="px-2 py-1.5">
                            {r.status === "blocked" && canApprove ? (
                              <span className="flex items-center gap-1">
                                <button type="button" title="Aprobar (en revisión → completada)" onClick={() => approve(r)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-green/15 text-accent-green transition-colors hover:bg-accent-green hover:text-white">
                                  <LucideIcon name="Check" className="h-3.5 w-3.5" strokeWidth={2.6} />
                                </button>
                                <button type="button" title="Rebotar con comentario (en revisión → en curso)" onClick={() => setRejecting(r)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-white">
                                  <LucideIcon name="Undo2" className="h-3 w-3" strokeWidth={2.4} />
                                </button>
                              </span>
                            ) : (
                              <Checkbox checked={selected.has(rowKey(r))} onCheckedChange={() => toggleSel(r)} title="Seleccionar para acción masiva" />
                            )}
                          </td>
                          <td className="px-1.5 py-1.5 align-top">
                            <div className="flex items-start gap-1.5">
                              {canEdit ? (
                                <textarea defaultValue={r.title || ""} key={`${rowKey(r)}-t`} rows={1}
                                  onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== r.title) updateTask(r, { title: t }); }}
                                  onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.target.blur(); } }} title={r.title}
                                  className={cn("min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent px-1 py-0.5 text-xs leading-snug shadow-none outline-none focus:rounded focus:bg-surface", r.status === "done" && "text-muted-foreground line-through")} />
                              ) : (
                                <span className={cn("flex-1 whitespace-pre-wrap break-words py-0.5 text-xs leading-snug", r.status === "done" && "text-muted-foreground line-through")}>{r.title || "—"}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5 align-top">
                            {r.campaignTitle ? (
                              <a href={`#/brief/${r.slug}${r.period ? `?p=${r.period}` : ""}`} className="text-[11px] font-medium text-brand hover:underline">{r.campaignTitle}</a>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">{r.origin === "general" ? (r.period ? S.formatPeriodLabel(r.period) : "Puntual") : "—"}</span>
                            )}
                          </td>
                          <td className="px-1.5 py-1.5">
                            {r.origin === "campaign" ? (
                              <span className="inline-flex whitespace-nowrap rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">Operativa</span>
                            ) : (
                              <select value={r.source || ""} onChange={(e) => updateTask(r, { source: e.target.value || "" })} disabled={!canEdit}
                                title="Origen del pendiente"
                                className="h-5 max-w-[110px] cursor-pointer rounded-full border-0 bg-muted px-1.5 text-[10px] font-medium text-muted-foreground disabled:cursor-default">
                                <option value="">—</option>
                                {origins.map((o) => <option key={o} value={o}>{o}</option>)}
                                {r.source && !origins.includes(r.source) && <option value={r.source}>{r.source}</option>}
                              </select>
                            )}
                          </td>
                          <td className="px-1.5 py-1.5"><window.OwnerSelect value={r.owner} onChange={(v) => updateTask(r, { owner: v })} disabled={!canEdit} className="h-6 w-28 px-1 text-[11px] shadow-none focus-visible:bg-surface" /></td>
                          <td className="px-1.5 py-1.5">
                            <div className="flex items-center gap-1">
                              <select value={r.status} onChange={(e) => updateTask(r, { status: e.target.value })} disabled={!canEdit} className={cn("h-5 cursor-pointer rounded border-0 px-1 text-[10px] font-medium disabled:cursor-default", STATUS_TONE[r.status])}>
                                {(canApprove ? ["todo", "in_progress", "blocked", "done"] : ["todo", "in_progress", "blocked"]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                {!canApprove && r.status === "done" && <option value="done">{STATUS_LABEL.done}</option>}
                              </select>
                              {r.status === "blocked" && canApprove && (
                                <span className="flex shrink-0 items-center gap-0.5">
                                  <button type="button" title="Aprobar" onClick={() => approve(r)} className="rounded-full bg-accent-green/15 px-1.5 py-0.5 text-[9px] font-bold text-accent-green transition-colors hover:bg-accent-green hover:text-white">Aprobar</button>
                                  <button type="button" title="Rebotar con comentario" onClick={() => setRejecting(r)} className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive transition-colors hover:bg-destructive hover:text-white">Rebotar</button>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5">
                            <select value={r.priority || "med"} onChange={(e) => updateTask(r, { priority: e.target.value })} disabled={!canEdit} className={cn("h-5 cursor-pointer rounded border-0 px-1 text-[10px] font-medium disabled:cursor-default", PRIORITY_TONE[r.priority || "med"])}>
                              {["high", "med", "low"].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                            </select>
                          </td>
                          <td className="px-1.5 py-1.5"><DatePicker value={r.deadline || ""} onChange={(v) => canEdit && updateTask(r, { deadline: v })} disabled={!canEdit} placeholder="—" align="end" className="h-6 border-0 bg-transparent px-1 text-[11px] shadow-none" /></td>
                          <td className="px-1.5 py-1.5">
                            <div className="flex items-center gap-0.5">
                              <button type="button" onClick={() => setTracking(r)} title="Ver tracking del pendiente"
                                className="relative inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand">
                                <LucideIcon name="History" className="h-3.5 w-3.5" />
                                {(r.updates || []).length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-brand px-0.5 text-[7px] font-bold text-white">{(r.updates || []).length}</span>}
                              </button>
                              {canDelete && r.origin !== "design" && (
                                <button type="button" onClick={() => setDeleting(r)} title="Eliminar tarea"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                  <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5">
                            {r.daysLeft === null ? <span className="text-[10px] text-muted-foreground">—</span>
                              : r.status === "done" ? <span className="text-[10px] text-accent-green">ok</span>
                              : r.overdue ? <span className="text-[10px] font-medium text-destructive">{Math.abs(r.daysLeft)}d atraso</span>
                              : r.daysLeft === 0 ? <span className="text-[10px] font-medium text-accent-amber">Hoy</span>
                              : r.daysLeft <= 7 ? <span className="text-[10px] font-medium text-accent-amber">{r.daysLeft}d</span>
                              : <span className="text-[10px] text-muted-foreground">{r.daysLeft}d</span>}
                          </td>
                        </tr>
                        </React.Fragment>
                      ); })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>

              {/* Sección "Completados" — oculta de las demás vistas, colapsable (BUG-A991) */}
              {filter !== "done" && doneList.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-soft">
                  <button type="button" onClick={() => setShowDone((v) => !v)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-surface">
                    <LucideIcon name={showDone ? "ChevronDown" : "ChevronRight"} className="h-4 w-4 text-muted-foreground" />
                    <LucideIcon name="CheckCircle2" className="h-4 w-4 text-accent-green" />
                    <span className="text-[13px] font-semibold text-foreground">Completados</span>
                    <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-accent-green">{doneList.length}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{showDone ? "ocultar" : "mostrar"}</span>
                  </button>
                  {showDone && (
                    <ul className="border-t border-border/60 divide-y divide-border/40">
                      {doneList.map((r) => (
                        <li key={rowKey(r)} className="flex items-center gap-2 px-4 py-2">
                          {canApprove ? (
                            <button type="button" title="Reabrir (marcar como pendiente)" onClick={() => updateTask(r, { status: "todo", done: false })}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-green/15 text-accent-green transition-colors hover:bg-accent-green hover:text-white">
                              <LucideIcon name="Check" className="h-3.5 w-3.5" strokeWidth={2.6} />
                            </button>
                          ) : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-green/15 text-accent-green"><LucideIcon name="Check" className="h-3.5 w-3.5" strokeWidth={2.6} /></span>}
                          <span className="flex-1 whitespace-pre-wrap break-words text-[12px] text-muted-foreground line-through">{r.title || "—"}</span>
                          {r.campaignTitle && <span className="shrink-0 text-[10px] text-muted-foreground/70">{r.campaignTitle}</span>}
                          {r.owner && <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.owner}</span>}
                          {canDelete && (
                            <button type="button" title="Eliminar" onClick={() => setDeleting(r)}
                              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive">
                              <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          </React.Fragment>
          )}
        </main>
      </div>
    );
  }

  Object.assign(window, { CommandCenter });
})();
