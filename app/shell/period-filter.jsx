/* PeriodFilter — filtro de periodo compartido: Todos · varios · solo 1.
   Selección por sección (se restablece al salir). Popover en portal para
   sobrevivir a toolbars con overflow oculto. */
(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState, useRef, useEffect } = React;
  const { LucideIcon } = window;
  const cn = window.cn;

  function PeriodFilter({ defaultMode = "all" }) {
    const S = window.Store;
    S.useAvailablePeriods();
    const periods = S.listAvailablePeriods();
    const { value, periods: sel, set, isFiltered } = S.useSelectedPeriods(defaultMode);
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const [pos, setPos] = useState(null);

    const isAll = value === "all" || (Array.isArray(value) && value.length >= periods.length);
    const label = isAll ? "Todos los periodos"
      : sel.length === 1 ? S.formatPeriodLabel(sel[0])
      : `${sel.length} periodos`;

    const openPopover = () => {
      const r = btnRef.current.getBoundingClientRect();
      const width = 240;
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) });
      setOpen(true);
    };
    useEffect(() => {
      if (!open) return;
      const close = () => setOpen(false);
      window.addEventListener("resize", close);
      window.addEventListener("hashchange", close);
      return () => { window.removeEventListener("resize", close); window.removeEventListener("hashchange", close); };
    }, [open]);

    const togglePeriod = (p) => {
      const base = isAll ? periods.slice() : sel;
      const next = base.includes(p) ? base.filter((x) => x !== p) : [...base, p];
      if (!next.length || next.length >= periods.length) set("all");
      else set(next);
    };
    const checked = (p) => isAll || sel.includes(p);

    return (
      <React.Fragment>
        <button ref={btnRef} type="button" onClick={() => open ? setOpen(false) : openPopover()} aria-expanded={open}
          title={isFiltered ? "Filtro de esta sección — se restablece al salir" : "Filtrar por periodo"}
          className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border bg-surface-elevated px-3 text-xs font-medium shadow-soft transition-colors hover:border-foreground/30",
            isFiltered ? "border-brand/40" : "border-border")}>
          <LucideIcon name="CalendarRange" className="h-3.5 w-3.5 text-brand" />
          <span className="text-muted-foreground">Periodo</span>
          {isFiltered && <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>}
          <span className="font-semibold tabular-nums text-foreground">{label}</span>
          <LucideIcon name="ChevronDown" className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && pos && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[90]">
            <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="absolute inset-0 w-full cursor-default"></button>
            <div className="absolute w-[240px] rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-elevated" style={{ top: pos.top, left: pos.left }}>
              <button type="button" onClick={() => { set("all"); }}
                className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors hover:bg-surface", isAll ? "text-foreground" : "text-muted-foreground")}>
                Todos los periodos
                {isAll && <LucideIcon name="Check" className="h-3.5 w-3.5 text-brand" />}
              </button>
              <div className="mx-2 my-1 h-px bg-border/70"></div>
              {periods.map((p) => (
                <div key={p} className="group/pf flex items-center gap-1 rounded-lg transition-colors hover:bg-surface">
                  <button type="button" onClick={() => togglePeriod(p)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                      checked(p) && !isAll ? "border-brand bg-brand text-white" : isAll ? "border-brand/40 bg-brand/15 text-brand" : "border-border bg-surface")}>
                      {checked(p) && <LucideIcon name="Check" className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className={cn("truncate text-[12.5px] font-medium tabular-nums", checked(p) ? "text-foreground" : "text-muted-foreground")}>{S.formatPeriodLabel(p)}</span>
                  </button>
                  <button type="button" onClick={() => { set([p]); }}
                    title={`Ver solo ${S.formatPeriodLabel(p)}`}
                    className="mr-1.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-brand opacity-0 transition-opacity hover:bg-brand/10 focus-visible:opacity-100 group-hover/pf:opacity-100">
                    Solo
                  </button>
                </div>
              ))}
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] leading-snug text-muted-foreground/80">Filtro de esta sección — se restablece al salir.</p>
            </div>
          </div>,
          document.body
        )}
      </React.Fragment>
    );
  }

  window.PeriodFilter = PeriodFilter;
})();
