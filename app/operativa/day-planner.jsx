/* Organizador del día — cronograma personal por horas.
   Arrastra pendientes de la semana al horario en que planeas hacerlos.
   Soporta drag & drop (desktop) y tocar-para-ubicar (móvil).
   Persistencia: localStorage "day-plan:v1" → { "<persona>|<fecha>": [{ id, taskKey, start, dur }] } */
(function () {
  const React = window.React;
  const { useState, useEffect, useMemo, useRef } = React;
  const { LucideIcon } = window;
  const cn = window.cn;

  const PLAN_KEY = "day-plan:v1";
  const PLAN_EVT = "day-plan-change";
  const readPlan = () => { try { return JSON.parse(localStorage.getItem(PLAN_KEY) || "{}") || {}; } catch { return {}; } };
  const writePlan = (p) => { try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); } catch {} window.dispatchEvent(new CustomEvent(PLAN_EVT)); };
  function usePlan() {
    const [plan, setPlan] = useState(readPlan);
    useEffect(() => {
      const on = () => setPlan(readPlan());
      window.addEventListener(PLAN_EVT, on); window.addEventListener("storage", on);
      return () => { window.removeEventListener(PLAN_EVT, on); window.removeEventListener("storage", on); };
    }, []);
    return plan;
  }

  const START = 7 * 60, END = 21 * 60, PXM = 0.8; /* 48px por hora */
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtHM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  const weekDays = () => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const mon = new Date(t.getTime() - ((t.getDay() + 6) % 7) * 86400000);
    return [...Array(7)].map((_, i) => new Date(mon.getTime() + i * 86400000));
  };

  function DayPlanner({ tasks, person, canEdit, onExec, execKey, embedded }) {
    const plan = usePlan();
    const [date, setDate] = useState(isoDate(new Date()));
    const [selected, setSelected] = useState(null); /* taskKey en modo tocar-para-ubicar */
    /* Vista previa del arrastre: { mins, dur, label } snapeado a 15' (BUG-D365) */
    const [ghost, setGhost] = useState(null);
    const dragInfo = useRef(null); /* qué se está arrastrando (HTML5 DnD no expone data en dragover) */
    const wrapRef = useRef(null);
    /* Hora actual en vivo: la línea "ahora" se mueve sola cada 30 s */
    const [nowTick, setNowTick] = useState(Date.now());
    useEffect(() => {
      const t = setInterval(() => setNowTick(Date.now()), 30000);
      return () => clearInterval(t);
    }, []);
    const storeKey = `${person}|${date}`;
    const taskByKey = useMemo(() => { const m = {}; tasks.forEach((t) => { m[`${t.origin}-${t.id}`] = t; }); return m; }, [tasks]);
    const rawEntries = plan[storeKey] || [];
    /* Si un pendiente fue eliminado, su bloque planificado queda huérfano: se
       filtra del render y se purga del almacenamiento (BUG-D11F). */
    const entries = useMemo(() => rawEntries.filter((e) => taskByKey[e.taskKey]), [rawEntries, taskByKey]);
    useEffect(() => {
      if (rawEntries.length !== entries.length) {
        writePlan({ ...readPlan(), [storeKey]: entries });
      }
    }, [rawEntries.length, entries.length, storeKey]);

    useEffect(() => { setSelected(null); }, [person, date]);

    /* Pendientes ya planificados por esta persona en cualquier día de la semana */
    const plannedMap = useMemo(() => {
      const m = {};
      Object.keys(plan).forEach((k) => {
        if (!k.startsWith(`${person}|`)) return;
        const d = k.split("|")[1];
        (plan[k] || []).forEach((e) => { m[e.taskKey] = { date: d, start: e.start }; });
      });
      return m;
    }, [plan, person]);

    const unplanned = tasks.filter((t) => t.status !== "done" && !plannedMap[`${t.origin}-${t.id}`]);

    const save = (next) => writePlan({ ...readPlan(), [storeKey]: next });
    const place = (taskKey, mins) => {
      if (!canEdit) return;
      const t = taskByKey[taskKey];
      const dur = (t && t.estimateMin) || 30;
      const start = Math.max(START, Math.min(END - dur, Math.round(mins / 15) * 15));
      save([...entries, { id: uid(), taskKey, start, dur }]);
      setSelected(null);
    };
    const move = (entryId, mins) => {
      const e = entries.find((x) => x.id === entryId); if (!e) return;
      const start = Math.max(START, Math.min(END - e.dur, Math.round(mins / 15) * 15));
      save(entries.map((x) => x.id === entryId ? { ...x, start } : x));
    };
    const resize = (entryId, delta) => {
      save(entries.map((x) => x.id === entryId ? { ...x, dur: Math.max(15, Math.min(END - x.start, x.dur + delta)) } : x));
    };
    const removeEntry = (entryId) => save(entries.filter((x) => x.id !== entryId));

    const minsFromEvent = (e) => {
      const rect = wrapRef.current.getBoundingClientRect();
      return START + (e.clientY - rect.top) / PXM;
    };
    const snap15 = (mins, dur) => Math.max(START, Math.min(END - dur, Math.round(mins / 15) * 15));
    const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const onDragOverGrid = (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      const info = dragInfo.current; if (!info) return;
      const dur = info.dur || 30;
      const start = snap15(minsFromEvent(e) - dur / 2, dur);
      setGhost({ mins: start, dur, label: info.label || "" });
    };
    const onDrop = (e) => {
      e.preventDefault();
      setGhost(null);
      let data; try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { data = dragInfo.current; }
      dragInfo.current = null;
      if (!data) return;
      const dur = data.dur || 30;
      const mins = snap15(minsFromEvent(e) - dur / 2, dur);
      if (data.type === "task") place(data.key, mins);
      else if (data.type === "entry") move(data.id, mins);
    };

    /* Carriles para solapes */
    const laid = useMemo(() => {
      const sorted = [...entries].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
      const laneEnds = [];
      return sorted.map((en) => {
        let lane = 0;
        while ((laneEnds[lane] || 0) > en.start) lane++;
        laneEnds[lane] = en.start + en.dur;
        return { ...en, lane };
      });
    }, [JSON.stringify(entries)]);

    const now = new Date(nowTick);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isToday = date === isoDate(now);
    const days = weekDays();
    const hours = []; for (let h = START / 60; h <= END / 60; h++) hours.push(h);
    const plannedToday = entries.length;

    return (
      <div className={cn("rounded-2xl border border-border bg-surface-elevated p-4", embedded && "h-full")}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand/10 text-brand">
              <LucideIcon name="CalendarClock" className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Organizador del día</h2>
              <p className="text-[11px] text-muted-foreground">Arrastra tus pendientes al horario en que planeas hacerlos{plannedToday ? ` · ${plannedToday} planificado${plannedToday === 1 ? "" : "s"}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map((d, i) => {
              const iso = isoDate(d);
              const today = iso === isoDate(new Date());
              const count = (plan[`${person}|${iso}`] || []).length;
              return (
                <button key={iso} type="button" onClick={() => setDate(iso)}
                  className={cn("relative flex h-8 min-w-[44px] shrink-0 flex-col items-center justify-center rounded-full px-2.5 leading-none transition-colors",
                    date === iso ? "bg-surface-elevated text-foreground shadow-soft" : "text-foreground/55 hover:text-foreground")}>
                  <span className="text-[9px] font-semibold uppercase tracking-wide">{DOW[i]}</span>
                  <span className={cn("mt-0.5 text-[11px] font-bold tabular-nums", today && "text-brand")}>{d.getDate()}</span>
                  {count > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand"></span>}
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-1.5 text-[11px] font-medium text-brand">
            <LucideIcon name="MousePointerClick" className="h-3.5 w-3.5" /> Toca una hora del cronograma para ubicar «{(taskByKey[selected] || {}).title || "el pendiente"}».
          </p>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-[250px,1fr]">
          {/* Sin planificar */}
          <div className="rounded-xl border border-border bg-surface p-2">
            <p className="px-1.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sin planificar · {unplanned.length}</p>
            <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-0.5">
              {unplanned.length === 0 && (
                <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">Todo planificado. 🎯</p>
              )}
              {unplanned.map((t) => {
                const key = `${t.origin}-${t.id}`;
                return (
                  <div key={key} draggable={canEdit}
                    onDragStart={(e) => { const t = taskByKey[key]; dragInfo.current = { type: "task", key, dur: (t && t.estimateMin) || 30, label: t && t.title }; e.dataTransfer.setData("text/plain", JSON.stringify({ type: "task", key })); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { dragInfo.current = null; setGhost(null); }}
                    onClick={() => canEdit && setSelected(selected === key ? null : key)}
                    className={cn("cursor-grab rounded-lg border bg-surface-elevated p-2 transition-colors active:cursor-grabbing",
                      selected === key ? "border-brand ring-1 ring-brand/30" : "border-border hover:border-foreground/25")}>
                    <p className="truncate text-[12px] font-medium text-foreground" title={t.title}>{t.title || "—"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5"><LucideIcon name="Timer" className="h-3 w-3" />{t.estimateMin ? `~${t.estimateMin} min` : "~30 min"}</span>
                      {t.overdue && <span className="font-semibold text-destructive">Retrasada</span>}
                      {t.daysLeft === 0 && <span className="font-semibold text-accent-amber">Vence hoy</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cronograma */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div ref={wrapRef} className="relative"
              style={{ height: (END - START) * PXM }}
              onDragOver={onDragOverGrid}
              onDragLeave={(e) => { if (!wrapRef.current.contains(e.relatedTarget)) setGhost(null); }}
              onDrop={onDrop}
              onClick={(e) => { if (selected) place(selected, snap15(minsFromEvent(e) - 15, 30)); }}>
              {/* Fantasma del arrastre: muestra DÓNDE caerá y a qué hora (BUG-D365) */}
              {ghost && (
                <div className="pointer-events-none absolute inset-x-8 z-20 rounded-lg border-2 border-dashed border-brand bg-brand/10"
                  style={{ top: (ghost.mins - START) * PXM, height: ghost.dur * PXM }}>
                  <span className="absolute -top-2.5 left-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm">
                    {fmtMin(ghost.mins)} – {fmtMin(ghost.mins + ghost.dur)}
                  </span>
                </div>
              )}
              {hours.map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: (h * 60 - START) * PXM }}>
                  <span className="absolute left-1.5 top-0.5 text-[9px] font-medium tabular-nums text-muted-foreground/80">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
              {isToday && nowMin >= START && nowMin <= END && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMin - START) * PXM }}>
                  <div className="h-[2px] bg-destructive shadow-[0_0_6px_rgba(220,38,38,0.5)]"></div>
                  <span className="absolute -top-[3px] left-0 h-2 w-2 rounded-full bg-destructive"></span>
                  <span className="absolute -top-[9px] right-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold tabular-nums leading-none text-white">
                    {fmtHM(nowMin)}
                  </span>
                </div>
              )}
              {laid.map((en) => {
                const t = taskByKey[en.taskKey];
                const isDone = t && t.status === "done";
                const inExec = t && execKey === `${t.origin}-${t.id}`;
                return (
                  <div key={en.id} draggable={canEdit}
                    onDragStart={(e) => { e.stopPropagation(); dragInfo.current = { type: "entry", id: en.id, dur: en.dur || 30, label: (taskByKey[en.taskKey] || {}).title }; e.dataTransfer.setData("text/plain", JSON.stringify({ type: "entry", id: en.id })); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { dragInfo.current = null; setGhost(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn("group absolute cursor-grab overflow-hidden rounded-lg border px-2 py-1 active:cursor-grabbing",
                      isDone ? "border-accent-green/40 bg-accent-green/10" : inExec ? "border-brand bg-brand/15 ring-1 ring-brand/30" : "border-brand/35 bg-brand/10 hover:bg-brand/15")}
                    style={{ top: (en.start - START) * PXM, height: Math.max(22, en.dur * PXM - 2), left: `calc(44px + ${en.lane * 18}px)`, right: 8 }}>
                    <p className={cn("truncate text-[11px] font-semibold leading-tight", isDone ? "text-accent-green line-through" : "text-brand")} title={t ? t.title : "Pendiente"}>
                      {t ? (t.title || "—") : "Pendiente eliminado"}
                    </p>
                    {en.dur >= 30 && (
                      <p className={cn("text-[9.5px] tabular-nums leading-tight", isDone ? "text-accent-green/70" : "text-brand/70")}>
                        {fmtHM(en.start)}–{fmtHM(en.start + en.dur)} · {en.dur} min
                      </p>
                    )}
                    {canEdit && (
                      <span className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex">
                        {t && !isDone && !inExec && onExec && (
                          <button type="button" title="Poner en ejecución" onClick={() => onExec(t)}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated text-brand shadow-soft hover:bg-brand hover:text-white">
                            <LucideIcon name="Play" className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {!isDone && (
                          <button type="button" title="15 min menos" onClick={() => resize(en.id, -15)}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated text-muted-foreground shadow-soft hover:text-foreground">
                            <LucideIcon name="Minus" className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {!isDone && (
                          <button type="button" title="15 min más" onClick={() => resize(en.id, 15)}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated text-muted-foreground shadow-soft hover:text-foreground">
                            <LucideIcon name="Plus" className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <button type="button" title="Quitar del plan" onClick={() => removeEntry(en.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated text-muted-foreground shadow-soft hover:bg-destructive/10 hover:text-destructive">
                          <LucideIcon name="X" className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.DayPlanner = DayPlanner;
})();
