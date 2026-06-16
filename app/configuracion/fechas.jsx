/* Global parameter dates — configure base dates once per period; campaigns inherit them. */
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, toast } = window;
  const cn = window.cn;

  function GlobalParamsPage() {
    const [currentPeriod, setCurrentPeriod] = S.useCurrentPeriod();
    S.useAvailablePeriods();
    const periods = S.listAvailablePeriods();
    const [period, setPeriod] = useState(currentPeriod);
    const [modal, setModal] = useState(null);
    const canManagePeriods = S.useCan("managePeriods");
    useEffect(() => { setPeriod(currentPeriod); }, [currentPeriod]);
    const params = S.useGlobalParams(period);
    const configured = S.hasGlobalParams(period);
    const canEdit = S.useCan("managePeriods") || S.useCan("editCampaigns");
    // BUG-98B0: editar fechas parámetro exige clave. Una vez verificada, quedan
    // editables por la sesión (hasta recargar). El candado las vuelve a bloquear.
    const [unlocked, setUnlocked] = useState(false);
    const [askUnlock, setAskUnlock] = useState(false);
    const editable = canEdit && unlocked;

    // How many campaigns are configured in this period (they inherit these dates).
    const campaigns = S.useCampaigns();
    const usingCount = campaigns.filter((c) => S.isCampaignConfigured(c.slug, period)).length;

    const update = (id, patch) => S.writeGlobalParams(period, params.map((p) => p.id === id ? { ...p, ...patch } : p));
    const add = () => S.writeGlobalParams(period, [...params, { id: S.uuid(), label: "Nueva fecha", date: "" }]);
    const remove = (id) => S.writeGlobalParams(period, params.filter((p) => p.id !== id));
    const [confirmDel, setConfirmDel] = useState(null); // param a eliminar | { reset: true }
    const resetToDefault = () => setConfirmDel({ reset: true });

    const sorted = params.slice().filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date));
    const fmt = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); };

    return (
      <div className="min-h-screen bg-background" data-screen-label="Fechas parámetro del periodo">
        <window.SectionWash accent="slate" />
        <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/" left={
            <div className="inline-flex items-center gap-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium shadow-soft">
                <LucideIcon name="CalendarRange" className="h-3.5 w-3.5 text-brand" />
                <span className="text-muted-foreground">Periodo</span>
                <select value={period} onChange={(e) => { setPeriod(e.target.value); setCurrentPeriod(e.target.value); }} className="cursor-pointer rounded-md border-0 bg-transparent px-1 text-xs font-medium focus-visible:outline-none">
                  {periods.map((p) => <option key={p} value={p}>{S.formatPeriodLabel(p)}</option>)}
                </select>
              </div>
              {canManagePeriods &&
                <button type="button" onClick={() => setModal("period")} title="Nuevo periodo"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground shadow-soft transition-colors hover:border-foreground/30 hover:text-foreground">
                  <LucideIcon name="Plus" className="h-4 w-4" />
                </button>}
              {canManagePeriods && periods.length > 1 &&
                <button type="button" onClick={() => setModal("delPeriod")} title="Eliminar este periodo"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground shadow-soft transition-colors hover:border-destructive/40 hover:text-destructive">
                  <LucideIcon name="Trash2" className="h-4 w-4" />
                </button>}
            </div>
          } />

          <window.SectionHeader accent="slate" icon="CalendarCog" title="Fechas parámetro del periodo" subtitle="Configúralas una vez por periodo. Las campañas dentro del periodo las heredan." />

          {/* status banner */}
          <div className={cn("mb-4 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5", configured ? "border-accent-green/30 bg-accent-green/5" : "border-border bg-surface/50")}>
            <LucideIcon name={configured ? "CheckCircle2" : "Info"} className={cn("h-4 w-4 shrink-0", configured ? "text-accent-green" : "text-muted-foreground")} />
            <p className="text-[12px] text-muted-foreground">
              {configured
                ? <>Fechas configuradas para <span className="font-medium text-foreground">{S.formatPeriodLabel(period)}</span>. </>
                : <>Aún sin configurar — define las fechas de este periodo. </>}
              <span className="font-medium text-foreground">{usingCount}</span> campaña{usingCount === 1 ? "" : "s"} activa{usingCount === 1 ? "" : "s"} en este periodo {usingCount === 1 ? "hereda" : "heredan"} estas fechas.
            </p>
          </div>

          <section className="rounded-2xl border border-border/70 bg-surface-elevated p-4 shadow-soft sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><LucideIcon name="Sliders" className="h-3.5 w-3.5" /> Fechas base</h2>
              {canEdit && (
                <div className="flex items-center gap-1.5">
                  {!unlocked ? (
                    <Button variant="ghost" size="sm" onClick={() => setAskUnlock(true)} className="h-7 gap-1 px-2 text-[11px] text-muted-foreground" title="Desbloquear edición con tu clave">
                      <LucideIcon name="Lock" className="h-3 w-3" /> Desbloquear edición
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setUnlocked(false)} className="h-7 gap-1 px-2 text-[11px] text-accent-green" title="Bloquear de nuevo">
                        <LucideIcon name="LockOpen" className="h-3 w-3" /> Edición activa
                      </Button>
                      <Button variant="ghost" size="sm" onClick={resetToDefault} className="h-7 gap-1 px-1.5 text-[11px] text-muted-foreground"><LucideIcon name="RotateCcw" className="h-3 w-3" /> Restablecer</Button>
                      <Button size="sm" onClick={add} className="h-7 gap-1 px-2 text-[11px]"><LucideIcon name="Plus" className="h-3 w-3" /> Agregar fecha</Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {params.map((p) => (
                <div key={p.id} className="group/p rounded-xl border border-border/60 bg-surface/40 p-3">
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <Input value={p.label} onChange={(e) => update(p.id, { label: e.target.value })} placeholder="Nombre de la fecha" readOnly={!editable}
                      className="h-6 flex-1 border-0 bg-transparent p-0 text-[12px] font-medium text-muted-foreground shadow-none focus-visible:ring-0" />
                    {editable && <button type="button" onClick={() => setConfirmDel(p)} aria-label="Eliminar" className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive group-hover/p:flex"><LucideIcon name="X" className="h-3.5 w-3.5" /></button>}
                  </div>
                  <Input type="date" value={p.date} onChange={(e) => update(p.id, { date: e.target.value })} readOnly={!editable}
                    className="h-8 border-0 bg-transparent p-0 text-lg font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0" />
                </div>
              ))}
            </div>
            {params.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">Este periodo aún no tiene fechas parámetro.</p>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" onClick={() => { S.writeGlobalParams(period, S.defaultParams.map((x) => ({ ...x, date: "" }))); toast("Fechas base cargadas — completa cada fecha"); }} className="h-8 gap-1.5 text-xs">
                      <LucideIcon name="Sparkles" className="h-3.5 w-3.5" /> Empezar con las fechas base
                    </Button>
                    <Button variant="outline" size="sm" onClick={add} className="h-8 gap-1.5 text-xs">
                      <LucideIcon name="Plus" className="h-3.5 w-3.5" /> Agregar una fecha
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!canEdit && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><LucideIcon name="Lock" className="h-3 w-3" /> Tu rol no puede editar las fechas del periodo.</p>}
          </section>

          {/* timeline preview */}
          {sorted.length > 0 && (
            <section className="mt-4 rounded-2xl border border-border/70 bg-surface-elevated p-4 shadow-soft sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><LucideIcon name="GitCommitHorizontal" className="h-3.5 w-3.5" /> Secuencia</h2>
              <ol className="relative space-y-2 border-l border-border/70 pl-4">
                {sorted.map((p) => (
                  <li key={p.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface-elevated" />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-foreground">{p.label}</span>
                      <span className="text-[12px] tabular-nums text-muted-foreground">{fmt(p.date)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Las campañas pueden personalizar sus fechas desde el brief si necesitan un caso especial.
          </p>
        </main>
        {modal === "period" && <window.NewPeriodModal onClose={() => setModal(null)} />}
        {modal === "delPeriod" && window.ConfirmDelete && (
          <window.ConfirmDelete
            title="Eliminar periodo"
            message={`Se quitará el periodo «${S.formatPeriodLabel(period)}» del selector. Los datos guardados bajo ese periodo no se borran: si lo vuelves a agregar, reaparecen.`}
            confirmLabel="Eliminar periodo"
            onClose={() => setModal(null)}
            onConfirm={() => {
              const next = periods.find((p) => p !== period) || periods[0];
              const ok = S.removePeriod(period);
              setModal(null);
              if (ok) { setPeriod(next); setCurrentPeriod(next); if (window.toast) window.toast("Periodo eliminado del selector"); }
              else if (window.toast) window.toast("Debe quedar al menos un periodo");
            }}
          />
        )}
        {confirmDel && (
          confirmDel.reset ? (
            <window.ConfirmDelete
              title="¿Restablecer las fechas del periodo?"
              itemLabel={`Periodo ${S.formatPeriodLabel(period)}`}
              message="Se reemplazarán todas las fechas actuales por las fechas base por defecto. Las fechas personalizadas se perderán."
              confirmLabel="Restablecer"
              onConfirm={() => { S.writeGlobalParams(period, S.defaultParams.map((x) => ({ ...x }))); toast("Fechas restablecidas"); }}
              onClose={() => setConfirmDel(null)} />
          ) : (
            <window.ConfirmDelete
              title="¿Eliminar fecha parámetro?"
              itemLabel={`${confirmDel.label || "Fecha sin nombre"}${confirmDel.date ? ` · ${fmt(confirmDel.date)}` : ""}`}
              message={`Las campañas de ${S.formatPeriodLabel(period)} que dependan de esta fecha perderán la referencia. Esta acción no se puede deshacer.`}
              onConfirm={() => { remove(confirmDel.id); toast("Fecha eliminada"); }}
              onClose={() => setConfirmDel(null)} />
          )
        )}
        {askUnlock && window.ConfirmDelete && (
          <window.ConfirmDelete
            title="Desbloquear edición de fechas"
            itemLabel={`Fechas de ${S.formatPeriodLabel(period)}`}
            message="Las fechas parámetro afectan a todas las campañas del periodo. Ingresa tu clave para habilitar la edición."
            confirmLabel="Desbloquear"
            onConfirm={() => { setUnlocked(true); toast("Edición de fechas habilitada"); }}
            onClose={() => setAskUnlock(false)} />
        )}
      </div>
    );
  }

  window.GlobalParamsPage = GlobalParamsPage;
})();
