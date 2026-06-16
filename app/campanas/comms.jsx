/* Communications scheduling — shared vocab, auto-generated cronograma (Gantt + table), export. */
(function () {
  const React = window.React;
  const { useState, useMemo, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Block } = window;
  const cn = window.cn;

  /* ---------- shared vocabulary (consumed by the editor in brief.jsx) ---------- */
  const COMM_CHANNELS = ["Banner", "SMS", "Mail", "App Push", "WhatsApp", "Call", "TV SAE"];
  // ISO weekday: 1=Mon … 7=Sun
  const WEEKDAYS = [
    { iso: 1, short: "L", label: "Lunes" }, { iso: 2, short: "M", label: "Martes" },
    { iso: 3, short: "X", label: "Miércoles" }, { iso: 4, short: "J", label: "Jueves" },
    { iso: 5, short: "V", label: "Viernes" }, { iso: 6, short: "S", label: "Sábado" },
    { iso: 7, short: "D", label: "Domingo" },
  ];
  const CH_TONE = {
    "Banner": "bg-brand/10 text-brand", "SMS": "bg-accent-violet/10 text-accent-violet",
    "Mail": "bg-accent-green/10 text-accent-green", "App Push": "bg-accent-pink/10 text-accent-pink",
    "WhatsApp": "bg-accent-green/15 text-accent-green", "Call": "bg-accent-amber/15 text-accent-amber",
    "TV SAE": "bg-muted text-foreground",
  };
  const CH_BAR = {
    "Banner": "bg-brand", "SMS": "bg-accent-violet", "Mail": "bg-accent-green", "App Push": "bg-accent-pink",
    "WhatsApp": "bg-accent-green", "Call": "bg-accent-amber", "TV SAE": "bg-muted-foreground/50",
  };
  const STATUS_LABEL = { todo: "Pendiente", done: "Ejecutado" };
  // Default comms with the new rule-based model (2026 Q1 window).
  const DEFAULT_COMMS = [
    { id: "c1", type: "Credenciales", channels: ["App Push", "SMS", "Mail"], start: "2026-02-22", end: "2026-03-08", days: [1, 3, 5], objective: "Incentivar matrícula temprana", owner: "Lucía", status: "todo" },
    { id: "c2", type: "Modalidad de cursos", channels: ["Mail", "Banner"], start: "2026-03-08", end: "2026-03-13", days: [2, 4], objective: "Aclarar modalidad y horarios", owner: "Diego", status: "todo" },
    { id: "c3", type: "No conexión", channels: ["SMS", "WhatsApp"], start: "2026-03-13", end: "2026-03-26", days: [1, 2, 3, 4, 5], objective: "Recuperar alumnos sin actividad", owner: "Ana", status: "todo" },
  ];
  Object.assign(window, { COMM_CHANNELS, WEEKDAYS, CH_TONE, DEFAULT_COMMS });

  /* ---------- date helpers ---------- */
  const parseISO = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); if (!y || !m || !d) return null; const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0); return dt; };
  const isoWeekday = (d) => { const g = d.getDay(); return g === 0 ? 7 : g; };
  const fmtDM = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  const fmtFull = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  const dayName = (d) => d.toLocaleDateString("es-ES", { weekday: "long" });
  const MS = 86400000;
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  /* ---------- the engine: expand comm rules into one row per execution day × channel ---------- */
  function generateSchedule(comms, campaignTitle) {
    const rows = [];
    (comms || []).forEach((c) => {
      const start = parseISO(c.start), end = parseISO(c.end);
      if (!start || !end || end < start) return;
      const defaultDays = (c.days && c.days.length) ? c.days : [1, 2, 3, 4, 5];
      const channels = (c.channels && c.channels.length) ? c.channels : ["—"];
      const daysFor = (ch) => (c.daysByChannel && c.daysByChannel[ch] && c.daysByChannel[ch].length) ? c.daysByChannel[ch] : defaultDays;
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + MS)) {
        const wd = isoWeekday(d);
        channels.forEach((ch) => {
          if (!daysFor(ch).includes(wd)) return;
          rows.push({
            id: `${c.id}-${d.getTime()}-${ch}`, commId: c.id,
            date: new Date(d), channel: ch, type: c.type || "—",
            campaign: campaignTitle || "—", objective: c.objective || "",
            owner: c.owner || "", status: c.status || "todo",
          });
        });
      }
    });
    rows.sort((a, b) => a.date - b.date || a.channel.localeCompare(b.channel));
    return rows;
  }
  window.generateSchedule = generateSchedule;

  /* ---------- compact Gantt ---------- */
  function CommGantt({ comms }) {
    const bars = (comms || []).map((c) => ({ c, start: parseISO(c.start), end: parseISO(c.end) })).filter((x) => x.start && x.end && x.end >= x.start);
    if (bars.length === 0) return <p className="rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-[12px] text-muted-foreground">Define fechas en las comunicaciones para ver el Gantt.</p>;
    let min = bars[0].start, max = bars[0].end;
    bars.forEach((b) => { if (b.start < min) min = b.start; if (b.end > max) max = b.end; });
    const span = Math.max(1, Math.round((max - min) / MS));
    const pct = (d) => Math.max(0, Math.min(100, (Math.round((d - min) / MS) / span) * 100));
    const t = today0();
    const todayPct = t >= min && t <= max ? pct(t) : null;
    // month ticks
    const ticks = [];
    const cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) { if (cur >= min) ticks.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

    return (
      <div>
        <div className="relative mb-1 ml-[120px] h-4">
          {ticks.map((tk, i) => (
            <span key={i} className="absolute -translate-x-1/2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground" style={{ left: `${pct(tk)}%` }}>
              {tk.toLocaleDateString("es-ES", { month: "short" })}
            </span>
          ))}
        </div>
        <div className="relative space-y-1">
          {todayPct !== null && <div className="absolute bottom-0 top-0 z-10 w-px bg-destructive/50" style={{ left: `calc(120px + ${todayPct}% * (100% - 120px) / 100)` }} />}
          {bars.map(({ c, start, end }) => {
            const freq = (c.days || []).length === 7 ? "Diario" : (c.days || []).map((iso) => (WEEKDAYS.find((w) => w.iso === iso) || {}).short).join("·");
            return (
              <div key={c.id} className="flex items-center gap-2">
                <span className="w-[112px] shrink-0 truncate text-[11px] font-medium text-foreground" title={c.type}>{c.type || "—"}</span>
                <div className="relative h-5 flex-1 rounded bg-surface">
                  <div className={cn("absolute top-0 flex h-full items-center justify-center rounded", "bg-foreground/85")}
                    style={{ left: `${pct(start)}%`, width: `${Math.max(3, pct(end) - pct(start))}%` }}>
                    <span className="truncate px-1 text-[9px] font-semibold text-background">{freq}</span>
                  </div>
                </div>
                <span className="flex w-16 shrink-0 flex-wrap justify-end gap-0.5">
                  {(c.channels || []).slice(0, 3).map((ch) => <span key={ch} className={cn("h-2 w-2 rounded-full", CH_BAR[ch] || "bg-muted-foreground/40")} title={ch} />)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {COMM_CHANNELS.filter((ch) => (comms || []).some((c) => (c.channels || []).includes(ch))).map((ch) => (
            <span key={ch} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", CH_BAR[ch])} /> {ch}</span>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- export helpers ---------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  const COLS = ["Fecha", "Día", "Canal", "Tipo", "Campaña", "Objetivo", "Responsable", "Estado"];
  const rowValues = (r) => [fmtFull(r.date), dayName(r.date), r.channel, r.type, r.campaign, r.objective || "", r.owner || "", STATUS_LABEL[r.status] || r.status];
  function exportCSV(rows, name) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [COLS.join(","), ...rows.map((r) => rowValues(r).map(esc).join(","))].join("\r\n");
    download(`${name}.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
  }
  function exportXLS(rows, name) {
    // HTML-table .xls — opens cleanly in Excel with formatting.
    const th = COLS.map((c) => `<th style="background:#1f2937;color:#fff;padding:6px 10px;text-align:left;font-family:Arial">${c}</th>`).join("");
    const trs = rows.map((r) => `<tr>${rowValues(r).map((v) => `<td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;font-family:Arial;font-size:12px">${String(v)}</td>`).join("")}</tr>`).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="0">${`<thead><tr>${th}</tr></thead>`}<tbody>${trs}</tbody></table></body></html>`;
    download(`${name}.xls`, html, "application/vnd.ms-excel");
  }
  function exportPDF(rows, comms, campaignTitle, period) {
    const w = window.open("", "_blank");
    if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    const ganttRows = (comms || []).map((c) => {
      const freq = (c.days || []).length === 7 ? "Diario" : (c.days || []).map((iso) => (WEEKDAYS.find((x) => x.iso === iso) || {}).label).join(", ");
      return `<tr><td>${c.type || "—"}</td><td>${(c.channels || []).join(", ")}</td><td>${c.start || "—"} → ${c.end || "—"}</td><td>${freq}</td></tr>`;
    }).join("");
    const tbl = rows.map((r) => `<tr>${rowValues(r).map((v) => `<td>${String(v)}</td>`).join("")}</tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cronograma de Comunicaciones</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;color:#111}
        body{margin:32px}
        h1{font-size:20px;margin:0 0 2px} .sub{color:#666;font-size:12px;margin-bottom:18px}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:20px 0 8px}
        table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:8px}
        th{background:#1f2937;color:#fff;padding:6px 8px;text-align:left}
        td{padding:5px 8px;border-bottom:1px solid #e5e7eb}
        tbody tr:nth-child(even){background:#f8fafc}
        @media print{@page{margin:14mm}}
      </style></head><body>
      <h1>Cronograma de Comunicaciones</h1>
      <div class="sub">${campaignTitle || ""} · ${period || ""} · ${rows.length} ejecuciones · generado ${fmtFull(today0())}</div>
      <h2>Resumen (Gantt)</h2>
      <table><thead><tr><th>Tipo</th><th>Canales</th><th>Periodo</th><th>Frecuencia</th></tr></thead><tbody>${ganttRows}</tbody></table>
      <h2>Ejecuciones expandidas</h2>
      <table><thead><tr>${COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tbl}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
      </body></html>`);
    w.document.close();
  }

  /* ---------- sortable / filterable schedule table ---------- */
  function SortTh({ label, col, sort, setSort }) {
    const active = sort.key === col;
    const next = () => setSort(active ? (sort.dir === "asc" ? { key: col, dir: "desc" } : { key: null, dir: null }) : { key: col, dir: "asc" });
    return (
      <th className="px-2 py-1.5 text-left">
        <button type="button" onClick={next} className={cn("reader-keep inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground", active && "text-foreground")}>
          {label}<LucideIcon name={active ? (sort.dir === "asc" ? "ArrowUp" : "ArrowDown") : "ChevronsUpDown"} className={cn("h-3 w-3 print:hidden", active ? "opacity-100" : "opacity-30")} />
        </button>
      </th>
    );
  }
  function MultiFilter({ label, selected, options, onToggle, onClear }) {
    const { Popover } = window;
    return (
      <Popover width="w-44" trigger={
        <button type="button" className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors", selected.length ? "border-brand/40 bg-brand/5 text-brand" : "border-input bg-transparent hover:bg-surface")}>
          {label}{selected.length > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">{selected.length}</span>}
          <LucideIcon name="ChevronDown" className="h-3 w-3 opacity-60" />
        </button>
      }>
        <div className="space-y-0.5">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
            {selected.length > 0 && <button type="button" onClick={onClear} className="text-[10px] text-muted-foreground hover:text-foreground">Limpiar</button>}
          </div>
          {options.map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-accent">
              <window.Checkbox checked={selected.includes(v)} onCheckedChange={() => onToggle(v)} /><span className="flex-1 truncate">{l}</span>
            </label>
          ))}
        </div>
      </Popover>
    );
  }

  function CommScheduleView({ slug, period }) {
    const { comms } = window.useBrief();
    const campaign = S.campaigns.find((c) => c.slug === slug);
    const allRows = useMemo(() => generateSchedule(comms, campaign ? campaign.title : slug), [comms, slug]);
    const [query, setQuery] = useState("");
    const [chF, setChF] = useState([]);
    const [stF, setStF] = useState([]);
    const [sort, setSort] = useState({ key: null, dir: null });

    const usedChannels = useMemo(() => Array.from(new Set(allRows.map((r) => r.channel))), [allRows]);
    const toggle = (setter) => (v) => setter((a) => a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

    const rows = useMemo(() => {
      const q = query.trim().toLowerCase();
      let f = allRows.filter((r) => {
        if (chF.length && !chF.includes(r.channel)) return false;
        if (stF.length && !stF.includes(r.status)) return false;
        if (q && !`${r.type} ${r.objective} ${r.owner} ${r.channel}`.toLowerCase().includes(q)) return false;
        return true;
      });
      if (sort.key) {
        const val = (r) => sort.key === "date" ? r.date.getTime() : String(r[sort.key] || "").toLowerCase();
        const dir = sort.dir === "desc" ? -1 : 1;
        f = f.slice().sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -dir : va > vb ? dir : 0; });
      }
      return f;
    }, [allRows, query, chF, stF, sort]);

    const exportName = `cronograma-${slug}-${period}`;

    return (
      <Block icon="CalendarClock" title="Cronograma de comunicaciones"
        action={
          <div className="flex items-center gap-1 print:hidden">
            <span className="mr-1 text-[11px] text-muted-foreground">{allRows.length} ejecuciones</span>
            <ExportMenu onCSV={() => exportCSV(rows, exportName)} onXLS={() => exportXLS(rows, exportName)} onPDF={() => exportPDF(rows, comms, campaign ? campaign.title : slug, S.formatPeriodLabel(period))} />
          </div>
        }>
        <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
          <LucideIcon name="Sparkles" className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-brand" />
          Generado automáticamente desde <span className="font-medium text-foreground">Tipos de comunicación</span>. Se recalcula al cambiar fechas, días o canales.
        </p>

        {/* Gantt */}
        <div className="mb-4 rounded-xl border border-border/60 bg-surface/30 p-3">
          <CommGantt comms={comms} />
        </div>

        {/* Toolbar */}
        <div className="edit-only mb-2 flex flex-wrap items-center gap-1.5 print:hidden">
          <div className="relative min-w-[160px] flex-1">
            <LucideIcon name="Search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canal, tipo, responsable…" className="h-7 pl-7 text-xs" />
          </div>
          <MultiFilter label="Canal" selected={chF} options={usedChannels.map((c) => [c, c])} onToggle={toggle(setChF)} onClear={() => setChF([])} />
          <MultiFilter label="Estado" selected={stF} options={[["todo", "Pendiente"], ["done", "Ejecutado"]]} onToggle={toggle(setStF)} onClear={() => setStF([])} />
          {(chF.length || stF.length || query) ? <button type="button" onClick={() => { setChF([]); setStF([]); setQuery(""); }} className="text-[11px] text-muted-foreground hover:text-destructive">Limpiar</button> : null}
          <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} fila{rows.length === 1 ? "" : "s"}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortTh label="Fecha" col="date" sort={sort} setSort={setSort} />
                <th className="px-2 py-1.5 text-left">Día</th>
                <SortTh label="Canal" col="channel" sort={sort} setSort={setSort} />
                <SortTh label="Tipo" col="type" sort={sort} setSort={setSort} />
                <SortTh label="Responsable" col="owner" sort={sort} setSort={setSort} />
                <th className="px-2 py-1.5 text-left">Objetivo</th>
                <th className="px-2 py-1.5 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-2 py-6 text-center text-[12px] text-muted-foreground">Sin ejecuciones para los filtros actuales.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-surface/50">
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtDM(r.date)}</td>
                  <td className="px-2 py-1.5 capitalize text-muted-foreground">{dayName(r.date)}</td>
                  <td className="px-2 py-1.5"><span className={cn("inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold", CH_TONE[r.channel] || "bg-muted text-muted-foreground")}>{r.channel}</span></td>
                  <td className="px-2 py-1.5">{r.type}</td>
                  <td className="px-2 py-1.5">{r.owner ? <span className="text-foreground">{r.owner}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="max-w-[200px] truncate px-2 py-1.5 text-muted-foreground" title={r.objective}>{r.objective || "—"}</td>
                  <td className="px-2 py-1.5"><span className={cn("inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium", r.status === "done" ? "bg-accent-green/10 text-accent-green" : "bg-surface text-muted-foreground")}>{STATUS_LABEL[r.status] || r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    );
  }

  function ExportMenu({ onCSV, onXLS, onPDF }) {
    const { Popover } = window;
    return (
      <Popover align="end" width="w-36" trigger={
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input bg-transparent px-3 text-[11px] font-medium transition-colors hover:bg-surface">
          <LucideIcon name="Download" className="h-3.5 w-3.5" /> Exportar <LucideIcon name="ChevronDown" className="h-3 w-3 opacity-60" />
        </button>
      }>
        {(setOpen) => (
          <div className="space-y-0.5">
            {[["Excel (.xlsx)", "FileSpreadsheet", onXLS], ["CSV", "FileText", onCSV], ["PDF", "FileDown", onPDF]].map(([l, ic, fn]) => (
              <button key={l} type="button" onClick={() => { fn(); setOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-accent">
                <LucideIcon name={ic} className="h-3.5 w-3.5 text-muted-foreground" /> {l}
              </button>
            ))}
          </div>
        )}
      </Popover>
    );
  }

  window.CommScheduleView = CommScheduleView;

  /* ====================================================================
     Consolidated cronograma — all campaigns × periods in one hub view.
     ==================================================================== */
  const CONS_COLS = ["Fecha", "Día", "Brief", "Periodo", "Canal", "Tipo", "Responsable", "Objetivo", "Estado"];
  const consValues = (r) => [fmtFull(r.date), dayName(r.date), r.campaign, r.periodLabel, r.channel, r.type, r.owner || "", r.objective || "", STATUS_LABEL[r.status] || r.status];
  function exportConsCSV(rows, name) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    download(`${name}.csv`, "\ufeff" + [CONS_COLS.join(","), ...rows.map((r) => consValues(r).map(esc).join(","))].join("\r\n"), "text/csv;charset=utf-8");
  }
  function exportConsXLS(rows, name) {
    const th = CONS_COLS.map((c) => `<th style="background:#1f2937;color:#fff;padding:6px 10px;text-align:left;font-family:Arial">${c}</th>`).join("");
    const trs = rows.map((r) => `<tr>${consValues(r).map((v) => `<td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;font-family:Arial;font-size:12px">${String(v)}</td>`).join("")}</tr>`).join("");
    download(`${name}.xls`, `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="0"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`, "application/vnd.ms-excel");
  }
  function exportConsPDF(rows, range) {
    const w = window.open("", "_blank");
    if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    const tbl = rows.map((r) => `<tr>${consValues(r).map((v) => `<td>${String(v)}</td>`).join("")}</tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cronograma consolidado de comunicaciones</title>
      <style>*{font-family:Arial,Helvetica,sans-serif;color:#111}body{margin:32px}h1{font-size:20px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:18px}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#1f2937;color:#fff;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}tbody tr:nth-child(even){background:#f8fafc}@media print{@page{margin:12mm}}</style>
      </head><body><h1>Cronograma consolidado de comunicaciones</h1>
      <div class="sub">${rows.length} ejecuciones${range ? " · " + range : ""} · generado ${fmtFull(today0())}</div>
      <table><thead><tr>${CONS_COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tbl}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }

  const CAMP_COLORS = ["bg-brand", "bg-accent-violet", "bg-accent-pink", "bg-accent-amber", "bg-accent-green"];
  function ConsolidatedGantt({ groups, from, to }) {
    // groups: [{ slug, title, color, comms:[{type,start,end,days,channels}] }]
    const lines = [];
    groups.forEach((g) => {
      lines.push({ type: "group", label: g.title, color: g.color });
      g.comms.filter((c) => parseISO(c.start) && parseISO(c.end)).forEach((c) => {
        const freq = (c.days || []).length === 7 ? "Diario" : (c.days || []).map((iso) => (WEEKDAYS.find((w) => w.iso === iso) || {}).short).join("·");
        lines.push({ type: "bar", label: c.type || "—", color: g.color, start: parseISO(c.start), end: parseISO(c.end), text: freq });
      });
    });
    return <window.GanttTimeline lines={lines} pxDay={10} gutter={150} emptyText="Sin comunicaciones con fechas para mostrar." />;
  }

  function ConsTh({ label, col, sort, setSort }) {
    const active = sort.key === col;
    const next = () => setSort(active ? (sort.dir === "asc" ? { key: col, dir: "desc" } : { key: null, dir: null }) : { key: col, dir: "asc" });
    return (
      <th className="px-2 py-1.5 text-left">
        <button type="button" onClick={next} className={cn("inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground", active && "text-foreground")}>
          {label}<LucideIcon name={active ? (sort.dir === "asc" ? "ArrowUp" : "ArrowDown") : "ChevronsUpDown"} className={cn("h-3 w-3", active ? "opacity-100" : "opacity-30")} />
        </button>
      </th>
    );
  }

  function ConsolidatedCommsPage() {
    const periods = S.listAvailablePeriods();
    const campaigns = S.useCampaigns();
    // Build campaign color map
    const colorOf = useMemo(() => { const m = {}; campaigns.forEach((c, i) => (m[c.slug] = CAMP_COLORS[i % CAMP_COLORS.length])); return m; }, [campaigns]);

    // Gather all configured (campaign × period) comm sets.
    const sources = useMemo(() => {
      const out = [];
      campaigns.forEach((c) => periods.forEach((p) => {
        if (!S.isCampaignConfigured(c.slug, p)) return;
        const comms = S.readComms(c.slug, p);
        if (comms && comms.length) out.push({ slug: c.slug, title: c.title, period: p, periodLabel: S.formatPeriodLabel(p), comms });
      }));
      return out;
    }, [campaigns, periods.join(",")]);

    // Refresca cuando se marca/desmarca una ejecución (BUG-DF8E).
    // DEBE declararse antes de allRows, que lo usa como dependencia (evita el
    // "Cannot access 'execTick' before initialization" que daba pantalla blanca).
    const [execTick, setExecTick] = useState(0);
    useEffect(() => {
      const h = () => setExecTick((n) => n + 1);
      window.addEventListener("comm-exec-change", h);
      return () => window.removeEventListener("comm-exec-change", h);
    }, []);

    const allRows = useMemo(() => {
      const rows = [];
      sources.forEach((s) => {
        const exec = S.readCommExecutions(s.slug, s.period);
        generateSchedule(s.comms, s.title).forEach((r) => rows.push({ ...r, slug: s.slug, period: s.period, periodLabel: s.periodLabel, executed: !!exec[r.id] }));
      });
      rows.sort((a, b) => a.date - b.date || a.campaign.localeCompare(b.campaign) || a.channel.localeCompare(b.channel));
      return rows;
    }, [sources, execTick]);

    // Secciones colapsables (BUG-A56D): el usuario puede ocultar el Gantt o la tabla.
    const [showGantt, setShowGantt] = useState(false);
    const [showTable, setShowTable] = useState(true);

    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [query, setQuery] = useState("");
    const [campF, setCampF] = useState([]);
    const [perF, setPerF] = useState([]);
    const [chF, setChF] = useState([]);
    const [stF, setStF] = useState([]);
    const [sort, setSort] = useState({ key: null, dir: null });
    const toggle = (setter) => (v) => setter((a) => a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

    const usedChannels = useMemo(() => Array.from(new Set(allRows.map((r) => r.channel))), [allRows]);
    const fromD = from ? parseISO(from) : null, toD = to ? parseISO(to) : null;

    const rows = useMemo(() => {
      const q = query.trim().toLowerCase();
      let f = allRows.filter((r) => {
        if (fromD && r.date < fromD) return false;
        if (toD && r.date > toD) return false;
        if (campF.length && !campF.includes(r.slug)) return false;
        if (perF.length && !perF.includes(r.period)) return false;
        if (chF.length && !chF.includes(r.channel)) return false;
        if (stF.length && !stF.includes(r.status)) return false;
        if (q && !`${r.type} ${r.objective} ${r.owner} ${r.channel} ${r.campaign}`.toLowerCase().includes(q)) return false;
        return true;
      });
      if (sort.key) {
        const val = (r) => sort.key === "date" ? r.date.getTime() : sort.key === "period" ? r.period : String(r[sort.key] || "").toLowerCase();
        const dir = sort.dir === "desc" ? -1 : 1;
        f = f.slice().sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -dir : va > vb ? dir : 0; });
      }
      return f;
    }, [allRows, from, to, query, campF, perF, chF, stF, sort]);

    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);
    useEffect(() => { setPage(1); }, [rows, pageSize]);

    // Gantt groups respect campaign/period filters (not date-range — range only narrows the time axis).
    const ganttGroups = useMemo(() => {
      return sources
        .filter((s) => (!campF.length || campF.includes(s.slug)) && (!perF.length || perF.includes(s.period)))
        .map((s) => ({ slug: s.slug + s.period, title: `${s.title} · ${s.periodLabel}`, color: colorOf[s.slug], comms: s.comms.filter((c) => !chF.length || (c.channels || []).some((ch) => chF.includes(ch))) }))
        .filter((g) => g.comms.length);
    }, [sources, campF, perF, chF, colorOf]);

    const anyFilter = from || to || query || campF.length || perF.length || chF.length || stF.length;
    const rangeLabel = (from || to) ? `${from ? fmtFull(parseISO(from)) : "inicio"} → ${to ? fmtFull(parseISO(to)) : "fin"}` : "";

    return (
      <div className="min-h-screen bg-background" data-screen-label="Cronograma consolidado de comunicaciones">
        <window.SectionWash accent="cyan" />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-0 sm:px-6 lg:px-8">
          <window.PageToolbar back="#/">
            <div className="relative w-56">
              <LucideIcon name="Search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campaña, canal, tipo…" className="!h-8 !rounded-full pl-7 text-xs" />
            </div>
            <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input px-2">
              <LucideIcon name="CalendarRange" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <window.DatePicker value={from} onChange={setFrom} placeholder="Desde" className="!h-6 !border-0 !bg-transparent !px-1" />
              <span className="text-muted-foreground">→</span>
              <window.DatePicker value={to} onChange={setTo} placeholder="Hasta" align="end" className="!h-6 !border-0 !bg-transparent !px-1" />
            </div>
            <MultiFilter label="Brief" selected={campF} options={Array.from(new Set(sources.map((s) => s.slug))).map((sl) => [sl, (campaigns.find((c) => c.slug === sl) || {}).title || sl])} onToggle={toggle(setCampF)} onClear={() => setCampF([])} />
            <MultiFilter label="Periodo" selected={perF} options={Array.from(new Set(sources.map((s) => s.period))).map((p) => [p, S.formatPeriodLabel(p)])} onToggle={toggle(setPerF)} onClear={() => setPerF([])} />
            <MultiFilter label="Canal" selected={chF} options={usedChannels.map((c) => [c, c])} onToggle={toggle(setChF)} onClear={() => setChF([])} />
            <MultiFilter label="Estado" selected={stF} options={[["todo", "Pendiente"], ["done", "Ejecutado"]]} onToggle={toggle(setStF)} onClear={() => setStF([])} />
            {anyFilter ? <button type="button" onClick={() => { setFrom(""); setTo(""); setQuery(""); setCampF([]); setPerF([]); setChF([]); setStF([]); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive"><LucideIcon name="X" className="h-3 w-3" /> Limpiar</button> : null}
            <span className="whitespace-nowrap px-1 text-[11px] text-muted-foreground">{rows.length} fila{rows.length === 1 ? "" : "s"}</span>
            <span className="mx-0.5 h-6 w-px bg-border" />
            <ExportMenu onCSV={() => exportConsCSV(rows, "cronograma-consolidado")} onXLS={() => exportConsXLS(rows, "cronograma-consolidado")} onPDF={() => exportConsPDF(rows, rangeLabel)} />
          </window.PageToolbar>
          <window.SectionHeader accent="cyan" icon="Send" title="Cronograma de Comunicaciones" subtitle={`Consolidado de todas las campañas · ${allRows.length} ejecuciones · ${sources.length} brief${sources.length === 1 ? "" : "s"}`} />

          {/* Gantt — colapsable */}
          <div className="mb-3 rounded-xl border border-border bg-surface-elevated p-3">
            <button type="button" onClick={() => setShowGantt((v) => !v)}
              className={cn("flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground", showGantt && "mb-2")}>
              <LucideIcon name={showGantt ? "ChevronDown" : "ChevronRight"} className="h-3.5 w-3.5" />
              <LucideIcon name="GanttChartSquare" className="h-3.5 w-3.5" /> Vista timeline
              {!showGantt && <span className="ml-1 normal-case text-[10px] text-muted-foreground/70">(oculta)</span>}
            </button>
            {showGantt && <ConsolidatedGantt groups={ganttGroups} from={from} to={to} />}
          </div>

          {/* Table — colapsable */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
            <button type="button" onClick={() => setShowTable((v) => !v)}
              className="flex w-full items-center gap-2 border-b border-border/60 bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              <LucideIcon name={showTable ? "ChevronDown" : "ChevronRight"} className="h-3.5 w-3.5" />
              <LucideIcon name="Table" className="h-3.5 w-3.5" /> Detalle de ejecuciones
              <span className="ml-1 normal-case text-[10px] text-muted-foreground/70">{rows.length} fila{rows.length === 1 ? "" : "s"}{!showTable && " · oculto"}</span>
            </button>
            {showTable &&
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <ConsTh label="Fecha" col="date" sort={sort} setSort={setSort} />
                    <th className="px-2 py-1.5 text-left">Día</th>
                    <ConsTh label="Brief" col="campaign" sort={sort} setSort={setSort} />
                    <ConsTh label="Periodo" col="period" sort={sort} setSort={setSort} />
                    <ConsTh label="Canal" col="channel" sort={sort} setSort={setSort} />
                    <ConsTh label="Tipo" col="type" sort={sort} setSort={setSort} />
                    <ConsTh label="Responsable" col="owner" sort={sort} setSort={setSort} />
                    <th className="px-2 py-1.5 text-left">Objetivo</th>
                    <th className="px-2 py-1.5 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9} className="px-2 py-10 text-center text-xs text-muted-foreground">Sin ejecuciones para los filtros seleccionados.</td></tr>
                  ) : rows.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                    <tr key={r.slug + "|" + r.period + "|" + r.id} className="border-t border-border/60 hover:bg-surface/50">
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtDM(r.date)}</td>
                      <td className="px-2 py-1.5 capitalize text-muted-foreground">{dayName(r.date)}</td>
                      <td className="px-2 py-1.5"><a href={`#/brief/${r.slug}?p=${r.period}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"><span className={cn("h-2 w-2 rounded-full", colorOf[r.slug])} />{r.campaign}</a></td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{r.periodLabel}</td>
                      <td className="px-2 py-1.5"><span className={cn("inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold", CH_TONE[r.channel] || "bg-muted text-muted-foreground")}>{r.channel}</span></td>
                      <td className="px-2 py-1.5">{r.type}</td>
                      <td className="px-2 py-1.5">{r.owner ? <span className="text-foreground">{r.owner}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="max-w-[180px] truncate px-2 py-1.5 text-muted-foreground" title={r.objective}>{r.objective || "—"}</td>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => S.setCommExecuted(r.slug, r.period, r.id, !S.isCommExecuted(r.slug, r.period, r.id))}
                          title={r.executed ? "Marcar como pendiente" : "Marcar como ejecutado"}
                          className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors", r.executed ? "bg-accent-green/10 text-accent-green hover:bg-accent-green/20" : "bg-surface text-muted-foreground hover:bg-muted")}>
                          <LucideIcon name={r.executed ? "CheckCircle2" : "Circle"} className="h-3 w-3" />
                          {r.executed ? "Ejecutado" : "Pendiente"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            }
            {showTable && rows.length > pageSize && (
              <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="mr-1">Filas:</span>
                  {[10, 25, 50, 100].map((n) => (
                    <button key={n} type="button" onClick={() => setPageSize(n)}
                      className={cn("rounded px-2 py-0.5 font-medium", pageSize === n ? "bg-brand/10 text-brand" : "hover:bg-muted")}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span>Página {page} de {Math.ceil(rows.length / pageSize)}</span>
                  <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                    className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40">Anterior</button>
                  <button type="button" disabled={page >= Math.ceil(rows.length / pageSize)} onClick={() => setPage((p) => p + 1)}
                    className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  window.ConsolidatedCommsPage = ConsolidatedCommsPage;
  window.CommGantt = CommGantt; // reusado en el brief (BUG-3C77)
})();
