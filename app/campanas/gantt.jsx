/* Reusable Gantt timeline — fixed px/day scale, daily grid, month separators (snapped to week),
   day numbers, "Hoy" line, fixed label column + scrollable track, bars + optional planning markers.
   Used by Cronograma de comunicaciones and Cronograma de campañas. */
(function () {
  const React = window.React;
  const { useRef, useEffect, useLayoutEffect } = React;
  const cn = window.cn;
  const { LucideIcon } = window;

  const MS = 86400000;
  const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const today0 = () => day0(new Date());
  const fmtFull = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtDM = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

  /*
    lines: array of:
      { type: "group", label, color }                                  // section header
      { type: "bar", label, color, start, end, text?, marker?, href? } // a timeline row
    props: pxDay, gutter, rowH, groupGap, nav (show navigator), legend (bool)
  */
  function GanttTimeline({ lines, pxDay = 10, gutter = 150, rowH = 18, groupGap = 10, nav = true, legend = false, emptyText = "Sin datos para mostrar." }) {
    const scrollRef = useRef(null);

    const bars = lines.filter((l) => l.type === "bar");
    const dated = bars.filter((l) => l.start && l.end);
    if (dated.length === 0) {
      return <p className="rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-[12px] text-muted-foreground">{emptyText}</p>;
    }

    // Bounds (always include today).
    const all = [today0().getTime()];
    bars.forEach((l) => { [l.start, l.end, l.marker].forEach((d) => { if (d) all.push(day0(d).getTime()); }); });
    let min = new Date(Math.min(...all)); min.setHours(0, 0, 0, 0);
    let max = new Date(Math.max(...all)); max.setHours(0, 0, 0, 0);

    const dayIndex = (d) => Math.round((day0(d).getTime() - min.getTime()) / MS);
    const totalDays = Math.min(1200, Math.max(1, dayIndex(max) + 2));
    const trackWidth = totalDays * pxDay;
    const dayX = (d) => dayIndex(d) * pxDay;
    const t = today0();
    const todayX = (t >= min && t <= max) ? dayX(t) : null;

    // Month ticks snapped to week start (Monday) so month cuts land on the grid.
    const ticks = []; { const cur = new Date(min); cur.setDate(1); let g = 0; while (cur <= max && g++ < 120) { if (cur >= min) { const s = new Date(cur); const wd = (s.getDay() + 6) % 7; s.setDate(s.getDate() - wd); if (s < min) s.setTime(min.getTime()); ticks.push({ pos: s, label: new Date(cur) }); } cur.setMonth(cur.getMonth() + 1); } }
    const mondays = []; { const c = new Date(min); const wd = (c.getDay() + 6) % 7; c.setDate(c.getDate() + ((7 - wd) % 7)); let g = 0; while (c <= max && g++ < 200) { mondays.push(new Date(c)); c.setDate(c.getDate() + 7); } }
    const days = []; { const d = new Date(min); let g = 0; while (d <= max && g++ < 1200) { days.push(new Date(d)); d.setDate(d.getDate() + 1); } }
    const isMonday = (d) => ((d.getDay() + 6) % 7) === 0;

    // Vertical placement.
    let y = 0;
    const placed = lines.map((ln, idx) => {
      const top = y; y += rowH + (ln.type === "group" ? 2 : 3);
      if (ln.type === "bar" && lines[idx + 1] && lines[idx + 1].type === "group") y += groupGap;
      return { ...ln, top };
    });
    const totalH = y;

    const scrollDays = (n) => { const el = scrollRef.current; if (el) el.scrollLeft = Math.max(0, el.scrollLeft + n * pxDay); };
    const scrollToToday = () => { const el = scrollRef.current; if (el && todayX != null) el.scrollLeft = Math.max(0, todayX - el.clientWidth / 2); };
    // Always open centered on today (defer until the flex track has width).
    useEffect(() => {
      let tries = 0;
      const center = () => {
        const el = scrollRef.current;
        if (!el || todayX == null) return;
        if (el.clientWidth > 0) { el.scrollLeft = Math.max(0, todayX - el.clientWidth / 2); }
        else if (tries++ < 10) requestAnimationFrame(center);
      };
      requestAnimationFrame(center);
    }, [todayX, trackWidth]);

    return (
      <div>
        {nav && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Línea de tiempo · día / semana (lun)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => scrollDays(-28)} aria-label="Retroceder" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"><LucideIcon name="ChevronLeft" className="h-4 w-4" /></button>
              <button type="button" onClick={scrollToToday} className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"><LucideIcon name="Crosshair" className="h-3.5 w-3.5" /> Hoy</button>
              <button type="button" onClick={() => scrollDays(28)} aria-label="Avanzar" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"><LucideIcon name="ChevronRight" className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        <div className="flex">
          {/* Fixed label column */}
          <div className="shrink-0" style={{ width: `${gutter}px` }}>
            <div style={{ height: "32px", marginBottom: "4px" }} />
            <div style={{ position: "relative", height: `${totalH}px` }}>
              {placed.map((ln, i) => ln.type === "group" ? (
                ln.onToggle ? (
                  <button key={i} type="button" onClick={ln.onToggle} title={ln.collapsed ? "Expandir" : "Comprimir"}
                    className="absolute left-0 right-0 flex items-center gap-1 pr-2 text-left transition-colors hover:text-brand" style={{ top: `${ln.top}px`, height: `${rowH}px` }}>
                    <LucideIcon name={ln.collapsed ? "ChevronRight" : "ChevronDown"} className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", typeof ln.color === "string" && ln.color.startsWith("#") ? "" : ln.color)} style={typeof ln.color === "string" && ln.color.startsWith("#") ? { backgroundColor: ln.color } : undefined} />
                    <span className="truncate text-[11px] font-semibold text-foreground">{ln.label}</span>
                  </button>
                ) : (
                <div key={i} className="absolute left-0 right-0 flex items-center gap-1.5 pr-2" style={{ top: `${ln.top}px`, height: `${rowH}px` }}>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", typeof ln.color === "string" && ln.color.startsWith("#") ? "" : ln.color)} style={typeof ln.color === "string" && ln.color.startsWith("#") ? { backgroundColor: ln.color } : undefined} />
                  <span className="truncate text-[11px] font-semibold text-foreground">{ln.label}</span>
                </div>
                )
              ) : (
                <div key={i} className="absolute left-0 right-0 flex items-center gap-1.5 pr-2" style={{ top: `${ln.top}px`, height: `${rowH}px` }}>
                  {ln.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", ln.color)} />}
                  {ln.href ? (
                    <a href={ln.href} className={cn("truncate text-[10px] hover:text-brand", ln.dot ? "font-medium text-foreground" : "pl-2 text-muted-foreground")} title={ln.label}>{ln.label}</a>
                  ) : (
                    <span className={cn("truncate text-[10px]", ln.dot ? "font-medium text-foreground" : "pl-2 text-muted-foreground")} title={ln.label}>{ln.label}</span>
                  )}
                  {ln.sublabel && <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{ln.sublabel}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable track */}
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: `${trackWidth}px`, position: "relative" }}>
              {/* Header: months + day numbers */}
              <div className="relative" style={{ height: "32px", marginBottom: "4px" }}>
                {ticks.map((tk, i) => (
                  <span key={"m" + i} className="absolute top-0 whitespace-nowrap pl-1 text-[10px] font-semibold uppercase tracking-wide text-foreground" style={{ left: `${dayX(tk.pos)}px` }}>
                    {tk.label.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })}
                  </span>
                ))}
                {mondays.map((m, i) => (
                  <span key={"wd" + i} className="absolute -translate-x-1/2 whitespace-nowrap text-[8px] tabular-nums text-muted-foreground" style={{ left: `${dayX(m)}px`, top: "16px" }}>{m.getDate()}</span>
                ))}
                {todayX != null && <span className="absolute top-0 -translate-x-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white" style={{ left: `${todayX}px` }}>Hoy</span>}
              </div>

              {/* Rows region */}
              <div className="relative" style={{ height: `${totalH}px` }}>
                {placed.filter((l) => l.type === "bar").map((ln, i) => (
                  <div key={"r" + i} className="absolute left-0 right-0 rounded bg-surface/70" style={{ top: `${ln.top}px`, height: `${rowH}px` }} />
                ))}
                {days.map((d, i) => (
                  <div key={"d" + i} className={cn("pointer-events-none absolute inset-y-0 w-px", isMonday(d) ? "z-[2] bg-muted-foreground/25" : "z-[1] bg-muted-foreground/10")} style={{ left: `${dayX(d)}px` }} />
                ))}
                {ticks.map((tk, i) => (
                  <div key={"ml" + i} className="pointer-events-none absolute inset-y-0 z-[3] w-px bg-muted-foreground/50" style={{ left: `${dayX(tk.pos)}px` }} />
                ))}
                {todayX != null && <div className="pointer-events-none absolute inset-y-0 z-[4] w-0.5 bg-destructive" style={{ left: `${todayX}px` }} />}
                {placed.filter((l) => l.type === "bar").map((ln, i) => {
                  const hasWin = ln.start && ln.end;
                  const left = hasWin ? dayX(ln.start) : 0, width = hasWin ? Math.max(8, dayX(ln.end) - dayX(ln.start)) : 0;
                  return (
                    <React.Fragment key={"b" + i}>
                      {ln.marker && ln.start && day0(ln.marker) < day0(ln.start) && (
                        <div className="pointer-events-none absolute z-[5] h-0.5 -translate-y-1/2 rounded bg-muted-foreground/40" style={{ left: `${dayX(ln.marker)}px`, width: `${Math.max(2, dayX(ln.start) - dayX(ln.marker))}px`, top: `${ln.top + rowH / 2}px` }} />
                      )}
                      {ln.marker && (
                        <span className="absolute z-[6] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border border-surface-elevated bg-muted-foreground/70" style={{ left: `${dayX(ln.marker)}px`, top: `${ln.top + rowH / 2}px` }} title={`Planificación · ${fmtFull(ln.marker)}`} />
                      )}
                      {hasWin ? (
                        <div className={cn("absolute z-[6] flex items-center justify-center overflow-hidden rounded opacity-90", typeof ln.color === "string" && ln.color.startsWith("#") ? "" : ln.color)}
                          style={{ left: `${left}px`, width: `${width}px`, top: `${ln.top}px`, height: `${rowH}px`, ...(typeof ln.color === "string" && ln.color.startsWith("#") ? { backgroundColor: ln.color } : {}) }} title={`${ln.text ? ln.text + " · " : ""}${fmtFull(ln.start)} → ${fmtFull(ln.end)}`}>
                          <span className="truncate px-1 text-[8px] font-semibold text-white">{ln.text || `${fmtDM(ln.start)} → ${fmtDM(ln.end)}`}</span>
                        </div>
                      ) : (
                        <span className="absolute z-[6] text-[9px] text-muted-foreground" style={{ left: "4px", top: `${ln.top + 3}px` }}>Sin fechas</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {legend && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-muted-foreground/70" /> Inicio de planificación</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-4 rounded bg-brand" /> Ventana (inicio → fin)</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-px bg-muted-foreground/25" /> Día / semana</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-px bg-muted-foreground/50" /> Mes</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-0.5 bg-destructive" /> Hoy</span>
          </div>
        )}
      </div>
    );
  }

  window.GanttTimeline = GanttTimeline;
})();
