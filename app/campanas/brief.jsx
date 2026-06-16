/* Brief — Executive Campaign Cockpit. Compact, high-density dashboard. */
(function () {
  const React = window.React;
  const { useState, useEffect, useMemo, useRef, useContext, createContext } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Textarea, Checkbox, Popover, toast, DatePicker } = window;
  const cn = window.cn;

  /* ---------- date helpers ---------- */
  const MS = 86400000;
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtShort = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";
  const dayDiff = (a, b) => Math.round((a - b) / MS);

  /* ---------- Brief context ---------- */
  const BriefCtx = createContext(null);
  const useBrief = () => useContext(BriefCtx);
  const periodsKey = (slug) => `brief-periods:${slug}`;
  const loadPeriods = (slug) => { try { return JSON.parse(localStorage.getItem(periodsKey(slug)) || "[]"); } catch { return []; } };

  /* En producción, un brief sin snapshot nace VACÍO (sin comunicaciones
     demo, sin fechas clave demo, sin parámetros precargados). El modo
     prototipo mantiene el contenido de ejemplo. */
  const PROD = !!(window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL);
  const D_PARAMS = () => (PROD ? [] : S.defaultParams);
  const D_KEYDATES = () => (PROD ? [] : S.defaultKeyDates);
  const D_COMMS = () => (PROD ? [] : (window.DEFAULT_COMMS || []));

  function BriefProvider({ slug, initialPeriod, children }) {
    const [period, setPeriodState] = useState(initialPeriod);
    const [customParams, setCustomParams] = useState(D_PARAMS);
    const [paramsMode, setParamsModeState] = useState("global"); // "global" | "custom"
    const [globalParams, setGlobalParamsState] = useState(() => S.readGlobalParams(initialPeriod));
    const [keyDates, setKeyDates] = useState(D_KEYDATES);
    const [comms, setComms] = useState(D_COMMS);
    const [canva, setCanva] = useState("");
    const [dropbox, setDropbox] = useState("");
    const [availablePeriods, setAvailablePeriods] = useState([]);
    const lastLoaded = useRef("");
    const [savedSig, setSavedSig] = useState("");
    const liveSig = JSON.stringify({ customParams, paramsMode, keyDates, comms, canva, dropbox });
    const dirty = savedSig !== "" && liveSig !== savedSig;

    const loadForPeriod = (p) => {
      const links = S.readCampaignLinks(slug, p);
      setCanva(links.canva || ""); setDropbox(links.dropbox || "");
      setGlobalParamsState(S.readGlobalParams(p));
      const snap = S.loadBriefSnapshot(slug, p);
      if (snap) {
        setParamsModeState(snap.paramsMode === "custom" ? "custom" : "global");
        setCustomParams(Array.isArray(snap.params) && snap.params.length ? snap.params : D_PARAMS());
        setKeyDates(Array.isArray(snap.keyDates) ? snap.keyDates : D_KEYDATES());
        setComms(Array.isArray(snap.comms) ? snap.comms : D_COMMS());
        setCanva(snap.canva || ""); setDropbox(snap.dropbox || "");
      } else { setParamsModeState("global"); setCustomParams(D_PARAMS()); setKeyDates(D_KEYDATES()); setComms(D_COMMS()); }
      // Firma del estado recién cargado: a partir de aquí, cualquier cambio marca "sin guardar".
      setTimeout(() => { try { setSavedSig(sigRef.current()); } catch (e) {} }, 0);
    };
    useEffect(() => {
      setAvailablePeriods(loadPeriods(slug));
      if (lastLoaded.current !== `${slug}:${initialPeriod}`) {
        setPeriodState(initialPeriod); loadForPeriod(initialPeriod);
        lastLoaded.current = `${slug}:${initialPeriod}`;
      }
    }, [slug, initialPeriod]);

    const setPeriod = (p) => { setPeriodState(p); loadForPeriod(p); };
    // Effective params: inherited from the period (global) unless this campaign overrides.
    const params = paramsMode === "custom" ? customParams : globalParams;
    const setParams = (next) => {
      const value = typeof next === "function" ? next(params) : next;
      if (paramsMode === "custom") setCustomParams(value);
      else { setGlobalParamsState(value); S.writeGlobalParams(period, value); }
    };
    const setParamsMode = (mode) => {
      if (mode === "custom" && paramsMode !== "custom") setCustomParams(globalParams.map((x) => ({ ...x })));
      if (mode === "global") setGlobalParamsState(S.readGlobalParams(period));
      setParamsModeState(mode);
    };
    const addParam = () => setParams((p) => [...p, { id: S.uuid(), label: "Nueva fecha", date: "" }]);
    const removeParam = (id) => { setParams((p) => p.filter((x) => x.id !== id)); setKeyDates((k) => k.filter((x) => x.paramId !== id)); };
    const resolveDate = (paramId, offsetDays) => {
      const p = params.find((x) => x.id === paramId);
      if (!p || !p.date) return null;
      const [y, m, d] = p.date.split("-").map(Number);
      if (!y || !m || !d) return null;
      const date = new Date(y, m - 1, d); date.setDate(date.getDate() + (offsetDays || 0)); date.setHours(0, 0, 0, 0); return date;
    };
    const formatDate = (d) => d ? d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "—";
    const saveCurrent = () => {
      S.saveBriefSnapshot(slug, period, { params: customParams, paramsMode, keyDates, comms, canva, dropbox });
      const existing = loadPeriods(slug);
      if (!existing.includes(period)) { const next = [...existing, period]; localStorage.setItem(periodsKey(slug), JSON.stringify(next)); setAvailablePeriods(next); }
      setSavedSig(JSON.stringify({ customParams, paramsMode, keyDates, comms, canva, dropbox }));
    };
    const sigRef = useRef(() => "");
    sigRef.current = () => JSON.stringify({ customParams, paramsMode, keyDates, comms, canva, dropbox });
    /* Comms referenciadas a fechas clave: si una fecha parámetro cambia,
       el inicio/fin de las comunicaciones que la referencian se recalculan. */
    const toISO = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
    React.useEffect(() => {
      setComms((rs) => {
        let changed = false;
        const next = rs.map((r) => {
          const n = { ...r };
          if (n.startParamId) { const iso = toISO(resolveDate(n.startParamId, Number(n.startOffset) || 0)); if (iso && iso !== n.start) { n.start = iso; changed = true; } }
          if (n.endParamId) { const iso = toISO(resolveDate(n.endParamId, Number(n.endOffset) || 0)); if (iso && iso !== n.end) { n.end = iso; changed = true; } }
          return changed ? n : r;
        });
        return changed ? next : rs;
      });
    }, [params]);
    /* ===== Guard de cambios sin guardar (BUG-CA92) =====
       Vive en el PROVIDER (no en el botón, que se desmonta al navegar). Bloquea:
       - cerrar/recargar la pestaña → beforeunload nativo.
       - retroceder (botón atrás del navegador) → entrada centinela en el historial:
         empujamos un estado extra mientras hay cambios; al hacer "atrás" se consume
         ese estado (no la navegación real), preguntamos, y si confirma dejamos ir. */
    const dirtyRef = useRef(false);
    dirtyRef.current = dirty;
    useEffect(() => {
      const onBeforeUnload = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);
    useEffect(() => {
      if (!dirty) return;
      // Sembrar una entrada centinela: el primer "atrás" caerá aquí, no fuera del brief.
      try { history.pushState({ __briefGuard: true }, ""); } catch (e) {}
      const onPop = (e) => {
        if (!dirtyRef.current) return; // ya guardó: dejar pasar
        const ok = window.confirm("Tienes cambios sin guardar en el brief.\n¿Seguro que quieres salir sin guardar? Se perderán los cambios.");
        if (ok) {
          dirtyRef.current = false;
          // Dejar continuar el "atrás": retrocede de nuevo para salir de verdad.
          history.back();
        } else {
          // Cancelar: volver a sembrar el centinela para seguir protegiendo.
          try { history.pushState({ __briefGuard: true }, ""); } catch (e) {}
        }
      };
      window.addEventListener("popstate", onPop);
      return () => {
        window.removeEventListener("popstate", onPop);
        // Limpiar el centinela si seguía puesto y ya no hay cambios.
        if (history.state && history.state.__briefGuard) { try { history.back(); } catch (e) {} }
      };
    }, [dirty]);

    const value = { slug, period, setPeriod, params, setParams, paramsMode, setParamsMode, addParam, removeParam, keyDates, setKeyDates, comms, setComms, canva, setCanva, dropbox, setDropbox, resolveDate, formatDate, saveCurrent, availablePeriods, toISO, dirty };
    return React.createElement(BriefCtx.Provider, { value }, children);
  }

  /* ---------- shared: build resolved key-date items ---------- */
  function buildKeyItems(keyDates, resolveDate) {
    const t = today0();
    return keyDates.map((k) => {
      const start = resolveDate(k.paramId, k.offsetDays);
      const dur = Math.max(1, Number(k.durationDays) || 1);
      const end = start ? addDays(start, dur) : null;
      let status = "upcoming";
      if (start && end) { if (end <= t) status = "done"; else if (start <= t) status = "active"; else status = "upcoming"; }
      return { k, start, end, dur, status };
    });
  }
  function nextMilestone(items) {
    const valid = items.filter((x) => x.start);
    const up = valid.filter((x) => x.status === "upcoming").sort((a, b) => a.start - b.start);
    if (up[0]) return up[0];
    const act = valid.filter((x) => x.status === "active").sort((a, b) => a.start - b.start);
    if (act[0]) return act[0];
    const all = valid.slice().sort((a, b) => a.start - b.start);
    return all[all.length - 1] || null;
  }

  const ST = {
    danger: { dot: "bg-destructive", text: "text-destructive", soft: "bg-destructive/10 text-destructive", bar: "bg-destructive" },
    success: { dot: "bg-accent-green", text: "text-accent-green", soft: "bg-accent-green/10 text-accent-green", bar: "bg-accent-green" },
    brand: { dot: "bg-brand", text: "text-brand", soft: "bg-brand/10 text-brand", bar: "bg-brand" },
    warning: { dot: "bg-accent-amber", text: "text-accent-amber", soft: "bg-accent-amber/15 text-accent-amber", bar: "bg-accent-amber" },
    muted: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", soft: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40" },
  };
  function campaignStatus(progress, tasks) {
    if (progress.total > 0 && progress.percent === 100) return { label: "Completada", tone: "success" };
    if (progress.percent > 0) return { label: "En progreso", tone: "brand" };
    return { label: "Por iniciar", tone: "muted" };
  }

  /* ---------- Section shell — L1 section title dominates; generous breathing room ---------- */
  function Block({ icon, title, action, children, className }) {
    return (
      <section className={cn("rounded-2xl border border-border/70 bg-surface-elevated p-5 shadow-soft sm:p-6", className)} data-screen-label={title}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold tracking-tight text-foreground">
            {icon && <LucideIcon name={icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />} {title}
          </h2>
          {action}
        </div>
        {children}
      </section>
    );
  }
  window.Block = Block;

  /* ============== Executive header ==============
     Format: campaign name → objective (description) → audience + expected-result
     modules → approval status. */
  function ExecHeader({ reader, setReader, canEdit = true, slug, period }) {
    const { keyDates, resolveDate, params, comms, canva, dropbox } = useBrief();
    const meta = S.useConfigMeta(slug, period);
    const progress = S.useOperativeProgress(slug, period);
    const { tasks } = S.useOperativeChecklist(slug, period);
    const { items: pend } = S.useGeneralPendings();
    const camp = S.campaigns.find((c) => c.slug === slug) || { title: slug };
    const items = buildKeyItems(keyDates, resolveDate);
    const next = nextMilestone(items);
    const status = campaignStatus(progress, tasks);
    const stTone = ST[status.tone];
    const linked = pend.filter((i) => i.campaignSlug === slug && (!period || !i.period || i.period === period));

    /* Strategic summary (objetivo / audiencia / resultado) lives here now */
    const [summary, setSummary] = useState(() => readSummary(slug, period));
    const sumRefs = useRef({});
    const fit = (el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
    const fitAll = () => Object.values(sumRefs.current).forEach(fit);
    useEffect(() => { setSummary(readSummary(slug, period)); }, [slug, period]);
    useEffect(() => { fitAll(); }, [summary, reader]);
    useEffect(() => { const on = () => fitAll(); window.addEventListener("resize", on); const t = setTimeout(fitAll, 60); return () => { window.removeEventListener("resize", on); clearTimeout(t); }; }, []);
    const saveSummary = (next) => { setSummary(next); try { localStorage.setItem(summaryKey(slug, period), JSON.stringify(next)); } catch {} };

    return (
      <header className="print:break-inside-avoid">
        {/* eyebrow */}
        <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            <LucideIcon name={reader ? "BookOpen" : "Pencil"} className="h-3 w-3" /> Brief ejecutivo
          </span>
          <span className="whitespace-nowrap tabular-nums">{S.formatPeriodLabel(period)}</span>
        </div>

        {/* 1 · Campaign name */}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow" style={{ background: (window.SECTION_GRAD || {}).brand }}>
            <LucideIcon name="Megaphone" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{camp.title}</h1>
        </div>

        {/* 2 · Objective as description — discreto en tamaño pero en negrita y legible (BUG-4D28) */}
        <div className="mt-1.5 max-w-3xl">
          <Textarea ref={(el) => { sumRefs.current.objective = el; }} value={summary.objective} readOnly={reader}
            onChange={(e) => saveSummary({ ...summary, objective: e.target.value })} onInput={(e) => fit(e.target)} rows={1}
            placeholder={SUMMARY_FIELDS[0].placeholder}
            className="resize-none overflow-hidden border-0 bg-transparent p-0 text-[13.5px] font-semibold leading-relaxed text-foreground/80 shadow-none focus-visible:ring-0 sm:text-[14px]" />
        </div>

        {/* 3 · Audience + expected-result modules — alto uniforme aunque el texto varíe */}
        <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2">
          {SUMMARY_FIELDS.filter((f) => f.key !== "objective").map((f) => (
            <div key={f.key} className="flex flex-col rounded-xl border border-border/60 bg-surface/50 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><LucideIcon name={f.icon} className="h-3.5 w-3.5" /> {f.label}</p>
              <Textarea ref={(el) => { sumRefs.current[f.key] = el; }} value={summary[f.key]} readOnly={reader}
                onChange={(e) => saveSummary({ ...summary, [f.key]: e.target.value })} onInput={(e) => fit(e.target)} rows={1}
                placeholder={f.placeholder}
                className="flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] font-medium leading-snug text-foreground shadow-none focus-visible:ring-0" />
            </div>
          ))}
        </div>

        {/* 4 · Approval status */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <ApprovalStatusLine slug={slug} period={period} canEdit={canEdit} status={status} stTone={stTone} meta={meta} />
        </div>
      </header>
    );
  }

  /* Approval + ownership line shown at the bottom of the hero */
  function ApprovalStatusLine({ slug, period, canEdit, status, stTone, meta }) {
    const Sep = () => <span className="text-border">·</span>;
    return (
      <>
        <ApprovalControl slug={slug} period={period} canEdit={canEdit} />
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", stTone.soft)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", stTone.dot)} /> {status.label}
        </span>
        <Sep />
        {/* Responsable + Supervisor juntos, en la misma línea (BUG-8A7F) */}
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[12px] text-muted-foreground" title="Responsable de la campaña">
            <LucideIcon name="User" className="h-3.5 w-3.5" />
            {meta.responsable ? <span className="font-medium text-foreground">{meta.responsable}</span> : <span className="text-muted-foreground/70">Sin responsable</span>}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[12px] text-muted-foreground" title="Supervisor / aprobador">
            <LucideIcon name="ShieldCheck" className="h-3.5 w-3.5" />
            {meta.supervisor ? <span className="font-medium text-foreground">{meta.supervisor}</span> : <span className="text-muted-foreground/70">Sin supervisor</span>}
          </span>
        </span>
        {meta.updatedAt && (
          <>
            <Sep />
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground" title="Última modificación">
              <LucideIcon name="Clock" className="h-3.5 w-3.5" />
              Modificado: <span className="font-medium text-foreground">{window.fmtDateShort(meta.updatedAt)}</span>
            </span>
          </>
        )}
      </>
    );
  }
  function ApprovalControl({ slug, period, canEdit }) {
    const st = S.useCampaignStatus(slug, period);
    const meta = S.useConfigMeta(slug, period);
    if (st.key === "draft") return null;
    const approve = () => S.setApproval(slug, period, true, S.currentUserName());
    const revoke = () => S.setApproval(slug, period, false);
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", st.soft)} title={st.key === "approved" && meta.approvedBy ? `Aprobada por ${meta.approvedBy}` : ""}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
        </span>
        {canEdit && (st.key === "pending" ? (
          <button type="button" onClick={approve} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-green px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-green/90">
            <LucideIcon name="Check" className="h-3.5 w-3.5" /> Aprobar
          </button>
        ) : (
          <button type="button" onClick={revoke} className="inline-flex items-center gap-1 whitespace-nowrap h-8 rounded-full border border-border bg-surface-elevated px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <LucideIcon name="Undo2" className="h-3.5 w-3.5" /> Revocar
          </button>
        ))}
      </div>
    );
  }
  function BriefSaveButton({ reader, period }) {
    const { saveCurrent, dirty } = useBrief();
    if (reader) return null;
    return (
      <button type="button" onClick={() => { saveCurrent(); toast(`Brief guardado · ${period}`); }}
        title={dirty ? "Tienes cambios sin guardar" : "Todo guardado"}
        className={cn("relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-soft transition-colors",
          dirty ? "border-accent-amber/50 bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25" : "border-border bg-surface-elevated text-foreground hover:bg-surface")}>
        {dirty && <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-amber opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-amber" /></span>}
        <LucideIcon name="Save" className="h-3.5 w-3.5" /> {dirty ? "Guardar cambios" : "Guardado"}
      </button>
    );
  }

  /* ============== Brief toolbar — actions live in the sticky bar ============== */
  function BriefToolbar({ reader, setReader, canEdit = true, slug, period }) {
    const { keyDates, resolveDate, params, comms, canva, dropbox } = useBrief();
    const meta = S.useConfigMeta(slug, period);
    const progress = S.useOperativeProgress(slug, period);
    const { tasks } = S.useOperativeChecklist(slug, period);
    const { items: pend } = S.useGeneralPendings();
    const camp = S.campaigns.find((c) => c.slug === slug) || { title: slug };
    const items = buildKeyItems(keyDates, resolveDate);
    const next = nextMilestone(items);
    const status = campaignStatus(progress, tasks);
    const linked = pend.filter((i) => i.campaignSlug === slug && (!period || !i.period || i.period === period));

    return (
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 print:hidden">
        {/* Avance */}
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-soft" title={`${progress.done}/${progress.total} tareas`}>
          <span className="tabular-nums text-muted-foreground">Avance</span>
          <span className="tabular-nums font-semibold">{progress.percent}%</span>
          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface">
            <span className="block h-full origin-left rounded-full bg-accent-green transition-transform duration-300 ease-glide" style={{ transform: `scaleX(${(progress.percent || 0) / 100})` }} />
          </span>
        </span>
        {/* Canva + Dropbox quick links */}
        {canva
          ? <a href={canva} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors hover:bg-surface"><LucideIcon name="Palette" className="h-3.5 w-3.5 text-accent-violet" /> Canva</a>
          : <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground/60 shadow-soft" title="Sin enlace de Canva"><LucideIcon name="Palette" className="h-3.5 w-3.5" /> Canva</span>}
        {dropbox
          ? <a href={dropbox} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors hover:bg-surface"><LucideIcon name="Box" className="h-3.5 w-3.5 text-brand" /> Dropbox</a>
          : <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground/60 shadow-soft" title="Sin enlace de Dropbox"><LucideIcon name="Box" className="h-3.5 w-3.5" /> Dropbox</span>}
        {canEdit ? (
          <div className="inline-flex items-center rounded-full border border-border bg-surface-elevated p-0.5 shadow-soft">
            <button type="button" onClick={() => setReader(true)} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors", reader ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}><LucideIcon name="BookOpen" className="h-3.5 w-3.5" /> Lector</button>
            <button type="button" onClick={() => setReader(false)} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors", !reader ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}><LucideIcon name="Pencil" className="h-3.5 w-3.5" /> Edición</button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground"><LucideIcon name="Lock" className="h-3.5 w-3.5" /> Solo lectura</span>
        )}
        <BriefSaveButton reader={reader} period={period} />
        {meta.includesSpeech && (
          <a href={`#/speech/${slug}?p=${period}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors hover:bg-surface">
            <LucideIcon name="Mic" className="h-3.5 w-3.5" /> Speech
          </a>
        )}
        <button type="button" onClick={() => window.exportBriefPdf({
          title: camp.title, periodLabel: S.formatPeriodLabel(period),
          status: status.label, progress,
          responsable: meta.responsable, supervisor: meta.supervisor, updatedAt: meta.updatedAt,
          generatedBy: (S.readSession() || {}).name || "",
          summary: readSummary(slug, period),
          params, keyItems: items, comms, tasks, pendings: linked,
          next: next ? { label: (next.k && next.k.label) || next.label, start: next.start } : null,
        })} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors hover:bg-surface"><LucideIcon name="Download" className="h-3.5 w-3.5" /> PDF</button>
        <button type="button" title="Exportar datos de la campaña (.json) — para importar en otro workspace" onClick={() => {
          const data = S.exportCampaignData(slug, period);
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `Campaña — ${camp.title} — ${period}.json`;
          document.body.appendChild(a); a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
          toast("Datos exportados (.json)");
        }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors hover:bg-surface"><LucideIcon name="FileJson" className="h-3.5 w-3.5" /> JSON</button>
      </div>
    );
  }

  /* ============== KPI strip ============== */
  function KpiStrip({ slug, period }) {
    const { keyDates, resolveDate } = useBrief();
    const progress = S.useOperativeProgress(slug, period);
    const { tasks } = S.useOperativeChecklist(slug, period);
    const { items: pend } = S.useGeneralPendings();
    const linked = pend.filter((i) => i.campaignSlug === slug && (!period || !i.period || i.period === period));
    const items = buildKeyItems(keyDates, resolveDate);
    const next = nextMilestone(items);
    const nextDays = next && next.start ? dayDiff(next.start, today0()) : null;
    const blocked = tasks.filter((t) => (t.status || (t.done ? "done" : "todo")) === "blocked").length
      + linked.filter((p) => p.status === "blocked").length;
    const openPend = linked.filter((p) => p.status !== "done").length;
    const critPend = linked.filter((p) => p.priority === "high" && p.status !== "done").length;

    return (
      <div className="flex">
        <div className="w-full rounded-2xl border border-border/60 bg-surface-elevated px-4 py-3.5 shadow-soft sm:w-auto sm:min-w-[240px]">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Avance</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{progress.percent}%</span>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">{progress.done}/{progress.total} tareas</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full w-full origin-left rounded-full bg-accent-green transition-transform duration-300 ease-glide" style={{ transform: `scaleX(${(progress.percent || 0) / 100})` }} /></div>
        </div>
      </div>
    );
  }

  /* ============== Strategic summary (Objetivo / Audiencia / Resultado) ============== */
  const SUMMARY_FIELDS = [
    { key: "objective", label: "Objetivo", icon: "Target", placeholder: "Reactivar alumnos desertores mediante campaña multicanal." },
    { key: "audience", label: "Audiencia", icon: "Users", placeholder: "Alumnos con uno o más ciclos sin matrícula." },
    { key: "result", label: "Resultado esperado", icon: "TrendingUp", placeholder: "Superar las métricas de Agosto 2025." },
  ];
  const SUMMARY_DEFAULTS = PROD
    ? { objective: "", audience: "", result: "" }
    : {
      objective: "Reactivar alumnos desertores mediante una campaña multicanal de reenganche.",
      audience: "Alumnos con uno o más ciclos sin matrícula vigente.",
      result: "Superar las métricas de reactivación de Agosto 2025.",
    };
  const summaryKey = (slug, p) => `brief-summary:${slug}:${p}`;
  function readSummary(slug, p) {
    try { return { ...SUMMARY_DEFAULTS, ...(JSON.parse(localStorage.getItem(summaryKey(slug, p)) || "{}")) }; }
    catch { return { ...SUMMARY_DEFAULTS }; }
  }
  function StrategicSummary() {
    const { slug, period } = useBrief();
    const [data, setData] = useState(() => readSummary(slug, period));
    const refs = useRef({});
    const fit = (el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
    const fitAll = () => Object.values(refs.current).forEach(fit);
    useEffect(() => { setData(readSummary(slug, period)); }, [slug, period]);
    useEffect(() => { fitAll(); }, [data]);
    useEffect(() => { const on = () => fitAll(); window.addEventListener("resize", on); const t = setTimeout(fitAll, 60); return () => { window.removeEventListener("resize", on); clearTimeout(t); }; }, []);
    const save = (next) => {
      setData(next);
      try { localStorage.setItem(summaryKey(slug, period), JSON.stringify(next)); } catch {}
    };
    return (
      <Block icon="Lightbulb" title="Resumen estratégico">
        <div className="grid items-start gap-3 sm:grid-cols-3">
          {SUMMARY_FIELDS.map((f) => (
            <div key={f.key} className="rounded-xl border border-border/60 bg-surface/50 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><LucideIcon name={f.icon} className="h-3.5 w-3.5" /> {f.label}</p>
              <Textarea ref={(el) => { refs.current[f.key] = el; }} value={data[f.key]} onChange={(e) => save({ ...data, [f.key]: e.target.value })} onInput={(e) => fit(e.target)} rows={1} placeholder={f.placeholder}
                className="resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] font-medium leading-snug text-foreground shadow-none focus-visible:ring-0" />
            </div>
          ))}
        </div>
      </Block>
    );
  }

  /* ============== Parameter dates (compact mini-cards, inherited from period) ============== */
  function ParamDatesMini() {
    const { params, setParams, addParam, removeParam, slug, period, paramsMode, setParamsMode } = useBrief();
    const inherited = paramsMode !== "custom";
    const update = (id, patch) => {
      const prev = params.find((p) => p.id === id);
      if (prev && patch.date !== undefined && patch.date !== prev.date) S.logChange(slug, period, { kind: "edit", section: inherited ? "Fechas del periodo" : "Fechas parámetro", label: prev.label || "Fecha base", before: prev.date || "—", after: patch.date || "—" });
      setParams(params.map((p) => p.id === id ? { ...p, ...patch } : p));
    };
    return (
      <Block icon="Sliders" title="Fechas parámetro"
        action={
          <div className="flex items-center gap-1.5 print:hidden">
            {inherited
              ? <button type="button" onClick={() => setParamsMode("custom")} className="edit-only inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground"><LucideIcon name="Pencil" className="h-3 w-3" /> Personalizar</button>
              : <button type="button" onClick={() => setParamsMode("global")} className="edit-only inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand hover:bg-brand/10"><LucideIcon name="Undo2" className="h-3 w-3" /> Usar las del periodo</button>}
            {!inherited && <Button variant="ghost" size="sm" onClick={addParam} className="edit-only h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"><LucideIcon name="Plus" className="h-3 w-3" /> Agregar</Button>}
          </div>
        }>
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-surface/50 px-2 py-1 text-[10px]">
          {inherited ? (
            <>
              <LucideIcon name="Globe" className="h-3 w-3 text-brand" />
              <span className="text-muted-foreground">Heredadas del periodo <span className="font-medium text-foreground">{S.formatPeriodShort(period)}</span></span>
              <a href="#/fechas" className="edit-only ml-auto font-medium text-brand hover:underline print:hidden">Configurar</a>
            </>
          ) : (
            <>
              <LucideIcon name="Pencil" className="h-3 w-3 text-accent-amber" />
              <span className="text-muted-foreground">Personalizadas para esta campaña</span>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {params.map((p) => (
            <div key={p.id} className="group/p rounded-lg border border-border/60 bg-surface/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <Input value={p.label} onChange={(e) => update(p.id, { label: e.target.value })} placeholder="Nombre" readOnly={inherited}
                  className="h-5 border-0 bg-transparent p-0 text-[11px] font-medium text-muted-foreground shadow-none focus-visible:ring-0" />
                {!inherited && <button type="button" onClick={() => removeParam(p.id)} aria-label="Eliminar" className="edit-only hidden h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive group-hover/p:flex print:hidden">
                  <LucideIcon name="X" className="h-3 w-3" />
                </button>}
              </div>
              <DatePicker value={p.date} onChange={(v) => update(p.id, { date: v })} disabled={inherited}
                className="h-6 border-0 bg-transparent p-0 text-sm font-semibold tabular-nums text-foreground shadow-none" />
            </div>
          ))}
        </div>
      </Block>
    );
  }

  /* ============== Key dates roadmap (timeline + duration) ============== */
  const ROAD_COLORS = ["bg-brand", "bg-brand/80", "bg-brand/65", "bg-brand/50", "bg-brand/40"];
  function KeyDatesRoadmap() {
    const { keyDates, setKeyDates, params, slug, period } = useBrief();
    const { resolveDate } = useBrief();
    const update = (id, patch) => {
      const prev = keyDates.find((k) => k.id === id);
      if (prev) {
        if (patch.label !== undefined && patch.label !== prev.label) S.logChange(slug, period, { kind: "edit", section: "Fechas clave", label: "Hito renombrado", before: prev.label, after: patch.label });
        if (patch.durationDays !== undefined && patch.durationDays !== prev.durationDays) S.logChange(slug, period, { kind: "edit", section: "Fechas clave", label: `Duración · ${prev.label}`, before: `${prev.durationDays || 1}d`, after: `${patch.durationDays}d` });
        if (patch.offsetDays !== undefined && patch.offsetDays !== prev.offsetDays) S.logChange(slug, period, { kind: "edit", section: "Fechas clave", label: `Ajuste · ${prev.label}`, before: `${prev.offsetDays || 0}d`, after: `${patch.offsetDays}d` });
        if (patch.paramId !== undefined && patch.paramId !== prev.paramId) S.logChange(slug, period, { kind: "edit", section: "Fechas clave", label: `Fecha base · ${prev.label}`, before: (params.find((x) => x.id === prev.paramId) || {}).label || "—", after: (params.find((x) => x.id === patch.paramId) || {}).label || "—" });
      }
      setKeyDates(keyDates.map((k) => k.id === id ? { ...k, ...patch } : k));
    };
    const addRow = () => { S.logChange(slug, period, { kind: "add", section: "Fechas clave", label: "Hito agregado", after: "Nuevo hito" }); setKeyDates([...keyDates, { id: S.uuid(), label: "Nuevo hito", paramId: (params[0] || {}).id || "", offsetDays: 0, durationDays: 3 }]); };
    const removeRow = (id) => { const k = keyDates.find((x) => x.id === id); if (k) S.logChange(slug, period, { kind: "remove", section: "Fechas clave", label: "Hito eliminado", after: k.label }); setKeyDates(keyDates.filter((k) => k.id !== id)); };
    const paramOpts = params.map((p) => [p.id, p.label]);

    const items = buildKeyItems(keyDates, resolveDate);
    const valid = items.filter((x) => x.start && x.end);

    return (
      <Block icon="Route" title="Fechas clave · Roadmap"
        action={<Button variant="ghost" size="sm" onClick={addRow} className="edit-only h-6 gap-1 px-1.5 text-[11px] text-muted-foreground print:hidden"><LucideIcon name="Plus" className="h-3 w-3" /> Hito</Button>}>
        {valid.length > 0 && (
          <div className="mb-3">
            <window.GanttTimeline
              lines={items.filter((x) => x.start && x.end).map((x, i) => ({
                type: "bar", dot: true, color: ROAD_COLORS[i % 5],
                label: x.k.label, start: x.start, end: x.end,
              }))}
              pxDay={14} gutter={150} rowH={20} legend={true} />
          </div>
        )}
        <div className="space-y-1.5">
          {items.map((x, i) => {
            const tone = x.status === "done" ? ST.success : x.status === "active" ? ST.brand : ST.muted;
            return (
              <div key={x.k.id} className="rounded-xl border border-border/60 bg-surface/40 p-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
                  <Input value={x.k.label} onChange={(e) => update(x.k.id, { label: e.target.value })} placeholder="Hito"
                    className="h-6 flex-1 border-0 bg-transparent p-0 text-[13px] font-medium text-foreground shadow-none focus-visible:ring-0" />
                  <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                    {fmtShort(x.start)} <span className="text-border">→</span> {fmtShort(x.end)}
                  </span>
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", tone.soft)}>{x.dur}d</span>
                  <button type="button" onClick={() => removeRow(x.k.id)} aria-label="Eliminar" className="edit-only h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive print:hidden">
                    <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="edit-only mt-1.5 flex flex-wrap items-center gap-1.5 pl-4 print:hidden">
                  <select value={x.k.paramId} onChange={(e) => update(x.k.id, { paramId: e.target.value })} className="h-6 cursor-pointer rounded border border-input bg-transparent px-1 text-[10px] text-muted-foreground">
                    {paramOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">offset
                    <Input type="number" value={x.k.offsetDays} onChange={(e) => update(x.k.id, { offsetDays: Number(e.target.value) || 0 })} className="h-6 w-12 px-1 text-[10px] tabular-nums" /></label>
                  <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">duración
                    <Input type="number" min="1" value={x.k.durationDays || 1} onChange={(e) => update(x.k.id, { durationDays: Math.max(1, Number(e.target.value) || 1) })} className="h-6 w-12 px-1 text-[10px] tabular-nums" /> d</label>
                </div>
              </div>
            );
          })}
        </div>
      </Block>
    );
  }

  /* ============== Communications — rule-based editor ============== */
  // Shared comms vocabulary lives on window (see comms.jsx).
  /* Cronograma de comunicaciones DENTRO del brief (BUG-3C77 / estética).
     Reusa GanttTimeline (el de la vista consolidada: con grid de semanas, ticks
     de mes y línea de HOY) alimentado solo con las comms del brief. Agrupa bajo
     la campaña, colapsable. */
  function BriefCommsTimeline({ comms, slug, period }) {
    const parseISO = (s) => { if (!s) return null; const [y, m, d] = String(s).split("-").map(Number); if (!y || !m || !d) return null; const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt; };
    const WD = window.WEEKDAYS || [];
    const camp = (S.campaigns.find((c) => c.slug === slug) || {});
    const accentToColor = { brand: "#2563eb", violet: "#7c3aed", pink: "#db2777", amber: "#d97706", green: "#16a34a", slate: "#475569" };
    const color = accentToColor[camp.accent] || "#2563eb";
    const [open, setOpen] = useState(true);

    const dated = (comms || []).filter((c) => parseISO(c.start) && parseISO(c.end));
    if (dated.length === 0) {
      return <p className="rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-[12px] text-muted-foreground">Define fechas (inicio y fin) en las comunicaciones para ver el cronograma.</p>;
    }

    const lines = [];
    lines.push({ type: "group", label: `${camp.title || slug} · ${S.formatPeriodShort ? S.formatPeriodShort(period) : period}`, color, collapsed: !open, onToggle: () => setOpen((v) => !v) });
    if (open) {
      dated.forEach((c) => {
        const freq = (c.days || []).length === 7 ? "Diario" : (c.days || []).map((iso) => (WD.find((w) => w.iso === iso) || {}).short).filter(Boolean).join("·");
        lines.push({ type: "bar", label: c.type || "—", color, start: parseISO(c.start), end: parseISO(c.end), text: freq });
      });
    }

    return (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-surface/40 p-2">
        <window.GanttTimeline lines={lines} pxDay={10} gutter={150} legend={false} emptyText="Sin comunicaciones con fechas para mostrar." />
      </div>
    );
  }

  function CommunicationsCards() {
    const { comms, setComms, slug, period, params, resolveDate, toISO } = useBrief();
    /* Por defecto las cards de comunicación salen MINIMIZADas (BUG-8361/7DA7):
       arrancan todas colapsadas; el usuario expande la que quiere ver. */
    const [collapsed, setCollapsed] = useState(() => new Set((comms || []).map((c) => c.id)));
    const toggleCollapse = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allCollapsed = (comms || []).length > 0 && comms.every((c) => collapsed.has(c.id));
    const setAllCollapsed = (val) => setCollapsed(val ? new Set((comms || []).map((c) => c.id)) : new Set());
    const [commView, setCommView] = useState("cards"); // cards | gantt (BUG-3C77)
    /* Cambiar la referencia (fecha clave + offset) materializa la fecha al instante. */
    const updateRef = (id, which, patch) => setComms((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const n = { ...r, ...patch };
      const pid = n[which + "ParamId"];
      if (pid) { const iso = toISO(resolveDate(pid, Number(n[which + "Offset"]) || 0)); if (iso) n[which] = iso; }
      return n;
    }));
    const CH = window.COMM_CHANNELS, WD = window.WEEKDAYS, CT = window.CH_TONE;
    const { Popover } = window;
    const update = (id, patch) => setComms((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
    const toggleArr = (id, key, val) => setComms((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const arr = r[key] || [];
      return { ...r, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    }));
    const chDays = (row, ch) => (row.daysByChannel && row.daysByChannel[ch] && row.daysByChannel[ch].length) ? row.daysByChannel[ch] : ((row.days && row.days.length) ? row.days : [1, 2, 3, 4, 5]);
    const toggleChDay = (id, ch, iso) => setComms((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const base = (r.daysByChannel && r.daysByChannel[ch] && r.daysByChannel[ch].length) ? r.daysByChannel[ch] : ((r.days && r.days.length) ? r.days : [1, 2, 3, 4, 5]);
      const next = base.includes(iso) ? base.filter((x) => x !== iso) : [...base, iso].sort((a, b) => a - b);
      return { ...r, daysByChannel: { ...(r.daysByChannel || {}), [ch]: next } };
    }));
    const addRow = () => setComms((rs) => [...rs, { id: S.uuid(), type: "", channels: [], start: "", end: "", days: [1, 2, 3, 4, 5], objective: "", owner: "", status: "todo" }]);
    const removeRow = (id) => setComms((rs) => rs.filter((r) => r.id !== id));

    return (
      <Block icon="MessageSquare" title="Tipos de comunicación"
        action={
          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5 print:hidden">
              <button type="button" onClick={() => setCommView("cards")} title="Ver como tarjetas"
                className={cn("flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors", commView === "cards" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                <LucideIcon name="LayoutGrid" className="h-3 w-3" /> Tarjetas
              </button>
              <button type="button" onClick={() => setCommView("gantt")} title="Ver como cronograma (Gantt)"
                className={cn("flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors", commView === "gantt" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                <LucideIcon name="GanttChartSquare" className="h-3 w-3" /> Cronograma
              </button>
            </div>
            {commView === "cards" && comms.length > 0 && (
              <button type="button" onClick={() => setAllCollapsed(!allCollapsed)} title={allCollapsed ? "Expandir todas" : "Minimizar todas"}
                className="flex h-6 items-center gap-1 rounded-full border border-border bg-surface px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground print:hidden">
                <LucideIcon name={allCollapsed ? "ChevronsUpDown" : "ChevronsDownUp"} className="h-3 w-3" /> {allCollapsed ? "Expandir" : "Minimizar"}
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={addRow} className="edit-only h-6 gap-1 px-1.5 text-[11px] text-muted-foreground print:hidden"><LucideIcon name="Plus" className="h-3 w-3" /> Agregar</Button>
          </div>
        }>
        {commView === "gantt" ? (
          <BriefCommsTimeline comms={comms} slug={slug} period={period} />
        ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {comms.map((row) => { const isCol = collapsed.has(row.id); return (
            <div key={row.id} className={cn("group/c rounded-xl border border-border/60 bg-surface/40 p-3", isCol && "lg:col-span-1")}>
              <div className={cn("flex items-center gap-1.5", !isCol && "mb-2")}>
                <button type="button" onClick={() => toggleCollapse(row.id)} aria-label={isCol ? "Expandir" : "Minimizar"}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface hover:text-foreground print:hidden">
                  <LucideIcon name={isCol ? "ChevronRight" : "ChevronDown"} className="h-3.5 w-3.5" />
                </button>
                <Input value={row.type} onChange={(e) => update(row.id, { type: e.target.value })} placeholder="Tipo de comunicación"
                  className="h-6 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-foreground shadow-none focus-visible:ring-0" />
                {isCol && (row.channels || []).length > 0 && <span className="shrink-0 text-[10px] text-muted-foreground">{(row.channels || []).length} canal{(row.channels || []).length === 1 ? "" : "es"}</span>}
                {isCol && row.owner && <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">{row.owner}</span>}
                <button type="button" onClick={() => removeRow(row.id)} aria-label="Eliminar" className="edit-only h-5 w-5 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/c:opacity-100 print:hidden"><LucideIcon name="Trash2" className="h-3.5 w-3.5" /></button>
              </div>
              {!isCol && (<>
              {/* rango de fechas — fijas o referenciadas a una fecha clave (inicio y fin pueden usar referencias distintas) */}
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                {["start", "end"].map((which) => (
                  <label key={which} className="block">
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{which === "start" ? "Inicio" : "Fin"}</span>
                    <select value={row[which + "ParamId"] || ""}
                      onChange={(e) => updateRef(row.id, which, { [which + "ParamId"]: e.target.value, [which + "Offset"]: row[which + "Offset"] || 0 })}
                      className="reader-keep mb-1 h-6 w-full cursor-pointer rounded-md border border-border/60 bg-surface/60 px-1 text-[10px] text-muted-foreground focus-visible:outline-none"
                      title="Referencia: fecha fija o relativa a una fecha clave del periodo">
                      <option value="">Fecha fija</option>
                      {params.map((pp) => <option key={pp.id} value={pp.id}>{pp.label}</option>)}
                    </select>
                    {row[which + "ParamId"] ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" value={row[which + "Offset"] ?? 0}
                          onChange={(e) => updateRef(row.id, which, { [which + "Offset"]: e.target.value })}
                          className="h-7 w-14 bg-surface/60 px-1.5 text-[11px] tabular-nums" title="Días de desfase (+/-)" />
                        <span className="min-w-0 flex-1 truncate rounded-md bg-surface/60 px-1.5 py-1.5 text-[10px] tabular-nums text-muted-foreground" title="Fecha resultante (se recalcula sola si la fecha clave cambia)">
                          {row[which] || "—"}
                        </span>
                      </div>
                    ) : (
                      <DatePicker value={row[which]} onChange={(v) => update(row.id, { [which]: v })} className="h-7 bg-surface/60 px-1.5 text-[11px] tabular-nums" />
                    )}
                  </label>
                ))}
              </div>
              {/* channels multi-select */}
              <div className="mb-2">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Canales</span>
                <Popover width="w-44" trigger={
                  <button type="button" className="reader-keep flex w-full items-center justify-between gap-1 rounded-md border border-border/60 bg-surface/60 px-2 py-1.5 text-left transition-colors hover:border-foreground/20">
                    {row.channels && row.channels.length ? (
                      <span className="flex flex-wrap gap-1">{row.channels.map((c) => <span key={c} className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold", CT[c] || "bg-muted text-muted-foreground")}>{c}</span>)}</span>
                    ) : <span className="text-[11px] text-muted-foreground/60">Seleccionar canales…</span>}
                    <LucideIcon name="ChevronDown" className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                }>
                  <div className="max-h-52 space-y-0.5 overflow-y-auto">
                    {CH.map((c) => (
                      <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-accent">
                        <Checkbox checked={(row.channels || []).includes(c)} onCheckedChange={() => toggleArr(row.id, "channels", c)} /> {c}
                      </label>
                    ))}
                  </div>
                </Popover>
              </div>
              {/* days of execution — independent per channel (each channel can run on different days) */}
              <div className="mb-2">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Días de ejecución por canal</span>
                {row.channels && row.channels.length > 0 ? (
                  <div className="space-y-1.5">
                    {row.channels.map((c) => (
                      <div key={c} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn("w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[9px] font-semibold", CT[c] || "bg-muted text-muted-foreground")}>{c}</span>
                        <div className="flex flex-wrap gap-1">
                          {WD.map((d) => {
                            const on = chDays(row, c).includes(d.iso);
                            return (
                              <button key={d.iso} type="button" onClick={() => toggleChDay(row.id, c, d.iso)}
                                className={cn("reader-chip flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-semibold transition-colors", on ? "border-foreground bg-foreground text-background" : "border-border bg-muted text-muted-foreground hover:text-foreground")}
                                title={d.label}>{d.short}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/70">Selecciona canales para definir sus días.</p>
                )}
              </div>
              {/* objective + owner */}
              <div className="flex items-center gap-1.5">
                <LucideIcon name="Target" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input value={row.objective || ""} onChange={(e) => update(row.id, { objective: e.target.value })} placeholder="Objetivo (opcional)"
                  className="h-6 flex-1 border-0 bg-transparent p-0 text-[11px] text-muted-foreground shadow-none focus-visible:ring-0" />
                <window.OwnerSelect value={row.owner || ""} onChange={(v) => update(row.id, { owner: v })} className="h-6 w-24 px-1 text-[11px] text-muted-foreground shadow-none focus-visible:bg-surface" />
              </div>
              </>)}
            </div>
          ); })}
          {comms.length === 0 && <p className="col-span-full rounded-lg border border-dashed border-border bg-surface/40 px-3 py-5 text-center text-xs text-muted-foreground">Sin comunicaciones. Agrega la primera y el cronograma se generará solo.</p>}
        </div>
        )}
      </Block>
    );
  }

  /* ============== Campaign details (responsable + links) ============== */
  function CampaignDetails() {
    const { slug, period, canva, setCanva, dropbox, setDropbox } = useBrief();
    const meta = S.useConfigMeta(slug, period);
    const setResponsable = (v) => {
      if (v !== (meta.responsable || "")) S.logChange(slug, period, { kind: "edit", section: "Responsable", label: "Responsable de campaña", before: meta.responsable || "—", after: v || "—" });
      S.writeConfigMeta(slug, period, { responsable: v });
    };
    const setSupervisor = (v) => {
      if (v !== (meta.supervisor || "")) S.logChange(slug, period, { kind: "edit", section: "Responsable", label: "Supervisor / aprobador", before: meta.supervisor || "—", after: v || "—" });
      S.writeConfigMeta(slug, period, { supervisor: v });
    };
    const setIncludesSpeech = (v) => {
      S.logChange(slug, period, { kind: "edit", section: "Brief", label: "Incluye Speech", before: meta.includesSpeech ? "Sí" : "No", after: v ? "Sí" : "No" });
      S.writeConfigMeta(slug, period, { includesSpeech: v });
    };
    return (
      <Block icon="Link2" title="Responsable y enlaces">
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Responsable</p>
              <window.OwnerSelect framed value={meta.responsable || ""} onChange={setResponsable} className="h-8 bg-surface/50 text-[13px]" />
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><LucideIcon name="ShieldCheck" className="h-3 w-3" /> Supervisor / aprobador</p>
              <window.OwnerSelect framed value={meta.supervisor || ""} onChange={setSupervisor} placeholder="Sin aprobador" className="h-8 bg-surface/50 text-[13px]" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Canva</p>
            <div className="flex items-center gap-1.5">
              <Input value={canva} onChange={(e) => setCanva(e.target.value)} placeholder="https://www.canva.com/…" className="h-8 flex-1 bg-surface/50 text-[12px]" />
              {canva && <a href={canva} target="_blank" rel="noreferrer" className="reader-keep shrink-0 text-muted-foreground hover:text-brand"><LucideIcon name="ExternalLink" className="h-3.5 w-3.5" /></a>}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Dropbox</p>
            <div className="flex items-center gap-1.5">
              <Input value={dropbox} onChange={(e) => setDropbox(e.target.value)} placeholder="https://www.dropbox.com/…" className="h-8 flex-1 bg-surface/50 text-[12px]" />
              {dropbox && <a href={dropbox} target="_blank" rel="noreferrer" className="reader-keep shrink-0 text-muted-foreground hover:text-brand"><LucideIcon name="ExternalLink" className="h-3.5 w-3.5" /></a>}
            </div>
          </div>
          {/* Incluye Speech — brief editor flag; the Speech button appears in the header when enabled */}
          <div className="edit-only flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><LucideIcon name="Mic" className="h-3 w-3" /> Incluye Speech</p>
            <button type="button" role="switch" aria-checked={!!meta.includesSpeech} onClick={() => setIncludesSpeech(!meta.includesSpeech)}
              className={cn("relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40", meta.includesSpeech ? "border-brand bg-brand" : "border-border bg-muted")}>
              <span className={cn("absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-glide", meta.includesSpeech && "translate-x-4")} />
            </button>
          </div>
          {meta.includesSpeech && (
            <a href={`#/speech/${slug}?p=${period}`} className="reader-keep flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface/50 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface">
              <span className="inline-flex items-center gap-1.5"><LucideIcon name="Mic" className="h-3.5 w-3.5 text-muted-foreground" /> Speech de la campaña</span>
              <LucideIcon name="ArrowRight" className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          )}
        </div>
      </Block>
    );
  }

  Object.assign(window, { BriefProvider, useBrief, ExecHeader, BriefToolbar, KpiStrip, StrategicSummary, ParamDatesMini, KeyDatesRoadmap, CommunicationsCards, CampaignDetails, buildKeyItems, nextMilestone, fmtShort });
})();
