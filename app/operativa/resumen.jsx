/* Resumen ejecutivo — síntesis automática del periodo para visibilidad gerencial.
   Se genera en vivo desde los datos del workspace: campañas, tareas, comms y solicitudes.
   Imprimible (Cmd/Ctrl+P) gracias a los estilos print globales. */
(function () {
  const React = window.React;
  const { useMemo } = React;
  const S = window.Store;
  const { LucideIcon } = window;
  const cn = window.cn;

  const MS = 86400000;
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseISOd = (s) => { if (!s) return null; const [y, m, d] = String(s).split("-").map(Number); if (!y || !m || !d) return null; const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt; };
  const daysDiff = (d) => Math.round((d.getTime() - today0().getTime()) / MS);
  const isoWeekday = (d) => (d.getDay() + 6) % 7 + 1;
  const fmtDM = (d) => d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  function ResumenPage() {
    const campaigns = S.useCampaigns();
    const perSel = S.useSelectedPeriods("all");
    const selPeriods = perSel.periods;
    const multi = selPeriods.length > 1;
    const periodHeader = perSel.value === "all" ? "Todos los periodos" : multi ? `${selPeriods.length} periodos seleccionados` : `Periodo ${S.formatPeriodLabel(selPeriods[0])}`;
    const { items } = S.useGeneralPendings();
    const requests = S.useDesignRequests();

    const R = useMemo(() => {
      const t = today0();
      const wd = (t.getDay() + 6) % 7;
      const weekStart = new Date(t.getTime() - wd * MS);
      const weekEnd = new Date(weekStart.getTime() + 6 * MS);
      const byList = campaigns.reduce((acc, c) => { acc[c.slug] = c; return acc; }, {});

      /* Pares (campaña × periodo) habilitados dentro de la selección */
      const pairs = [];
      selPeriods.forEach((p) => campaigns.forEach((c) => { if (S.isCampaignConfigured(c.slug, p)) pairs.push({ c, p }); }));
      const pairTitle = ({ c, p }) => multi ? `${c.title} · ${S.formatPeriodLabel(p)}` : c.title;
      let approved = 0, pendingApproval = 0;
      pairs.forEach(({ c, p }) => { S.getCampaignStatus(c.slug, p) === "approved" ? approved++ : pendingApproval++; });

      /* Tareas: campañas + pendientes generales */
      const rows = [];
      pairs.forEach((pr) => S.readOperativeTasks(pr.c.slug, pr.p).forEach((task) => rows.push({ ...task, campaign: pairTitle(pr) })));
      items.filter((i) => !i.period || selPeriods.includes(i.period)).forEach((i) => {
        rows.push({ ...i, campaign: i.campaignSlug && byList[i.campaignSlug] ? byList[i.campaignSlug].title : "General" });
      });
      let total = 0, done = 0, overdue = 0, blocked = 0, dueToday = 0;
      const risks = [];
      rows.forEach((r) => {
        const st = r.status || (r.done ? "done" : "todo");
        total++;
        if (st === "done") { done++; return; }
        const d = parseISOd(r.deadline);
        const dl = d ? daysDiff(d) : null;
        if (st === "blocked") { blocked++; return; } /* en revisión: trabajo hecho, no es riesgo */
        if (dl != null && dl < 0) { overdue++; risks.push({ ...r, kind: "overdue", dl }); }
        else if (dl === 0) dueToday++;
      });
      const percent = total ? Math.round(done / total * 100) : 0;
      risks.sort((a, b) => (a.dl ?? 0) - (b.dl ?? 0));

      /* Comunicaciones: envíos de esta semana */
      let sendsWeek = 0; const channelSet = new Set();
      pairs.forEach(({ c, p }) => {
        (S.readComms(c.slug, p) || []).forEach((cm) => {
          const s = parseISOd(cm.start), e = parseISOd(cm.end);
          if (!s || !e || e < s) return;
          const defaultDays = cm.days && cm.days.length ? cm.days : [1, 2, 3, 4, 5];
          const channels = cm.channels && cm.channels.length ? cm.channels : ["—"];
          const daysFor = (ch) => cm.daysByChannel && cm.daysByChannel[ch] && cm.daysByChannel[ch].length ? cm.daysByChannel[ch] : defaultDays;
          let guard = 0;
          for (let d = new Date(Math.max(s, weekStart)); d <= e && d <= weekEnd && guard < 60; d = new Date(d.getTime() + MS), guard++) {
            const w = isoWeekday(d);
            channels.forEach((ch) => { if (daysFor(ch).includes(w)) { sendsWeek++; if (ch !== "—") channelSet.add(ch); } });
          }
        });
      });

      /* Próximos hitos: fechas clave de los briefs */
      const milestones = [];
      pairs.forEach((pr) => {
        const snap = S.loadBriefSnapshot(pr.c.slug, pr.p);
        if (!snap) return;
        const params = snap.params || [];
        (snap.keyDates || []).forEach((k) => {
          const p = params.find((x) => x.id === k.paramId);
          const base = p ? parseISOd(p.date) : null;
          if (!base) return;
          const date = new Date(base.getTime() + (Number(k.offsetDays) || 0) * MS);
          const dl = daysDiff(date);
          if (dl >= 0) milestones.push({ label: k.label, campaign: pairTitle(pr), date, dl });
        });
      });
      milestones.sort((a, b) => a.date - b.date);

      /* Solicitudes de diseño */
      const drOpen = requests.filter((r) => r.status !== "approved").length;
      const drReview = requests.filter((r) => r.status === "in_review").length;
      const drFeedback = requests.filter((r) => r.status === "feedback").length;

      /* Lectura ejecutiva: narrativa auto-generada con reglas simples */
      const reading = [];
      reading.push({ icon: "Gauge", tone: percent >= 70 ? "green" : percent >= 40 ? "amber" : "red",
        text: `El equipo lleva un ${percent}% de avance global (${done} de ${plural(total, "tarea", "tareas")} completadas) en ${multi ? periodHeader.toLowerCase() : `el ${periodHeader.toLowerCase()}`}.` });
      reading.push({ icon: "Megaphone", tone: pendingApproval ? "amber" : "green",
        text: multi
          ? `${plural(pairs.length, "configuración de campaña habilitada", "configuraciones de campaña habilitadas")} en ${selPeriods.length} periodos: ${approved} aprobadas y ${pendingApproval} pendientes de aprobación.`
          : `${plural(pairs.length, "campaña habilitada", "campañas habilitadas")} de ${campaigns.length}: ${approved} aprobadas y ${pendingApproval} pendientes de aprobación.` });
      if (overdue) {
        const worst = risks[0];
        reading.push({ icon: "AlertTriangle", tone: "red",
          text: `Atención: ${plural(overdue, "tarea atrasada", "tareas atrasadas")}.${worst ? ` La más crítica es «${worst.title}»${worst.owner ? ` (${worst.owner})` : ""}.` : ""}` });
      } else {
        reading.push({ icon: "CheckCircle2", tone: "green", text: "Sin tareas atrasadas: la operación va según lo planificado." });
      }
      if (blocked) reading.push({ icon: "Hourglass", tone: "amber",
        text: `${plural(blocked, "tarea en revisión", "tareas en revisión")} esperando aprobación del administrador.` });
      reading.push({ icon: "Send", tone: "fg",
        text: sendsWeek ? `Esta semana hay ${plural(sendsWeek, "envío programado", "envíos programados")} en ${plural(channelSet.size, "canal", "canales")}.` : "No hay envíos de comunicaciones programados esta semana." });
      if (drOpen) reading.push({ icon: "Palette", tone: drFeedback ? "red" : "fg",
        text: `${plural(drOpen, "solicitud de diseño abierta", "solicitudes de diseño abiertas")}: ${drReview} en revisión y ${drFeedback} con feedback por resolver.` });
      if (milestones[0]) reading.push({ icon: "Flag", tone: "fg",
        text: `Próximo hito: «${milestones[0].label}» de ${milestones[0].campaign}, ${milestones[0].dl === 0 ? "hoy" : milestones[0].dl === 1 ? "mañana" : `en ${milestones[0].dl} días`} (${fmtDM(milestones[0].date)}).` });

      return { percent, total, done, configured: pairs.length, totalCampaigns: campaigns.length, approved, pendingApproval,
        overdue, blocked, dueToday, sendsWeek, channels: channelSet.size, drOpen, drReview, drFeedback,
        risks: risks.slice(0, 6), milestones: milestones.slice(0, 5), reading };
    }, [campaigns, selPeriods.join(","), multi, periodHeader, items, requests]);

    const TONE_TEXT = { green: "text-accent-green", amber: "text-accent-amber", red: "text-destructive", fg: "text-foreground" };
    const TONE_CHIP = { green: "bg-accent-green/10 text-accent-green", amber: "bg-accent-amber/15 text-accent-amber", red: "bg-destructive/10 text-destructive", fg: "bg-brand-soft text-brand" };

    /* Automatización del seguimiento diario: digest de texto listo para WhatsApp/correo. */
    const copyDigest = () => {
      const dateStr = today0().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
      const lines = [];
      lines.push(`RESUMEN DEL DÍA — ${dateStr} · ${periodHeader}`);
      lines.push("");
      R.reading.forEach((b) => lines.push(`• ${b.text}`));
      if (R.risks.length) {
        lines.push("");
        lines.push("Riesgos:");
        R.risks.forEach((r) => lines.push(`– ${r.title || "Tarea"} (${r.campaign}${r.owner ? ` · ${r.owner}` : ""}) — ${r.kind === "blocked" ? "bloqueada" : `${Math.abs(r.dl)} d de atraso`}`));
      }
      if (R.milestones.length) {
        lines.push("");
        lines.push("Próximos hitos:");
        R.milestones.forEach((m) => lines.push(`– ${fmtDM(m.date)} · ${m.label} (${m.campaign})`));
      }
      const text = lines.join("\n");
      const ok = () => { if (window.toast) window.toast("Resumen del día copiado al portapapeles"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
      } else fallbackCopy(text, ok);
    };
    const fallbackCopy = (text, ok) => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch {}
      document.body.removeChild(ta);
    };

    const KPIS = [
      { value: `${R.percent}%`, label: "Avance global", tone: R.percent >= 70 ? "green" : R.percent >= 40 ? "amber" : "red" },
      { value: multi ? `${R.configured}` : `${R.configured}/${R.totalCampaigns}`, label: multi ? "Config. habilitadas" : "Campañas habilitadas", tone: "fg" },
      { value: R.approved, label: "Aprobadas", tone: R.approved ? "green" : "fg" },
      { value: R.overdue, label: "Tareas atrasadas", tone: R.overdue ? "red" : "fg" },
      { value: R.blocked, label: "En revisión", tone: R.blocked ? "amber" : "fg" },
      { value: R.sendsWeek, label: "Envíos esta semana", tone: "fg" },
    ];

    return (
      <div className="relative min-h-screen bg-background" data-screen-label="Resumen ejecutivo">
        <window.SectionWash accent="ink" />
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <window.PageToolbar back="#/" backLabel="Volver al menú">
            <window.PeriodFilter />
            <button type="button" onClick={copyDigest}
              className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
              <LucideIcon name="Copy" className="h-3.5 w-3.5" strokeWidth={1.9} /> Copiar resumen del día
            </button>
            <button type="button" onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface-elevated px-3.5 text-[12px] font-medium text-foreground shadow-soft transition-colors hover:bg-surface">
              <LucideIcon name="Printer" className="h-3.5 w-3.5" strokeWidth={1.9} /> Imprimir / PDF
            </button>
          </window.PageToolbar>

          <window.SectionHeader accent="ink" icon="FileText" size="lg" title="Resumen ejecutivo"
            subtitle={`${today0().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${periodHeader} · Generado automáticamente`} />

          {/* KPI strip */}
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-soft">
                <p className={cn("text-2xl font-bold tracking-tight", TONE_TEXT[k.tone])}>{k.value}</p>
                <p className="mt-1 text-[11px] font-medium leading-snug text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-5">
            {/* Lectura ejecutiva */}
            <section aria-label="Lectura ejecutiva" className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-soft lg:col-span-3">
              <h2 className="text-base font-semibold text-foreground">Lectura ejecutiva</h2>
              <ul className="mt-4 space-y-3.5">
                {R.reading.map((b, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE_CHIP[b.tone])}>
                      <LucideIcon name={b.icon} className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <p className="text-[14px] leading-relaxed text-foreground/90">{b.text}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Riesgos y desvíos */}
            <section aria-label="Riesgos y desvíos" className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-soft lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Riesgos y desvíos</h2>
                <a href="#/operativa/centro" className="text-[12px] font-medium text-brand hover:underline">Ver todo</a>
              </div>
              {R.risks.length === 0 ? (
                <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-green/10 text-accent-green"><LucideIcon name="CheckCircle2" className="h-5 w-5" /></span>
                  <p className="text-[13px] text-muted-foreground">Sin riesgos activos. Todo en plazo.</p>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-border/60">
                  {R.risks.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", r.kind === "blocked" ? "bg-accent-violet" : "bg-destructive")}></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{r.title || "Tarea"}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.campaign}{r.owner ? ` · ${r.owner}` : ""}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", r.kind === "blocked" ? "bg-accent-violet/10 text-accent-violet" : "bg-destructive/10 text-destructive")}>
                        {r.kind === "blocked" ? "Bloqueada" : `${Math.abs(r.dl)} d atrás`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Próximos hitos */}
          <section aria-label="Próximos hitos" className="mt-5 rounded-2xl border border-border bg-surface-elevated p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Próximos hitos</h2>
              <a href="#/campanas/cronograma-campanas" className="text-[12px] font-medium text-brand hover:underline">Cronograma completo</a>
            </div>
            {R.milestones.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-muted-foreground">
                No hay fechas clave próximas en los briefs de la selección.
              </p>
            ) : (
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {R.milestones.map((m, i) => (
                  <li key={i} className="rounded-2xl bg-surface p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">{fmtDM(m.date)} · {m.dl === 0 ? "hoy" : `en ${m.dl} d`}</p>
                    <p className="mt-1.5 text-[13px] font-medium leading-snug text-foreground">{m.label}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{m.campaign}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Generado automáticamente a partir de los datos del workspace · {new Date().toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </main>
      </div>
    );
  }

  Object.assign(window, { ResumenPage });
})();
