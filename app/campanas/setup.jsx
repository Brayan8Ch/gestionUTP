/* Setup modal — configure a campaign for a period: duplicate (and modify) or start blank. */
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Label } = window;
  const cn = window.cn;

  function Field({ label, hint, children }) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {children}
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  const ACCENT_TONE = {
    brand: "bg-brand/10 text-brand", violet: "bg-accent-violet/10 text-accent-violet",
    pink: "bg-accent-pink/10 text-accent-pink", amber: "bg-accent-amber/15 text-accent-amber",
    green: "bg-accent-green/10 text-accent-green",
  };

  /* Orden numérico de periodos "YYYY-N" (evita comparación lexicográfica) */
  const pv = (p) => { const [y, n] = String(p).split("-").map(Number); return (y || 0) * 100 + (n || 0); };

  function SetupModal({ slug, period: initialPeriod, prevPeriod: prevProp, defaultMode, onClose }) {
    const campaign = S.campaigns.find((c) => c.slug === slug) || { title: slug };
    const aTone = ACCENT_TONE[campaign.accent] || ACCENT_TONE.brand;

    /* Periodo de destino seleccionable: cualquier periodo aún sin habilitar para esta campaña. */
    S.useAvailablePeriods();
    const allPeriods = S.listAvailablePeriods();
    const selectable = allPeriods.filter((p) => !S.isCampaignConfigured(slug, p));
    const [period, setPeriod] = useState(() =>
      initialPeriod && selectable.includes(initialPeriod) ? initialPeriod : (selectable[selectable.length - 1] || initialPeriod || ""));

    /* Origen del duplicado: el periodo configurado más cercano anterior al destino
       (si no hay, el configurado más reciente). Se recalcula al cambiar el destino. */
    const configured = allPeriods.filter((p) => S.isCampaignConfigured(slug, p));
    const earlier = configured.filter((p) => pv(p) < pv(period)).sort((a, b) => pv(a) - pv(b));
    const prevPeriod = earlier[earlier.length - 1] || configured.filter((p) => p !== period).sort((a, b) => pv(a) - pv(b)).pop() || prevProp || null;
    const canDuplicate = !!prevPeriod;
    const [mode, setMode] = useState(canDuplicate ? (defaultMode || "duplicate") : "scratch");
    useEffect(() => { if (!canDuplicate && mode === "duplicate") setMode("scratch"); }, [canDuplicate, mode]);
    const prevMeta = canDuplicate ? S.readConfigMeta(slug, prevPeriod) : {};
    const [responsable, setResponsable] = useState(prevMeta.responsable || "");
    const [supervisor, setSupervisor] = useState(prevMeta.supervisor || "");
    const [offset, setOffset] = useState(0);
    const [reassign, setReassign] = useState("");
    const [canva, setCanva] = useState("");
    const [dropbox, setDropbox] = useState("");
    const [includesSpeech, setIncludesSpeech] = useState(Boolean(prevMeta.includesSpeech));

    const commit = () => {
      /* Guarda: nunca sobreescribir una configuración existente del periodo elegido. */
      if (!period || S.isCampaignConfigured(slug, period)) return;
      if (mode === "duplicate" && canDuplicate) {
        S.duplicateConfigWithOverrides(slug, prevPeriod, period, {
          responsable,
          supervisor,
          dateOffsetDays: Number(offset) || 0,
          reassignOwner: reassign || undefined,
          canva: canva || undefined,
          dropbox: dropbox || undefined,
        });
      } else {
        S.createBlankCampaignConfig(slug, period, { responsable, supervisor });
        if (canva || dropbox) S.writeCampaignLinks(slug, period, { canva, dropbox });
      }
      S.writeConfigMeta(slug, period, { includesSpeech });
      onClose();
      window.location.hash = `#/brief/${slug}?p=${period}`;
    };

    const RadioCard = ({ value, icon, title, desc, disabled }) => (
      <button type="button" disabled={disabled} onClick={() => setMode(value)}
        className={cn(
          "flex flex-1 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          mode === value ? "border-brand bg-brand/5 ring-1 ring-brand/30" : "border-border bg-surface hover:border-foreground/20"
        )}>
        <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", mode === value ? "bg-brand/10 text-brand" : "bg-surface-elevated text-muted-foreground")}>
          <LucideIcon name={icon} className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{desc}</p>
        </div>
      </button>
    );

    /* Portal al body: evita que el transform de la card ancestro re-ancle el fixed y parpadee. */
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", aTone)}>
                <LucideIcon name={campaign.icon || "Megaphone"} className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <div className="mb-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <LucideIcon name="Power" className="h-3 w-3" /> Sin habilitar · {S.formatPeriodShort(period)}
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Configurar {campaign.title}</h2>
                <p className="text-xs text-muted-foreground">Snapshot independiente para {S.formatPeriodLabel(period)}.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="h-8 w-8 text-muted-foreground"><LucideIcon name="X" className="h-4 w-4" /></Button>
          </div>

          <div className="mb-4 flex gap-2">
            <RadioCard value="duplicate" icon="Copy" title={canDuplicate ? `Duplicar ${S.formatPeriodShort(prevPeriod)}` : "Duplicar anterior"}
              desc={canDuplicate ? `Copia la configuración de ${S.formatPeriodLabel(prevPeriod)} como punto de partida.` : "Sin configuración previa disponible."} disabled={!canDuplicate} />
            <RadioCard value="scratch" icon="Sparkles" title="Empezar desde cero" desc="Crea una configuración vacía para este periodo." />
          </div>

          <div className="space-y-3">
            <Field label="Periodo a habilitar" hint={selectable.length > 1 ? "Puedes habilitar el brief en cualquier periodo pendiente." : undefined}>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                {(selectable.length ? selectable : allPeriods).map((p) => (
                  <option key={p} value={p}>{S.formatPeriodLabel(p)}{S.isCampaignConfigured(slug, p) ? " · ya habilitada" : ""}</option>
                ))}
              </select>
            </Field>
            <Field label="Responsable principal">
              <window.OwnerSelect framed value={responsable} onChange={setResponsable} className="bg-surface" />
            </Field>
            <Field label="Supervisor / aprobador">
              <window.OwnerSelect framed value={supervisor} onChange={setSupervisor} placeholder="Sin aprobador" className="bg-surface" />
            </Field>

            {mode === "duplicate" && canDuplicate && (
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <LucideIcon name="CalendarRange" className="h-3.5 w-3.5 text-brand" /> Ajustes al duplicar (editable después en el brief)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Desplazar fechas (días)" hint="Mueve fechas parámetro y deadlines del checklist.">
                    <Input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} className="h-9 bg-surface-elevated tabular-nums" />
                  </Field>
                  <Field label="Reasignar tareas a (opcional)" hint="Vacío = conserva responsables originales.">
                    <window.OwnerSelect framed value={reassign} onChange={setReassign} placeholder="Conservar" className="bg-surface-elevated" />
                  </Field>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Link de Canva">
                <Input value={canva} onChange={(e) => setCanva(e.target.value)} placeholder="https://www.canva.com/..." className="h-9 bg-surface" />
              </Field>
              <Field label="Link de Dropbox">
                <Input value={dropbox} onChange={(e) => setDropbox(e.target.value)} placeholder="https://www.dropbox.com/..." className="h-9 bg-surface" />
              </Field>
            </div>

            <button type="button" onClick={() => setIncludesSpeech((v) => !v)}
              className={cn("flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors", includesSpeech ? "border-brand bg-brand/5 ring-1 ring-brand/30" : "border-border bg-surface hover:border-foreground/20")}>
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors", includesSpeech ? "border-brand bg-brand text-white" : "border-border bg-surface-elevated")}>
                {includesSpeech && <LucideIcon name="Check" className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><LucideIcon name="Mic" className="h-3.5 w-3.5 text-muted-foreground" /> Incluye Speech</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">Habilita el guion de apertura de llamada y su argumentario para esta campaña.</span>
              </span>
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">Modificar {S.formatPeriodShort(period)} no altera otros periodos.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={commit} disabled={!period || S.isCampaignConfigured(slug, period)} className="gap-1.5">
                <LucideIcon name="Check" className="h-4 w-4" /> {mode === "duplicate" && canDuplicate ? "Duplicar y habilitar" : "Habilitar campaña"}
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  Object.assign(window, { SetupModal });
})();
