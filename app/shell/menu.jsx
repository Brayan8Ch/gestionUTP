/* Inicio — reconstruido desde cero: briefing editorial del día.
   Saludo display, métricas héroe ("¿qué necesita mi atención hoy?"),
   anillo de avance del periodo y acceso sobrio a los módulos. */
(function () {
  const React = window.React;
  const { useMemo, useState, useEffect } = React;
  const ReactDOM = window.ReactDOM;
  const S = window.Store;
  const { LucideIcon } = window;
  const cn = window.cn;

  const MS = 86400000;
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseISOd = (s) => { if (!s) return null; const [y, m, d] = String(s).split("-").map(Number); if (!y || !m || !d) return null; const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt; };
  const daysDiff = (d) => Math.round((d.getTime() - today0().getTime()) / MS);
  const isoWeekday = (d) => (d.getDay() + 6) % 7 + 1;
  const fmtDM = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

  /* Ventana de una campaña: meta sched o fechas del brief. */
  function campaignWindow(slug, period) {
    const meta = S.readConfigMeta(slug, period) || {};
    let start = parseISOd(meta.schedStart), end = parseISOd(meta.schedEnd);
    if (!start || !end) {
      const snap = S.loadBriefSnapshot(slug, period);
      const params = (snap && snap.params) || [];
      const keyDates = (snap && snap.keyDates) || [];
      const pdate = (id) => { const p = params.find((x) => x.id === id); return p ? parseISOd(p.date) : null; };
      let starts = [], ends = [];
      keyDates.forEach((k) => {
        const base = pdate(k.paramId); if (!base) return;
        const s = new Date(base.getTime() + (Number(k.offsetDays) || 0) * MS);
        const e = new Date(s.getTime() + Math.max(1, Number(k.durationDays) || 1) * MS);
        starts.push(s.getTime()); ends.push(e.getTime());
      });
      if (!starts.length) {
        const pd = params.map((p) => parseISOd(p.date)).filter(Boolean).map((d) => d.getTime());
        if (pd.length) { starts = pd; ends = pd; }
      }
      if (!start && starts.length) start = new Date(Math.min(...starts));
      if (!end && ends.length) end = new Date(Math.max(...ends));
    }
    const lead = meta.planLeadDays != null && meta.planLeadDays !== "" ? Math.max(0, Number(meta.planLeadDays) || 0) : null;
    const planStart = lead != null && start ? new Date(start.getTime() - lead * MS) : null;
    return { start, end, planStart };
  }

  /* ---------- anillo de progreso (SVG simple) ---------- */
  function ProgressRing({ percent, size = 116, stroke = 10 }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, Math.max(0, percent)) / 100);
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(var(--c-muted))" strokeWidth={stroke}></circle>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(var(--c-brand))" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold leading-none tracking-tight text-foreground">{percent}%</span>
          <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">avance</span>
        </div>
      </div>
    );
  }

  /* ============ "Mientras no estabas" — estilo Apple (BUG-B19F) ============
     Breve, claro, sin morado: tarjeta limpia, cohete que despega y changelog
     con degradados sutiles. Aparece UNA vez por usuario; cerrar marca visto. */
  function WhatsNewPopup() {
    const ReactDOM = window.ReactDOM;
    const session = S.useSession();
    const myName = session && session.name;
    S.useBugReports();
    const [items, setItems] = useState(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
      if (!myName) return;
      const t = setTimeout(() => {
        try {
          const unseen = S.unseenResolvedBugs(myName);
          if (unseen && unseen.length) { setItems(unseen); setOpen(true); }
        } catch (e) {}
      }, 600);
      return () => clearTimeout(t);
    }, [myName]);

    const close = () => { setOpen(false); try { S.markChangelogSeen(myName); } catch (e) {} };
    if (!open || !items || !items.length) return null;

    const titleOf = (r) => {
      const c = (r.comment || "").trim();
      if (c) return c.length > 72 ? c.slice(0, 70) + "…" : c;
      return `Mejora ${r.id}`;
    };
    const shown = items.slice(0, 6);
    const extra = items.length - shown.length;

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/25 px-4 backdrop-blur-[6px]" role="dialog" aria-label="Novedades"
        onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <style>{`
          @keyframes wn-rocket { 0% { transform: translateY(26px) scale(.92); opacity: 0; } 55% { opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
          @keyframes wn-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          @keyframes wn-trail { 0% { transform: scaleY(.2); opacity: 0; } 40% { opacity: .8; } 100% { transform: scaleY(1); opacity: 0; } }
          @keyframes wn-pop { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
          .wn-rocket { animation: wn-rocket .7s cubic-bezier(.2,.8,.2,1) both, wn-float 3.2s ease-in-out 0.8s infinite; }
          .wn-trail { transform-origin: top; animation: wn-trail 1s ease-out .1s both; }
          .wn-item { animation: wn-pop .45s cubic-bezier(.2,.8,.2,1) both; }
        `}</style>
        <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-elevated dark:border-white/10 dark:bg-surface-elevated">
          {/* Filo degradado superior, sutil */}
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#34c3ff 0%,#7dd87d 35%,#ffb340 70%,#ff6482 100%)" }} />

          {/* Hero: cohete despegando sobre halo degradado */}
          <div className="relative flex flex-col items-center px-7 pb-2 pt-7 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 opacity-60"
              style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(52,195,255,.18), transparent 70%), radial-gradient(40% 60% at 70% 10%, rgba(255,100,130,.12), transparent 70%)" }} />
            <div className="relative mb-3 flex h-16 w-16 items-end justify-center">
              <span className="wn-trail absolute bottom-0 left-1/2 h-7 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-accent-amber via-accent-amber/50 to-transparent" />
              <span className="wn-rocket text-[44px] leading-none" role="img" aria-label="Cohete">🚀</span>
            </div>
            <h2 className="text-[21px] font-bold tracking-tight text-foreground">Mientras no estabas</h2>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {items.length === 1 ? "Hicimos una mejora" : `Hicimos ${items.length} mejoras`} desde tu última visita.
            </p>
          </div>

          {/* Changelog breve con degradados por punto */}
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto px-5 py-3">
            {shown.map((r, i) => (
              <li key={r.id} className="wn-item flex items-center gap-3 rounded-2xl px-2.5 py-2" style={{ animationDelay: `${0.12 + i * 0.06}s` }}>
                <span className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: ["linear-gradient(135deg,#34c3ff,#3478f6)","linear-gradient(135deg,#7dd87d,#34a853)","linear-gradient(135deg,#ffb340,#ff8c2e)","linear-gradient(135deg,#ff6482,#ff2d55)"][i % 4] }} />
                <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground/90" title={r.comment || r.id}>{titleOf(r)}</span>
              </li>
            ))}
            {extra > 0 && <li className="px-2.5 pt-1 text-center text-[11.5px] text-muted-foreground">y {extra} más…</li>}
          </ul>

          {/* Pie minimal */}
          <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-2">
            <button type="button" onClick={close}
              className="w-full rounded-full bg-foreground py-2.5 text-[14px] font-semibold text-background transition-transform active:scale-[0.98]">
              Entendido
            </button>
            <a href="#/configuracion/fallos" onClick={close} className="text-[12px] font-medium text-brand hover:underline">Ver historial completo</a>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function MenuPage() {
    const campaigns = S.useCampaigns();
    const { items } = S.useGeneralPendings();
    S.useAvailablePeriods();
    const periods = S.listAvailablePeriods();
    const members = S.useMembers();
    const requests = S.useDesignRequests();
    const session = S.useSession();
    const gate = S.useModuleGate();
    const MODKEY = { "cron-comms": "cronComms", "cron-campanas": "cronCampanas", "fallos": "equipo" };

    const GROUPS = ["Todos", "Campañas", "Operativa", "Configuración"];
    const [groupFilter, setGroupFilter] = useState("Todos");

    /* Alcance del dashboard: un admin/supervisor (approveTasks) ve el avance
       GENERAL del equipo; un usuario normal ve solo SUS pendientes. */
    const seesAll = S.useCan("approveTasks");
    const myName = session && session.name;
    const mineOnly = (r) => seesAll || (r.owner && String(r.owner).trim() === myName);

    /* ---------- métricas: el Inicio agrega TODOS los periodos (nada queda oculto) ---------- */
    const M = useMemo(() => {
      const t = today0();
      const wd = (t.getDay() + 6) % 7; const weekStart = new Date(t.getTime() - wd * MS); const weekEnd = new Date(weekStart.getTime() + 6 * MS);

      let configured = 0, approved = 0, pending = 0;
      const configuredSlugs = new Set();
      const rows = [];
      let sends = 0, sendsWeek = 0, channelSet = new Set();
      let enCurso = 0, nextStart = null;
      const enCursoList = [];

      periods.forEach((p) => {
        campaigns.forEach((c) => {
          if (!S.isCampaignConfigured(c.slug, p)) return;
          configured++;
          configuredSlugs.add(c.slug);
          if (S.getCampaignStatus(c.slug, p) === "approved") approved++; else pending++;
          const tasks = S.readOperativeTasks(c.slug, p);
          tasks.forEach((task) => { if (mineOnly(task)) rows.push({ ...task, _c: c.title, _p: p, _slug: c.slug }); });
          (S.readComms(c.slug, p) || []).forEach((cm) => {
            const s = parseISOd(cm.start), e = parseISOd(cm.end);
            if (!s || !e || e < s) return;
            const defaultDays = cm.days && cm.days.length ? cm.days : [1, 2, 3, 4, 5];
            const channels = cm.channels && cm.channels.length ? cm.channels : ["—"];
            channels.forEach((ch) => ch !== "—" && channelSet.add(ch));
            const daysFor = (ch) => cm.daysByChannel && cm.daysByChannel[ch] && cm.daysByChannel[ch].length ? cm.daysByChannel[ch] : defaultDays;
            let guard = 0;
            for (let d = new Date(s); d <= e && guard < 800; d = new Date(d.getTime() + MS), guard++) {
              const w = isoWeekday(d);
              channels.forEach((ch) => {
                if (!daysFor(ch).includes(w)) return;
                sends += 1;
                if (d >= weekStart && d <= weekEnd) sendsWeek += 1;
              });
            }
          });
          const w = campaignWindow(c.slug, p);
          if (w.start) {
            if (w.start <= t && (!w.end || w.end >= t)) {
              enCurso++;
              const scoped = tasks.filter(mineOnly);
              const tdone = scoped.filter((x) => x.done || x.status === "done").length;
              enCursoList.push({ slug: c.slug, title: c.title, period: p, end: w.end, responsable: (S.readConfigMeta(c.slug, p) || {}).responsable || "", pct: scoped.length ? Math.round(tdone / scoped.length * 100) : 0 });
            }
            if (w.start > t && (!nextStart || w.start < nextStart)) nextStart = w.start;
          }
        });
      });
      items.forEach((i) => { if (!mineOnly(i)) return; const c = campaigns.find((x) => x.slug === i.campaignSlug); rows.push({ ...i, _c: c ? c.title : "General", _p: i.period || "", _slug: i.campaignSlug || null }); });

      let total = 0, done = 0, overdue = 0, blocked = 0, dueToday = 0, open = 0, unassigned = 0, weekDone = 0, weekScope = 0, weekScopeDone = 0;
      rows.forEach((r) => {
        const st = r.status || (r.done ? "done" : "todo");
        total++;
        /* Alcance semanal: lo que vence esta semana + los atrasados con los que iniciamos la semana */
        const dd = parseISOd(r.deadline);
        if (dd && dd <= weekEnd) { weekScope++; if (st === "done") weekScopeDone++; }
        if (st === "done") { done++; const d0 = parseISOd(r.deadline); if (d0 && d0 >= weekStart && d0 <= weekEnd) weekDone++; return; }
        open++;
        if (st === "blocked") blocked++;
        if (!(r.owner && String(r.owner).trim())) unassigned++;
        const d = parseISOd(r.deadline);
        if (d) { const dl = daysDiff(d); if (dl < 0) overdue++; else if (dl === 0) dueToday++; }
      });
      const percent = total ? Math.round(done / total * 100) : 0;
      const draft = campaigns.filter((c) => !configuredSlugs.has(c.slug)).length;

      /* Listas para la vista principal:
         — retrasados = deadline ANTES del lunes de esta semana (arrastre de semanas anteriores)
         — esta semana = deadline de lunes a domingo (aunque ya haya pasado el día) */
      const weekItems = [], overdueItems = [];
      rows.forEach((r) => {
        const st = r.status || (r.done ? "done" : "todo");
        if (st === "done") return;
        const d = parseISOd(r.deadline);
        if (!d) return;
        const dl = daysDiff(d);
        if (d < weekStart) overdueItems.push({ ...r, _dl: dl });
        else if (d <= weekEnd) weekItems.push({ ...r, _dl: dl });
      });
      overdueItems.sort((a, b) => a._dl - b._dl);
      weekItems.sort((a, b) => a._dl - b._dl);
      enCursoList.sort((a, b) => (a.end && b.end ? a.end - b.end : a.end ? -1 : 1));
      const DR_ACTIVE = { pending: 1, in_design: 1, delivered: 1, in_review: 1, feedback: 1 };
      const designs = requests.filter((r) => DR_ACTIVE[r.status]).sort((a, b) => ((a.deadline || "9999") < (b.deadline || "9999") ? -1 : 1));

      return {
        totalCampaigns: campaigns.length, configured, approved, pending, draft,
        total, done, percent, overdue, blocked, dueToday, open, unassigned,
        sends, sendsWeek, channels: channelSet.size, enCurso, nextStart,
        weekItems, overdueItems, enCursoList, designs, weekDone,
        weekScope, weekScopeDone, weekPct: weekScope ? Math.round(weekScopeDone / weekScope * 100) : 0,
        activeMembers: members.filter((m) => m.status === "active").length,
        drOpen: requests.filter((r) => r.status !== "approved").length,
        drReview: requests.filter((r) => r.status === "in_review").length,
      };
    }, [campaigns, items, periods.join("|"), members, requests, seesAll, myName]);

    /* ---------- módulos ---------- */
    const allBugs = S.useBugReports ? S.useBugReports() : [];
    const bugCount = allBugs.filter((r) => (r.report.status || "open") !== "resolved").length;
    const MODULES = [
      { key: "brief", group: "Campañas", href: "#/campanas/brief", icon: "Megaphone", accent: "brand", title: "Brief", metric: `${M.configured} ${M.configured === 1 ? "configuración" : "configuraciones"} · ${M.approved} aprobadas` },
      { key: "speech", group: "Campañas", href: "#/campanas/speech", icon: "Mic", accent: "fuchsia", title: "Speech", metric: "Guiones de apertura por campaña" },
      { key: "argumentario", group: "Campañas", href: "#/campanas/argumentario", icon: "Quote", accent: "ink", title: "Argumentario", metric: "Banco central de argumentos" },
      { key: "cron-comms", group: "Campañas", href: "#/campanas/cronograma-comms", icon: "Send", accent: "cyan", title: "Cronograma de comms", metric: `${M.sends} envíos · ${M.sendsWeek} esta semana` },
      { key: "cron-campanas", group: "Campañas", href: "#/campanas/cronograma-campanas", icon: "CalendarRange", accent: "amber", title: "Cronograma de campañas", metric: M.nextStart ? `${M.enCurso} en curso · próx. ${fmtDM(M.nextStart)}` : `${M.enCurso} en curso` },
      { key: "centro", group: "Operativa", href: "#/operativa/centro", icon: "Gauge", accent: "green", title: "Centro de operaciones", metric: `${M.percent}% avance · ${M.overdue} atrasadas` },
      { key: "pendiente", group: "Operativa", href: "#/operativa/pendiente", icon: "ListChecks", accent: "violet", title: "Mis pendientes", metric: `${M.open} abiertos · ${M.unassigned} sin asignar` },
      { key: "solicitudes", group: "Operativa", href: "#/operativa/solicitudes", icon: "Palette", accent: "pink", title: "Solicitudes de diseño", metric: `${M.drOpen} en proceso · ${M.drReview} en revisión` },
      { key: "resumen", group: "Operativa", href: "#/operativa/resumen", icon: "FileText", accent: "ink", title: "Resumen ejecutivo", metric: "Síntesis automática para gerencia" },
      { key: "equipo", group: "Configuración", href: "#/configuracion/equipo", icon: "Users", accent: "slate", title: "Equipo", metric: `${M.activeMembers} miembros activos` },
      { key: "fechas", group: "Configuración", href: "#/configuracion/fechas", icon: "CalendarCog", accent: "slate", title: "Fechas del periodo", metric: "Parámetros base del periodo" },
      { key: "ayuda", group: "Configuración", href: "#/configuracion/ayuda", icon: "CircleHelp", accent: "slate", title: "Documentación", metric: "Guías de uso de cada módulo" },
      { key: "fallos", group: "Configuración", href: "#/configuracion/fallos", icon: "Bug", accent: "slate", title: "Reporte de fallos", metric: bugCount > 0 ? `${bugCount} reporte${bugCount === 1 ? "" : "s"} sin revisar` : "Sin fallos reportados" },
    ];
    const FEATURED = new Set(["pendiente", "resumen"]); // ya destacados arriba
    let visible = MODULES.filter((m) => !FEATURED.has(m.key) && (groupFilter === "Todos" || m.group === groupFilter) && gate(MODKEY[m.key] || m.key));
    /* Orden automático por uso — únicamente con el filtro en "Todos". */
    let topUsedKey = null;
    if (groupFilter === "Todos") {
      let usage = {};
      try { usage = JSON.parse(localStorage.getItem("module-usage:v1") || "{}") || {}; } catch {}
      const uOf = (m) => usage[MODKEY[m.key] || m.key] || 0;
      visible = visible.map((m, i) => [m, i]).sort((a, b) => (uOf(b[0]) - uOf(a[0])) || (a[1] - b[1])).map(([m]) => m);
      if (visible.length && uOf(visible[0]) > 0) topUsedKey = visible[0].key;
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const firstName = session && session.name ? session.name.split(" ")[0] : null;

    /* Resumen: 4 indicadores con barra de progreso */
    const wkDue = M.weekItems.length;
    const wkPct = (M.weekDone + wkDue) ? Math.round(M.weekDone / (M.weekDone + wkDue) * 100) : 0;
    const ovPct = M.open ? Math.round(M.overdueItems.length / M.open * 100) : 0;
    const cursoPct = M.enCursoList.length ? Math.round(M.enCursoList.reduce((a, c) => a + c.pct, 0) / M.enCursoList.length) : 0;
    const DSTAGE = { pending: 0, in_design: 25, delivered: 50, in_review: 75, feedback: 50 };
    const dsPct = M.designs.length ? Math.round(M.designs.reduce((a, r) => a + (DSTAGE[r.status] || 0), 0) / M.designs.length) : 0;
    /* Frase del saludo, alineada con la semántica de los mosaicos */
    const heroParts = [];
    if (M.overdue) heroParts.push(`${M.overdue} ${M.overdue === 1 ? "tarea vencida" : "tareas vencidas"}${M.overdueItems.length ? ` (${M.overdueItems.length} de semanas anteriores)` : ""}`);
    if (M.blocked) heroParts.push(`${M.blocked} en revisión`);
    const heroLine = heroParts.length ? `Hay ${heroParts.join(" y ")} que necesitan tu atención.` : "La operación va según lo planificado. Nada urgente por ahora.";
    const SUMMARY = [
      { show: gate("centro"), href: "#/operativa/centro", icon: "CalendarClock", chip: "bg-accent-amber/15 text-accent-amber",
        n: wkDue, numTone: wkDue ? "text-accent-amber" : "text-foreground/30", label: "Pendientes de esta semana",
        pct: wkPct, bar: "bg-accent-amber", caption: `${M.weekDone} resuelta${M.weekDone === 1 ? "" : "s"} · ${wkDue} abierta${wkDue === 1 ? "" : "s"} esta semana · ${wkPct}%` },
      { show: gate("centro"), href: "#/operativa/centro", icon: "AlarmClockOff", chip: "bg-destructive/10 text-destructive",
        n: M.overdueItems.length, numTone: M.overdueItems.length ? "text-destructive" : "text-foreground/30", label: "Retrasados de semanas pasadas",
        pct: ovPct, bar: "bg-destructive", caption: M.overdueItems.length ? `Arrastre de semanas anteriores · ${ovPct}% de lo abierto` : "Sin arrastre · todo en plazo" },
      { show: gate("brief") || gate("cronCampanas"), href: "#/campanas/cronograma-campanas", icon: "Megaphone", chip: "bg-accent-green/10 text-accent-green",
        n: M.enCursoList.length, numTone: M.enCursoList.length ? "text-accent-green" : "text-foreground/30", label: "Campañas en curso",
        pct: cursoPct, bar: "bg-accent-green", caption: M.enCursoList.length ? `Avance promedio ${cursoPct}%` : "Ninguna activa hoy" },
      { show: gate("solicitudes"), href: "#/operativa/solicitudes", icon: "Palette", chip: "bg-accent-pink/10 text-accent-pink",
        n: M.designs.length, numTone: M.designs.length ? "text-accent-pink" : "text-foreground/30", label: "Diseños en curso",
        pct: dsPct, bar: "bg-accent-pink", caption: M.designs.length ? `Pipeline al ${dsPct}% · ${M.designs.filter((r) => r.status === "feedback").length} con feedback` : "Sin pedidos activos" },
    ].filter((s) => s.show);

    return (
      <div className="relative min-h-screen bg-background" data-screen-label="Inicio · Workspace">
        <WhatsNewPopup />
        <window.SectionWash />
        <main className="mx-auto w-full max-w-5xl px-5 pb-12 pt-10 sm:px-8 sm:pt-14 lg:px-10">

          {/* ---------- saludo editorial ---------- */}
          <header className="rise">
            <div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {today0().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[44px]">
                  {greeting}{firstName ? `, ${firstName}` : ""}.
                </h1>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{heroLine}</p>
              </div>
            </div>
          </header>

          {/* ---------- resumen del estado: 4 indicadores con barra de progreso ---------- */}
          <section aria-label="Resumen" className="rise rise-1 mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUMMARY.map((s) => (
              <a key={s.label} href={s.href}
                className="group rounded-2xl border border-border bg-surface-elevated p-5 shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-glow">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", s.chip)}>
                    <LucideIcon name={s.icon} className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className={cn("text-[30px] font-bold leading-none tracking-tight tabular-nums", s.numTone)}>{s.n}</span>
                </div>
                <p className="mt-3 truncate text-[12.5px] font-semibold text-foreground">{s.label}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full transition-[width] duration-500 ease-glide", s.bar)} style={{ width: `${Math.min(100, Math.max(0, s.pct))}%` }}></span>
                </div>
                <p className="mt-1.5 truncate text-[10.5px] text-muted-foreground">{s.caption}</p>
              </a>
            ))}
          </section>

          {/* ---------- avance del periodo + resumen ejecutivo ---------- */}
          <section aria-label="Avance del periodo" className="rise rise-2 mt-3 grid gap-3">
            <div className="flex items-center gap-6 rounded-2xl border border-border bg-surface-elevated p-6 shadow-soft">
              <ProgressRing percent={M.weekPct} />
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground">
                  Avance de la semana
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", seesAll ? "bg-brand/10 text-brand" : "bg-accent-violet/10 text-accent-violet")}>
                    <LucideIcon name={seesAll ? "Users" : "User"} className="h-3 w-3" /> {seesAll ? "Equipo" : "Mis tareas"}
                  </span>
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {M.weekScopeDone} de {M.weekScope} {seesAll ? "pendientes del equipo" : "de tus pendientes"} resueltos — los que vencen esta semana más los atrasados con los que iniciamos · {M.configured} {M.configured === 1 ? "configuración activa" : "configuraciones activas"} en {periods.length} periodos
                </p>
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", M.approved ? "bg-accent-green/10 text-accent-green" : "bg-muted text-muted-foreground")}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current"></span>{M.approved} aprobadas
                  </span>
                  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", M.pending ? "bg-accent-amber/15 text-accent-amber" : "bg-muted text-muted-foreground")}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current"></span>{M.pending} pend. aprobación
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-current"></span>{M.draft} sin habilitar
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Atajos destacados: Mis pendientes + Resumen ejecutivo, lado a lado */}
          {(gate("pendiente") || gate("resumen")) && (
          <section aria-label="Atajos" className="rise rise-2 mt-3 grid gap-3 sm:grid-cols-2">
            {gate("pendiente") && (
            <a href="#/operativa/pendiente"
              className="group flex flex-col justify-between rounded-2xl bg-accent-violet p-6 text-white shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-glow">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><LucideIcon name="ListChecks" className="h-5 w-5" strokeWidth={1.8} /></span>
                <h2 className="mt-3 text-[17px] font-semibold leading-snug">Mis pendientes</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/70">
                  {M.open > 0 ? `${M.open} ${M.open === 1 ? "tarea abierta" : "tareas abiertas"}${M.unassigned ? ` · ${M.unassigned} sin asignar` : ""}.` : "Todo al día — sin pendientes abiertos."}
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium">
                Abrir <LucideIcon name="ArrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
            )}
            {gate("resumen") && (
            <a href="#/operativa/resumen"
              className="group flex flex-col justify-between rounded-2xl bg-primary p-6 text-primary-foreground shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-glow">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10"><LucideIcon name="FileText" className="h-5 w-5 opacity-90" strokeWidth={1.8} /></span>
                <h2 className="mt-3 text-[17px] font-semibold leading-snug">Resumen ejecutivo</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-primary-foreground/65">Síntesis del día generada automáticamente, lista para gerencia.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium">
                Abrir <LucideIcon name="ArrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
            )}
          </section>
          )}

          {/* ---------- módulos ---------- */}
          <section aria-label="Módulos" className="rise rise-3 mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[19px] font-bold tracking-tight text-foreground">Módulos</h2>
              <div role="tablist" aria-label="Filtrar módulos" className="inline-flex items-center rounded-full bg-muted p-1">
                {GROUPS.map((g) => (
                  <button key={g} type="button" role="tab" aria-selected={groupFilter === g} onClick={() => setGroupFilter(g)}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-200",
                      groupFilter === g ? "bg-surface-elevated text-foreground shadow-soft" : "text-foreground/55 hover:text-foreground"
                    )}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <nav className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Módulos del workspace">
              {visible.map((m) => (
                <a key={m.key} href={m.href}
                  className="group flex items-center gap-3.5 rounded-2xl border border-border bg-surface-elevated p-4 shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-glow">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white" style={{ background: (window.SECTION_GRAD || {})[m.accent] }}>
                    <LucideIcon name={m.icon} className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-foreground">
                      <span className="truncate">{m.title}</span>
                      {m.key === topUsedKey && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-amber" title="Tu módulo más utilizado">
                          <LucideIcon name="Flame" className="h-2.5 w-2.5" /> Más usado
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{m.metric}</span>
                  </span>
                  <LucideIcon name="ChevronRight" className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </a>
              ))}
            </nav>
          </section>

          <footer className="rise rise-4 mt-14 text-center text-[11px] text-muted-foreground">
            Retención UTP · Workspace de campañas · {new Date().getFullYear()}
          </footer>
        </main>
      </div>
    );
  }

  Object.assign(window, { MenuPage });
})();
