/* Brief part 2 — visual operative checklist, critical pendings widget, cockpit layout. */
(function () {
  const React = window.React;
  const { useState, useMemo } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Checkbox, Block } = window;
  const cn = window.cn;

  const STATUS_LABEL = { todo: "Pendiente", in_progress: "En progreso", done: "Completado", blocked: "En revisión" };
  const STATUS_TONE = { todo: "bg-surface text-muted-foreground", in_progress: "bg-brand/10 text-brand", done: "bg-accent-green/10 text-accent-green", blocked: "bg-accent-amber/15 text-accent-amber" };
  const STATUS_DOT = { todo: "bg-muted-foreground/40", in_progress: "bg-brand", done: "bg-accent-green", blocked: "bg-accent-amber" };
  const PRIORITY_LABEL = { high: "Alta", med: "Media", low: "Baja" };
  const PRIORITY_TONE = { high: "bg-destructive/10 text-destructive", med: "bg-accent-amber/15 text-accent-amber", low: "bg-surface text-muted-foreground" };
  window.STATUS_LABEL = STATUS_LABEL; window.STATUS_TONE = STATUS_TONE; window.PRIORITY_LABEL = PRIORITY_LABEL; window.PRIORITY_TONE = PRIORITY_TONE;

  function ToneSelect({ value, onChange, options, className }) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("cursor-pointer appearance-none rounded border-0 px-1 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", className)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  }
  window.ToneSelect = ToneSelect;

  /* ============== Operative checklist (visual, compact) ============== */
  function OperativeChecklist({ slug, period }) {
    const { tasks, toggle, update, add, remove, reset, addUpdate, removeUpdate, editUpdate } = S.useOperativeChecklist(slug, period);
    const canEdit = S.useCan("editTasks");
    const [tracking, setTracking] = useState(null); // tarea cuya trazabilidad se ve (BUG-9B06)
    const grouped = useMemo(() => {
      const map = new Map();
      for (const t of tasks) { const key = t.month || "Sin mes"; if (!map.has(key)) map.set(key, []); map.get(key).push(t); }
      return Array.from(map.entries());
    }, [tasks]);
    const done = tasks.filter((t) => t.done).length;
    const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const counts = ["blocked", "in_progress", "todo", "done"].map((s) => ({ s, n: tasks.filter((t) => (t.status || (t.done ? "done" : "todo")) === s).length }));

    return (
      <Block icon="ClipboardCheck" title="Checklist operativo"
        action={<Button variant="ghost" size="sm" onClick={reset} className="edit-only h-6 gap-1 px-1.5 text-[11px] text-muted-foreground print:hidden" title="Restablecer plantilla"><LucideIcon name="RotateCcw" className="h-3 w-3" /></Button>}>
        {/* prominent progress */}
        <div className="mb-3 flex items-center gap-4 rounded-xl border border-border/60 bg-surface/40 px-4 py-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{percent}%</span>
            <span className="text-[11px] text-muted-foreground">completado</span>
          </div>
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="tabular-nums">{done}/{tasks.length} tareas</span>
              <span className="flex items-center gap-2">
                {counts.filter((c) => c.n > 0).map((c) => <span key={c.s} className="inline-flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[c.s])} />{c.n}</span>)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full w-full origin-left rounded-full bg-accent-green transition-transform duration-300" style={{ transform: `scaleX(${(percent || 0) / 100})` }} /></div>
          </div>
        </div>

        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-4 text-center text-xs text-muted-foreground">
            Checklist vacío. Usa <span className="font-medium text-foreground">Restablecer plantilla</span> para cargar las actividades base.
          </p>
        )}

        <div className="space-y-2.5">
          {grouped.map(([month, items]) => (
            <div key={month}>
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{month}</h3>
              <div className="space-y-0.5">
                {items.map((t) => {
                  const status = t.status || (t.done ? "done" : "todo");
                  const priority = t.priority || "med";
                  return (
                    <div key={t.id} className="rounded-lg py-0.5 hover:bg-surface/60 print:py-0.5">
                      <div className="flex items-center gap-1.5 px-1.5">
                        <Checkbox checked={t.done} onCheckedChange={() => toggle(t.id)} className="shrink-0" />
                        <Input value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} placeholder="Actividad"
                          className={cn("h-7 flex-1 border-0 bg-transparent px-1 text-[13px] shadow-none focus-visible:bg-surface focus-visible:ring-0", t.done && "text-muted-foreground line-through")} />
                        <window.OwnerSelect value={t.owner} onChange={(v) => update(t.id, { owner: v })}
                          className="h-7 w-24 px-1 text-[11px] text-muted-foreground shadow-none focus-visible:bg-surface sm:w-28" />
                        <ToneSelect value={status} onChange={(v) => update(t.id, { status: v })}
                          options={["todo", "in_progress", "done", "blocked"].map((s) => [s, STATUS_LABEL[s]])} className={cn("h-5 text-[10px] print:hidden", STATUS_TONE[status])} />
                        <ToneSelect value={priority} onChange={(v) => update(t.id, { priority: v })}
                          options={["high", "med", "low"].map((p) => [p, PRIORITY_LABEL[p]])} className={cn("h-5 text-[10px] print:hidden", PRIORITY_TONE[priority])} />
                        <DeadlinePicker task={t} slug={slug} period={period} onChange={(patch) => update(t.id, patch)} />
                        <button type="button" onClick={() => setTracking(t)} title="Ver trazabilidad"
                          className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand print:hidden">
                          <LucideIcon name="History" className="h-3.5 w-3.5" />
                          {(t.updates || []).length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-brand px-0.5 text-[7px] font-bold text-white">{(t.updates || []).length}</span>}
                        </button>
                        <button type="button" onClick={() => remove(t.id)} aria-label="Eliminar" className="edit-only h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive print:hidden"><LucideIcon name="Trash2" className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={add} className="edit-only ml-6 h-7 gap-1.5 text-xs text-muted-foreground print:hidden"><LucideIcon name="Plus" className="h-3.5 w-3.5" /> Agregar actividad</Button>
        </div>
        {tracking && window.TaskTrackingModal && (
          <window.TaskTrackingModal
            row={{ ...(tasks.find((x) => x.id === tracking.id) || tracking), origin: "campaign" }}
            canEdit={canEdit}
            onAddUpdate={(row, u) => addUpdate(tracking.id, u)}
            onClose={() => setTracking(null)} />
        )}
      </Block>
    );
  }

  /* ============== Critical pendings (sidebar widget, critical first) ============== */
  const PRIORITY_RANK = { high: 0, med: 1, low: 2 };
  function CriticalPendings({ slug, period }) {
    const { items, add, update, remove } = S.useGeneralPendings();
    const canCreate = S.useCan("createTasks");
    const canEdit = S.useCan("editTasks");
    const canDelete = S.useCan("deleteTasks");
    const [delId, setDelId] = useState(null);
    const linked = items.filter((i) => i.campaignSlug === slug && (!period || !i.period || i.period === period));
    const sorted = linked.slice().sort((a, b) => {
      const order = { blocked: 0, in_progress: 1, todo: 2, done: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    });
    const critical = sorted.filter((p) => p.status !== "done" && (p.status === "blocked" || p.priority === "high")).length;

    return (
      <Block icon="AlertTriangle" title="Pendientes críticos"
        action={canCreate ? <Button variant="ghost" size="sm" onClick={() => add({ campaignSlug: slug, period })} className="edit-only h-6 gap-1 px-1.5 text-[11px] text-muted-foreground print:hidden"><LucideIcon name="Plus" className="h-3 w-3" /></Button> : null}>
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-[11px] text-muted-foreground">
            Sin pendientes. <a href="#/pendientes" className="text-brand hover:underline">Ver todos</a>.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((p) => {
              const urgent = p.status !== "done" && (p.status === "blocked" || p.priority === "high");
              return (
                <li key={p.id} className={cn("rounded-xl border bg-surface/40 px-2.5 py-2", urgent ? "border-destructive/30" : "border-border/60", p.status === "done" && "opacity-60")}>
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[p.status])} />
                    <div className="min-w-0 flex-1">
                      {canEdit ? (
                        <input value={p.title || ""} onChange={(e) => update(p.id, { title: e.target.value })} placeholder="Pendiente…"
                          className={cn("w-full border-0 bg-transparent p-0 text-[13px] font-medium leading-snug outline-none focus:bg-surface focus:px-1 focus:rounded", p.status === "done" ? "text-muted-foreground line-through" : "text-foreground")} />
                      ) : (
                        <p className={cn("text-[13px] font-medium leading-snug", p.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>{p.title || "—"}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {canEdit ? (
                          <>
                            <ToneSelect value={p.priority || "med"} onChange={(v) => update(p.id, { priority: v })} options={["high","med","low"].map((x) => [x, PRIORITY_LABEL[x]])} className={cn("h-5 text-[10px]", PRIORITY_TONE[p.priority])} />
                            <ToneSelect value={p.status || "todo"} onChange={(v) => update(p.id, { status: v })} options={["todo","in_progress","blocked","done"].map((x) => [x, STATUS_LABEL[x]])} className={cn("h-5 text-[10px]", STATUS_TONE[p.status])} />
                          </>
                        ) : (
                          <>
                            <span className={cn("whitespace-nowrap rounded px-1.5 py-0.5 font-medium", PRIORITY_TONE[p.priority])}>{PRIORITY_LABEL[p.priority]}</span>
                            <span className={cn("whitespace-nowrap rounded px-1.5 py-0.5 font-medium", STATUS_TONE[p.status])}>{STATUS_LABEL[p.status]}</span>
                          </>
                        )}
                        {p.owner && <span className="inline-flex items-center gap-1 text-muted-foreground"><LucideIcon name="User" className="h-3 w-3" />{p.owner}</span>}
                        {p.deadline && <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground"><LucideIcon name="Calendar" className="h-3 w-3" />{p.deadline}</span>}
                      </div>
                    </div>
                    {canDelete && (
                      <button type="button" onClick={() => setDelId(p.id)} aria-label="Eliminar pendiente" className="edit-only shrink-0 text-muted-foreground hover:text-destructive print:hidden">
                        <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {sorted.length > 0 && <p className="mt-2 text-[10px] text-muted-foreground">{critical} crítico{critical === 1 ? "" : "s"} · <a href="#/pendientes" className="text-brand hover:underline">Ver todos los pendientes</a></p>}
        {delId && window.ConfirmDelete && <window.ConfirmDelete requireClave={false} title="Eliminar pendiente" message="Se eliminará este pendiente. Esta acción no se puede deshacer." confirmLabel="Eliminar" onClose={() => setDelId(null)} onConfirm={() => { remove(delId); setDelId(null); if (window.toast) window.toast("Pendiente eliminado"); }} />}
      </Block>
    );
  }

  /* ============== Brief page — cockpit layout ============== */
  const READER_KEY = "brief-reader-mode:v1";
  /* Deadline de tarea: fecha fija o referenciada a una fecha clave del brief
     (param + desfase en días). Las referenciadas se recalculan solas cuando
     cambian las fechas del periodo o al duplicar a otro periodo. */
  function DeadlinePicker({ task, slug, period, onChange }) {
    const { Popover } = window;
    const params = S.activeBriefParams(slug, period);
    const refParam = task.deadlineParamId ? params.find((p) => p.id === task.deadlineParamId) : null;
    const apply = (paramId, offset) => {
      if (!paramId) { onChange({ deadlineParamId: undefined, deadlineOffset: undefined }); return; }
      const iso = S.resolveParamISO(slug, period, paramId, offset);
      onChange({ deadlineParamId: paramId, deadlineOffset: Number(offset) || 0, ...(iso ? { deadline: iso } : {}) });
    };
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <window.DatePicker value={task.deadline || ""} disabled={!!task.deadlineParamId}
          onChange={(iso) => onChange({ deadline: iso })} placeholder="Sin fecha"
          className={cn("border-0 bg-transparent", refParam ? "text-brand" : "text-muted-foreground")} />
        <Popover align="end" width="w-56" trigger={
          <button type="button" className="edit-only flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface hover:text-foreground print:hidden"
            title={refParam ? `Referenciada a: ${refParam.label}` : "Referenciar a una fecha clave"}>
            <LucideIcon name="Anchor" className={cn("h-3 w-3", refParam && "text-brand")} />
          </button>
        }>
          {(setOpen) => (
            <div className="space-y-1.5 p-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Referencia de fecha</p>
              <select value={task.deadlineParamId || ""} onChange={(e) => apply(e.target.value, task.deadlineOffset || 0)}
                className="h-7 w-full cursor-pointer rounded-md border border-border bg-surface px-1.5 text-[11px] focus-visible:outline-none">
                <option value="">Fecha fija (manual)</option>
                {params.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {task.deadlineParamId && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Desfase</span>
                  <Input type="number" value={task.deadlineOffset ?? 0} onChange={(e) => apply(task.deadlineParamId, e.target.value)}
                    className="h-7 w-16 px-1.5 text-[11px] tabular-nums" />
                  <span className="text-[11px] text-muted-foreground">días</span>
                </div>
              )}
              <p className="text-[10px] leading-snug text-muted-foreground/80">Las fechas referenciadas se recalculan solas si la fecha clave cambia o al duplicar a otro periodo.</p>
            </div>
          )}
        </Popover>
      </div>
    );
  }

  function BriefPage({ slug }) {
    const [currentPeriod, setCurrentPeriod] = S.useCurrentPeriod();
    S.useAvailablePeriods();
    const periods = S.listAvailablePeriods();
    const q = (window.location.hash.split("?")[1] || "");
    const pParam = new URLSearchParams(q).get("p");
    const period = pParam || currentPeriod;

    const [reader, setReaderState] = useState(() => { try { return localStorage.getItem(READER_KEY) !== "0"; } catch { return true; } });
    const setReader = (v) => { setReaderState(v); try { localStorage.setItem(READER_KEY, v ? "1" : "0"); } catch {} };
    const canEdit = S.useCan("editTasks") || S.useCan("editCampaigns");
    const canEnable = S.useCan("editCampaigns");
    const configured = S.useConfigured(slug, period);
    const [promptOpen, setPromptOpen] = useState(true);
    const [setupMode, setSetupMode] = useState(null); // null | "duplicate" | "scratch"
    React.useEffect(() => { setPromptOpen(true); setSetupMode(null); }, [slug, period]);
    const effectiveReader = reader || !canEdit || !configured;
    const GRAY = "pointer-events-none select-none opacity-40 grayscale";

    const switchPeriod = (next) => { setCurrentPeriod(next); window.location.hash = `#/brief/${slug}?p=${next}`; };
    const campaign = S.campaigns.find((c) => c.slug === slug);

    /* En modo lector los campos no se pueden tocar (por diseño). Si la persona
       con permiso de edición hace clic donde editaría, se lo decimos y le damos
       el pase directo a Edición — evita el "no me deja escribir" (BUG-856C). */
    const readerHintAt = React.useRef(0);
    const onReaderClick = (e) => {
      if (!effectiveReader || !canEdit || !configured || reader === false) return;
      const sec = e.target.closest && e.target.closest(".brief-sections");
      if (!sec) return;
      const now = Date.now();
      if (now - readerHintAt.current < 4000) return; // no spamear
      readerHintAt.current = now;
      if (window.toast) window.toast("Estás en modo Lector — cambia a «Edición» (arriba) para modificar el brief");
    };

    return (
      <window.BriefProvider slug={slug} initialPeriod={period}>
        <div className={cn("min-h-screen bg-background", effectiveReader && "is-reader")} data-screen-label={`Brief · ${campaign ? campaign.title : slug}`} onClickCapture={onReaderClick}>
          <window.SectionWash accent="brand" />
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-5 pt-0 sm:px-6 lg:px-8 print:max-w-none print:px-6 print:py-6">
            <div className="sticky top-0 z-40 -mx-4 mb-5 flex h-14 items-center justify-between gap-3 overflow-hidden border-b border-border/60 bg-background/85 px-4 backdrop-blur-md print:hidden sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex shrink-0 items-center gap-3">
                <window.BackButton to="#/campanas" label="Volver a Campañas" />
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium shadow-soft">
                  <LucideIcon name="CalendarRange" className="h-3.5 w-3.5 text-brand" />
                  <span className="text-muted-foreground">Periodo</span>
                  <select value={period} onChange={(e) => switchPeriod(e.target.value)} className="cursor-pointer rounded-md border-0 bg-transparent px-1 text-xs font-medium focus-visible:outline-none">
                    {periods.map((pp) => <option key={pp} value={pp}>{S.formatPeriodLabel(pp)}</option>)}
                  </select>
                </div>
              </div>
              <window.BriefToolbar reader={effectiveReader} setReader={setReader} canEdit={canEdit} slug={slug} period={period} />
            </div>

            <div className={cn(!configured && GRAY)}>
              <window.ExecHeader reader={effectiveReader} setReader={setReader} canEdit={canEdit} slug={slug} period={period} />
            </div>

            {!configured && !promptOpen && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-accent-amber/50 bg-accent-amber/10 p-3.5 print:hidden" role="status">
                <LucideIcon name="Power" className="h-4 w-4 shrink-0 text-accent-amber" />
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">Brief sin configurar para {S.formatPeriodLabel(period)}</span> · solo lectura hasta habilitarlo.
                </p>
                {canEnable && (
                <button type="button" onClick={() => setPromptOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-[11.5px] font-medium text-background transition-colors hover:bg-foreground/90">
                  <LucideIcon name="Settings2" className="h-3 w-3" /> Configurar
                </button>
                )}
              </div>
            )}

            {!configured && promptOpen && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[3px] print:hidden">
                <div className="w-full max-w-lg rounded-3xl border border-border bg-surface-elevated p-6 shadow-elevated">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-amber/15 text-accent-amber">
                        <LucideIcon name="Power" className="h-6 w-6" strokeWidth={1.7} />
                      </span>
                      <div>
                        <h2 className="text-[17px] font-bold leading-snug text-foreground">Brief sin configurar</h2>
                        <p className="text-[12px] text-muted-foreground">{campaign ? campaign.title : slug} · {S.formatPeriodLabel(period)}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPromptOpen(false)} aria-label="Cerrar"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface">
                      <LucideIcon name="X" className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                    Esta campaña aún no está habilitada para este periodo. ¿Cómo quieres empezar?
                  </p>
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    <button type="button" disabled={!canEnable || !S.getPreviousConfiguredPeriod(slug, period)} onClick={() => { setSetupMode("duplicate"); setPromptOpen(false); }}
                      className="group rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-brand/50 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-40">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><LucideIcon name="Copy" className="h-5 w-5" /></span>
                      <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">Duplicar {S.getPreviousConfiguredPeriod(slug, period) ? S.formatPeriodShort(S.getPreviousConfiguredPeriod(slug, period)) : "anterior"}</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{S.getPreviousConfiguredPeriod(slug, period) ? `Copia la configuración de ${S.formatPeriodLabel(S.getPreviousConfiguredPeriod(slug, period))} (sin los completados).` : "No hay un periodo previo configurado."}</p>
                    </button>
                    <button type="button" disabled={!canEnable} onClick={() => { setSetupMode("scratch"); setPromptOpen(false); }}
                      className="group rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-brand/50 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-40">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-violet/10 text-accent-violet"><LucideIcon name="FilePlus2" className="h-5 w-5" /></span>
                      <p className="mt-2.5 text-[13.5px] font-semibold text-foreground">Crear desde cero</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">Empieza con un brief y checklist en blanco para este periodo.</p>
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    {!canEnable ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><LucideIcon name="Lock" className="h-3 w-3" /> Tu rol no puede habilitar campañas.</span>
                    ) : <span className="text-[11px] text-muted-foreground">También puedes cambiar de periodo arriba o volver atrás.</span>}
                    <button type="button" onClick={() => setPromptOpen(false)}
                      className="shrink-0 rounded-full border border-border bg-surface-elevated px-4 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface">
                      Ahora no
                    </button>
                  </div>
                </div>
              </div>
            )}
            {setupMode && !configured && (
              <window.SetupModal slug={slug} period={period} prevPeriod={S.getPreviousConfiguredPeriod(slug, period)} defaultMode={setupMode} onClose={() => setSetupMode(null)} />
            )}

            <div className={cn("brief-sections mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]", !configured && GRAY)}>
              <div className="min-w-0 space-y-5">
                <window.KeyDatesRoadmap />
                <window.CommunicationsCards />
                <OperativeChecklist slug={slug} period={period} />
                <window.BriefChangelog slug={slug} period={period} />
              </div>
              <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
                <CriticalPendings slug={slug} period={period} />
                <window.CampaignDetails />
                <window.ParamDatesMini />
              </aside>
            </div>

            <footer className="mt-10 border-t border-border pt-5 text-center text-xs text-muted-foreground print:mt-8">
              Brief ejecutivo · {S.formatPeriodLabel(period)} · Workspace de Campañas
            </footer>
          </main>
        </div>
      </window.BriefProvider>
    );
  }

  Object.assign(window, { OperativeChecklist, CriticalPendings, BriefPage });
})();
