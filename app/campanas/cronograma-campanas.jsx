/* Cronograma de Campañas — resumen: una fila por campaña×periodo con planificación, inicio y fin.
   Incluye crear/editar/eliminar campañas, edición de fechas fluida y un Gantt alineado a la cuadrícula. */
(function () {
  const React = window.React;
  const { useState, useMemo, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Label, toast } = window;
  const cn = window.cn;

  const MS = 86400000;
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const YR = () => new Date().getFullYear();
  const validISO = (s) => { if (!s) return false; const [y, m, d] = String(s).split("-").map(Number); if (!y || !m || !d) return false; const yr = YR(); return y >= yr - 5 && y <= yr + 10; };
  const parseISO = (s) => { if (!validISO(s)) return null; const [y, m, d] = String(s).split("-").map(Number); const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt; };
  const toISO = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const fmtDM = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";
  const fmtFull = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  // Accent → bar / dot color (matches the campaign's chosen color/etiqueta).
  const ACCENT_BAR = { brand: "bg-brand", violet: "bg-accent-violet", green: "bg-accent-green", pink: "bg-accent-pink", amber: "bg-accent-amber" };
  const ACCENT_OPTS = [["brand", "Violeta"], ["violet", "Púrpura"], ["green", "Verde"], ["pink", "Rosa"], ["amber", "Ámbar"]];
  const barColor = (a) => ACCENT_BAR[a] || "bg-brand";
  const STM = { draft: ["Sin habilitar", "bg-muted text-muted-foreground"], pending: ["Pendiente aprobación", "bg-accent-amber/15 text-accent-amber"], approved: ["Aprobada", "bg-accent-green/10 text-accent-green"] };

  // Resolve a campaign's start/end window from its saved brief snapshot (params + key dates).
  function campaignWindow(snap) {
    const params = (snap && snap.params) || [];
    const keyDates = (snap && snap.keyDates) || [];
    const pdate = (id) => { const p = params.find((x) => x.id === id); return p ? parseISO(p.date) : null; };
    let starts = [], ends = [];
    keyDates.forEach((k) => {
      const base = pdate(k.paramId);
      if (!base) return;
      const s = new Date(base.getTime() + (Number(k.offsetDays) || 0) * MS);
      const e = new Date(s.getTime() + Math.max(1, Number(k.durationDays) || 1) * MS);
      starts.push(s.getTime()); ends.push(e.getTime());
    });
    if (!starts.length) {
      const pd = params.map((p) => parseISO(p.date)).filter(Boolean).map((d) => d.getTime());
      if (pd.length) { starts = pd; ends = pd; }
    }
    return { start: starts.length ? new Date(Math.min(...starts)) : null, end: ends.length ? new Date(Math.max(...ends)) : null };
  }

  /* ---------- Smooth date field: native picker + manual typing, commits on blur ---------- */
  function DateField({ value, onCommit, className }) {
    const [v, setV] = useState(value || "");
    const [focused, setFocused] = useState(false);
    useEffect(() => { if (!focused) setV(value || ""); }, [value, focused]);
    const commit = (val) => {
      if (val === "") { onCommit(""); return; }
      if (validISO(val)) onCommit(val); else setV(value || "");   // revert only if invalid
    };
    return (
      <input type="date" min="2020-01-01" max="2035-12-31" value={v}
        onFocus={() => setFocused(true)}
        onChange={(e) => setV(e.target.value)}
        onBlur={(e) => { setFocused(false); commit(e.target.value); }}
        className={cn("rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", className)} />
    );
  }

  /* ---------- Create / Edit campaign modal ---------- */
  function CampaignFormModal({ edit, periods, defaultPeriod, onClose, onSaved }) {
    const isEdit = !!edit;
    const [period, setPeriod] = useState(isEdit ? edit.period : (defaultPeriod || periods[0] || ""));
    const [title, setTitle] = useState(isEdit ? edit.title : "");
    const [accent, setAccent] = useState(isEdit ? (edit.accent || "brand") : "brand");
    const [lead, setLead] = useState(isEdit && edit.planLead != null ? String(edit.planLead) : "");
    const [start, setStart] = useState(isEdit ? toISO(edit.start) : "");
    const [end, setEnd] = useState(isEdit ? toISO(edit.end) : "");
    const [status, setStatus] = useState(isEdit ? (edit.status === "approved" ? "approved" : "pending") : "pending");
    const valid = title.trim().length > 1 && period && (!start || validISO(start)) && (!end || validISO(end)) && (!start || !end || parseISO(end) >= parseISO(start));

    const save = () => {
      if (!valid) return;
      let slug = isEdit ? edit.slug : null;
      if (isEdit) {
        S.updateCampaign(slug, { title: title.trim(), accent });
      } else {
        slug = S.createCampaign({ title: title.trim(), accent, icon: "Megaphone", description: "" });
        S.createBlankCampaignConfig(slug, period, {});
      }
      const meta = {};
      meta.schedStart = start || ""; meta.schedEnd = end || "";
      meta.planLeadDays = lead === "" ? null : Math.max(0, Number(lead) || 0);
      S.writeConfigMeta(slug, period, meta);
      S.setApproval(slug, period, status === "approved", S.currentUserName());
      toast(isEdit ? `Campaña “${title.trim()}” actualizada` : `Campaña “${title.trim()}” creada`);
      onSaved && onSaved();
      onClose();
    };

    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><LucideIcon name={isEdit ? "Pencil" : "Plus"} className="h-4 w-4" /></div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{isEdit ? "Editar campaña" : "Nueva campaña"}</p>
              <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">Cronograma</h2>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Periodo</Label>
                <select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={isEdit}
                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-surface px-2 text-sm focus-visible:outline-none disabled:opacity-60">
                  {periods.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Estado</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-surface px-2 text-sm focus-visible:outline-none">
                  <option value="pending">Pendiente aprobación</option>
                  <option value="approved">Aprobada</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nombre de campaña</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Matrícula extraordinaria" className="h-9 bg-surface" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Color / etiqueta</Label>
              <div className="flex gap-2">
                {ACCENT_OPTS.map(([key, lbl]) => (
                  <button key={key} type="button" onClick={() => setAccent(key)} title={lbl}
                    className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110", accent === key && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-surface-elevated")}>
                    <span className={cn("h-5 w-5 rounded-full", barColor(key))} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Inicio</Label>
                <DateField value={start} onCommit={setStart} className="h-9 w-full bg-surface px-2 text-sm tabular-nums" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Fin</Label>
                <DateField value={end} onCommit={setEnd} className="h-9 w-full bg-surface px-2 text-sm tabular-nums" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Planificación · días antes del inicio</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="0" className="h-9 w-24 bg-surface tabular-nums" />
                <span className="text-[11px] text-muted-foreground">{(lead !== "" && start && validISO(start)) ? `→ ${fmtFull(new Date(parseISO(start).getTime() - Math.max(0, Number(lead) || 0) * MS))}` : "fecha automática"}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={!valid} className="gap-1.5"><LucideIcon name="Check" className="h-4 w-4" /> {isEdit ? "Guardar" : "Crear campaña"}</Button>
          </div>
        </div>
      </div>
    );
  }

  function CampaignScheduleHub() {
    const campaigns = S.useCampaigns();
    const periods = S.listAvailablePeriods();
    const [tick, setTick] = useState(0);
    const refresh = () => setTick((t) => t + 1);
    const canEdit = S.useCan("editCampaigns") || S.useCan("managePeriods");
    const canDelete = S.useCan("deleteCampaigns") || canEdit;
    useEffect(() => { const on = () => refresh(); window.addEventListener("storage", on); return () => window.removeEventListener("storage", on); }, []);

    const perSel = S.useSelectedPeriods("all");
    const selPeriods = perSel.periods;
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState({ key: "start", dir: "asc" });
    const [modal, setModal] = useState(null); // null | {edit?}

    const rows = useMemo(() => {
      const out = [];
      campaigns.forEach((c) => {
        periods.forEach((p) => {
          if (!S.isCampaignConfigured(c.slug, p)) return;
          const snap = S.loadBriefSnapshot(c.slug, p);
          const params = (snap && snap.paramsMode === "custom" && (snap.params || []).length) ? snap.params : S.readGlobalParams(p);
          const keyDates = (snap && (snap.keyDates || []).length) ? snap.keyDates : S.defaultKeyDates;
          const win = campaignWindow({ params, keyDates });
          const meta = S.readConfigMeta(c.slug, p);
          const start = (meta.schedStart && validISO(meta.schedStart)) ? parseISO(meta.schedStart) : win.start;
          const end = (meta.schedEnd && validISO(meta.schedEnd)) ? parseISO(meta.schedEnd) : win.end;
          const lead = (meta.planLeadDays != null && meta.planLeadDays !== "") ? Math.max(0, Number(meta.planLeadDays) || 0) : null;
          const planStart = (lead != null && start) ? new Date(start.getTime() - lead * MS) : null;
          out.push({
            id: `${c.slug}|${p}`, slug: c.slug, period: p, title: c.title, accent: c.accent || "brand",
            planLead: lead, planStart, start, end, status: S.getCampaignStatus(c.slug, p),
          });
        });
      });
      return out;
    }, [campaigns, periods, tick]);

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      let f = rows.filter((r) => {
        if (!selPeriods.includes(r.period)) return false;
        if (q && !`${r.title} ${r.period}`.toLowerCase().includes(q)) return false;
        return true;
      });
      const val = (r) => {
        if (sort.key === "title") return r.title.toLowerCase();
        if (sort.key === "period") return r.period;
        if (sort.key === "plan") return r.planStart ? r.planStart.getTime() : Infinity;
        if (sort.key === "end") return r.end ? r.end.getTime() : Infinity;
        return r.start ? r.start.getTime() : Infinity;
      };
      const dir = sort.dir === "desc" ? -1 : 1;
      return f.slice().sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -dir : va > vb ? dir : 0; });
    }, [rows, selPeriods.join(","), query, sort]);

    // Timeline bounds — snapped to whole days; always include today; span hard-capped.
    const bounds = useMemo(() => {
      const lo = today0().getTime() - 365 * MS, hi = today0().getTime() + 365 * 4 * MS; // sane window
      const all = [today0().getTime()];
      filtered.forEach((r) => { [r.planStart, r.start, r.end].forEach((d) => { if (d) { const t = d.getTime(); if (t >= lo && t <= hi) all.push(t); } }); });
      if (all.length <= 1 && !filtered.some((r) => r.start || r.end || r.planStart)) return null;
      return { min: Math.min(...all), max: Math.max(...all) };
    }, [filtered]);

    const PX_DAY = 6;
    // Day index from min (both are local midnights → exact integer days).
    const dayIndex = (d) => bounds ? Math.round((d.getTime() - bounds.min) / MS) : 0;
    const totalDays = bounds ? Math.min(2000, Math.max(1, dayIndex(new Date(bounds.max)) + 2)) : 1;
    const trackWidth = totalDays * PX_DAY;
    const dayX = (d) => bounds && d ? dayIndex(d) * PX_DAY : 0;

    const ticks = useMemo(() => {
      if (!bounds) return [];
      const out = []; const cur = new Date(bounds.min); cur.setDate(1); cur.setHours(0, 0, 0, 0);
      let guard = 0;
      while (cur.getTime() <= bounds.max && guard++ < 240) {
        if (cur.getTime() >= bounds.min) {
          // Snap the month cut back to its week start (Monday) so it lands on the grid.
          const snap = new Date(cur); const wd = (snap.getDay() + 6) % 7; snap.setDate(snap.getDate() - wd);
          if (snap.getTime() < bounds.min) snap.setTime(bounds.min);
          out.push({ pos: snap, label: new Date(cur) });
        }
        cur.setMonth(cur.getMonth() + 1);
      }
      return out;
    }, [bounds]);
    const mondays = useMemo(() => {
      if (!bounds) return [];
      const out = []; const c = new Date(bounds.min); c.setHours(0, 0, 0, 0);
      const wd = (c.getDay() + 6) % 7;
      c.setDate(c.getDate() + ((7 - wd) % 7));
      let guard = 0;
      while (c.getTime() <= bounds.max && guard++ < 1100) { out.push(new Date(c)); c.setDate(c.getDate() + 7); }
      return out;
    }, [bounds]);
    const t = today0();
    const todayX = (bounds && t.getTime() >= bounds.min && t.getTime() <= bounds.max) ? dayX(t) : null;

    const scrollRef = React.useRef(null);
    const scrollDays = (n) => { const el = scrollRef.current; if (el) el.scrollLeft = Math.max(0, el.scrollLeft + n * PX_DAY); };
    const scrollToToday = () => { const el = scrollRef.current; if (el && todayX != null) el.scrollLeft = Math.max(0, todayX - el.clientWidth / 2); };

    const ROW_H = 20, ROW_GAP = 6, PITCH = ROW_H + ROW_GAP;

    const setLead = (r, val) => { S.writeConfigMeta(r.slug, r.period, { planLeadDays: val === "" ? null : Math.max(0, Number(val) || 0) }); refresh(); };
    const setDate = (r, key, iso) => { S.writeConfigMeta(r.slug, r.period, { [key]: iso }); refresh(); };
    const remove = (r) => { if (confirm(`¿Quitar “${r.title}” del cronograma de ${r.period}?`)) { S.unmarkCampaignConfigured(r.slug, r.period); toast("Campaña quitada del periodo"); refresh(); } };

    const SortTh = ({ label, col, className }) => {
      const active = sort.key === col;
      const next = () => setSort(active ? { key: col, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: col, dir: "asc" });
      return (
        <th className={cn("px-2.5 py-2 text-left", className)}>
          <button type="button" onClick={next} className={cn("inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground", active && "text-foreground")}>
            {label}<LucideIcon name={active ? (sort.dir === "asc" ? "ArrowUp" : "ArrowDown") : "ChevronsUpDown"} className={cn("h-3 w-3", active ? "opacity-100" : "opacity-30")} />
          </button>
        </th>
      );
    };

    return (
      <div className="min-h-screen bg-background" data-screen-label="Cronograma de campañas">
        <window.SectionWash accent="amber" />
        <main className="mx-auto w-full max-w-6xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/">
            <div className="relative w-52">
              <LucideIcon name="Search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campaña…" className="!h-8 !rounded-full pl-7 text-xs" />
            </div>
            <window.PeriodFilter />
            <span className="whitespace-nowrap px-1 text-[11px] text-muted-foreground">{filtered.length} campaña{filtered.length === 1 ? "" : "s"}</span>
            <span className="mx-0.5 h-6 w-px bg-border" />
            <a href="#/cronograma" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface-elevated px-3 py-2 text-[12px] font-medium text-foreground shadow-soft transition-colors hover:bg-surface">
              <LucideIcon name="CalendarClock" className="h-4 w-4 text-brand" /> Comunicaciones
            </a>
            {canEdit && (
              <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90">
                <LucideIcon name="Plus" className="h-4 w-4" /> Nueva campaña
              </button>
            )}
          </window.PageToolbar>

          <window.SectionHeader accent="amber" icon="CalendarRange" title="Cronograma de campañas" subtitle="Resumen ejecutivo: planificación, inicio y fin de cada campaña por periodo." />

          {/* Gantt */}
          <div className="mb-4 rounded-2xl border border-border/60 bg-surface-elevated p-4">
            {filtered.length === 0 || !bounds ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">Sin campañas configuradas para mostrar. {canEdit ? "Crea la primera con “Nueva campaña”." : ""}</p>
            ) : (
              <window.GanttTimeline
                lines={filtered.map((r) => ({
                  type: "bar", dot: true, color: barColor(r.accent),
                  label: r.title, sublabel: r.period, href: `#/brief/${r.slug}?p=${r.period}`,
                  start: r.start, end: r.end, marker: r.planStart,
                  text: (r.start && r.end) ? `${fmtDM(r.start)} → ${fmtDM(r.end)}` : "",
                }))}
                pxDay={6} gutter={150} legend={true} />
            )}
          </div>

          {/* Tabla resumen */}
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <SortTh label="Periodo" col="period" />
                  <SortTh label="Campaña" col="title" />
                  <SortTh label="Planificación (días antes)" col="plan" />
                  <SortTh label="Inicio" col="start" />
                  <SortTh label="Fin" col="end" />
                  <th className="px-2.5 py-2 text-left">Estado</th>
                  {canEdit && <th className="px-2.5 py-2 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={canEdit ? 7 : 6} className="px-2.5 py-6 text-center text-[12px] text-muted-foreground">Sin campañas para los filtros actuales.</td></tr>
                ) : filtered.map((r) => {
                  const sm = STM[r.status] || STM.pending;
                  return (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-surface/50">
                      <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-muted-foreground">{r.period}</td>
                      <td className="px-2.5 py-2">
                        <a href={`#/brief/${r.slug}?p=${r.period}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-brand">
                          <span className={cn("h-2 w-2 rounded-full", barColor(r.accent))} /> {r.title}
                        </a>
                      </td>
                      <td className="px-2.5 py-2">
                        {canEdit ? (
                          <div className="flex items-center gap-2">
                            <Input type="number" min="0" value={r.planLead == null ? "" : r.planLead} onChange={(e) => setLead(r, e.target.value)} placeholder="—" className="h-7 w-16 bg-surface/40 px-1.5 text-[11px] tabular-nums" />
                            <span className="whitespace-nowrap text-[10px] text-muted-foreground">días · {r.planStart ? fmtFull(r.planStart) : (r.start ? "—" : "sin inicio")}</span>
                          </div>
                        ) : (
                          <span className="whitespace-nowrap tabular-nums">{r.planLead == null ? "—" : `${r.planLead} días · ${fmtFull(r.planStart)}`}</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        {canEdit ? <DateField value={toISO(r.start)} onCommit={(iso) => setDate(r, "schedStart", iso)} className="h-7 w-36 bg-surface/40 px-1.5 text-[11px] tabular-nums" />
                          : <span className="whitespace-nowrap tabular-nums">{fmtFull(r.start)}</span>}
                      </td>
                      <td className="px-2.5 py-2">
                        {canEdit ? <DateField value={toISO(r.end)} onCommit={(iso) => setDate(r, "schedEnd", iso)} className="h-7 w-36 bg-surface/40 px-1.5 text-[11px] tabular-nums" />
                          : <span className="whitespace-nowrap tabular-nums">{fmtFull(r.end)}</span>}
                      </td>
                      <td className="px-2.5 py-2"><span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", sm[1])}>{sm[0]}</span></td>
                      {canEdit && (
                        <td className="px-2.5 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setModal({ edit: r })} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"><LucideIcon name="Pencil" className="h-3.5 w-3.5" /></button>
                            {canDelete && <button type="button" onClick={() => remove(r)} aria-label="Eliminar" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><LucideIcon name="Trash2" className="h-3.5 w-3.5" /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Las fechas se editan a mano o con el selector; se guardan al salir del campo. La planificación se indica en días previos al inicio (fecha automática). Crea, edita o elimina campañas con los controles de arriba.</p>
        </main>

        {modal && <CampaignFormModal edit={modal.edit} periods={periods} defaultPeriod={selPeriods.length === 1 ? selPeriods[0] : undefined} onClose={() => setModal(null)} onSaved={refresh} />}
      </div>
    );
  }

  window.CampaignScheduleHub = CampaignScheduleHub;
})();
