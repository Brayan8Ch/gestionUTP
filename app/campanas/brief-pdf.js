/* PDF export — executive McKinsey-style memo (print window → Guardar como PDF). */
(function () {
  const NAVY = "#1F3253";
  const INK = "#1a1a1a";
  const GRAY = "#6b6f76";
  const HAIR = "#d9dce1";

  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === "string") { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); const d = new Date(v); return isNaN(d) ? null : d; }
    if (typeof v === "number") { const d = new Date(v); return isNaN(d) ? null : d; }
    return null;
  }
  function fmtD(v) { const d = toDate(v); return d ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "—"; }
  function fmtDT(v) { const d = toDate(v); return d ? `${fmtD(d)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "—"; }

  const T_STATUS = { todo: "Pendiente", in_progress: "En progreso", done: "Completado", blocked: "En revisión" };
  const T_PRIO = { high: "Alta", med: "Media", low: "Baja" };
  const K_STATUS = { done: "Completado", active: "En curso", upcoming: "Próximo" };

  /* ---------- building blocks ---------- */
  function kicker(text) {
    return `<p style="margin:0 0 2pt 0;font-family:Arial,sans-serif;font-size:8pt;letter-spacing:2pt;text-transform:uppercase;color:${GRAY};">${esc(text)}</p>`;
  }
  function h2(text) {
    return `<p style="margin:18pt 0 6pt 0;padding-bottom:3pt;border-bottom:0.75pt solid ${NAVY};font-family:Georgia,serif;font-size:12pt;font-weight:bold;color:${NAVY};">${esc(text)}</p>`;
  }
  function para(text, opts) {
    const o = opts || {};
    return `<p style="margin:0 0 ${o.mb || "6pt"} 0;font-family:Arial,sans-serif;font-size:${o.size || "10pt"};line-height:1.45;color:${o.color || INK};">${text}</p>`;
  }
  function table(headers, rows, widths) {
    const ths = headers.map((h, i) =>
      `<td style="${widths && widths[i] ? `width:${widths[i]};` : ""}padding:4pt 6pt;border-bottom:1pt solid ${NAVY};font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;letter-spacing:1pt;text-transform:uppercase;color:${GRAY};">${esc(h)}</td>`).join("");
    const trs = rows.map((cells) =>
      `<tr>${cells.map((c, i) => `<td style="${widths && widths[i] ? `width:${widths[i]};` : ""}padding:4pt 6pt;border-bottom:0.5pt solid ${HAIR};font-family:Arial,sans-serif;font-size:9.5pt;color:${INK};vertical-align:top;">${c}</td>`).join("")}</tr>`).join("");
    return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 4pt 0;"><tr>${ths}</tr>${trs}</table>`;
  }
  const bold = (s) => `<b>${esc(s)}</b>`;
  const dim = (s) => `<span style="color:${GRAY};">${esc(s)}</span>`;

  function buildHtml(d) {
    const today = new Date();
    const pr = d.progress || {};
    const pct = pr.percent != null ? `${pr.percent}%` : "—";

    /* Header */
    let body = "";
    body += kicker("Brief ejecutivo de campaña");
    body += `<p style="margin:0 0 4pt 0;font-family:Georgia,serif;font-size:22pt;font-weight:bold;color:${INK};">${esc(d.title)}</p>`;
    body += `<p style="margin:0 0 10pt 0;font-family:Arial,sans-serif;font-size:9.5pt;color:${GRAY};">${esc(d.periodLabel)} &nbsp;·&nbsp; ${esc(d.status)} &nbsp;·&nbsp; Avance ${esc(pct)}${pr.total ? ` (${pr.done || 0}/${pr.total} tareas)` : ""} &nbsp;·&nbsp; Generado ${fmtD(today)}${d.generatedBy ? ` por ${esc(d.generatedBy)}` : ""}</p>`;
    body += `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 4pt 0;border-top:2.25pt solid ${NAVY};"><tr>
      <td style="width:25%;padding:6pt 6pt 6pt 0;"><p style="margin:0;font-family:Arial;font-size:7.5pt;letter-spacing:1pt;text-transform:uppercase;color:${GRAY};">Responsable</p><p style="margin:0;font-family:Arial;font-size:10pt;font-weight:bold;color:${INK};">${esc(d.responsable || "—")}</p></td>
      <td style="width:25%;padding:6pt;"><p style="margin:0;font-family:Arial;font-size:7.5pt;letter-spacing:1pt;text-transform:uppercase;color:${GRAY};">Supervisor / Aprobador</p><p style="margin:0;font-family:Arial;font-size:10pt;font-weight:bold;color:${INK};">${esc(d.supervisor || "—")}</p></td>
      <td style="width:25%;padding:6pt;"><p style="margin:0;font-family:Arial;font-size:7.5pt;letter-spacing:1pt;text-transform:uppercase;color:${GRAY};">Próximo hito</p><p style="margin:0;font-family:Arial;font-size:10pt;font-weight:bold;color:${INK};">${esc(d.next ? d.next.label : "—")}</p><p style="margin:0;font-family:Arial;font-size:8.5pt;color:${GRAY};">${d.next ? fmtD(d.next.start) : ""}</p></td>
      <td style="width:25%;padding:6pt 0 6pt 6pt;"><p style="margin:0;font-family:Arial;font-size:7.5pt;letter-spacing:1pt;text-transform:uppercase;color:${GRAY};">Última modificación</p><p style="margin:0;font-family:Arial;font-size:10pt;font-weight:bold;color:${INK};">${d.updatedAt ? fmtDT(d.updatedAt) : "—"}</p></td>
    </tr></table>`;

    /* 1 — Resumen estratégico */
    const sm = d.summary || {};
    body += h2("1. Resumen estratégico");
    [["Objetivo", sm.objective], ["Audiencia", sm.audience], ["Resultado esperado", sm.result]].forEach(([l, v]) => {
      body += para(`<b style="color:${NAVY};">${esc(l)}.</b>&nbsp; ${esc(v || "—")}`);
    });

    /* 2 — Fechas parámetro */
    if (d.params && d.params.length) {
      body += h2("2. Fechas parámetro del periodo");
      body += table(["Parámetro", "Fecha"], d.params.map((p) => [bold(p.label), fmtD(p.date)]), ["70%", "30%"]);
    }

    /* 3 — Fechas clave */
    if (d.keyItems && d.keyItems.length) {
      body += h2("3. Fechas clave — roadmap");
      body += table(["Hito", "Inicio", "Fin", "Duración", "Estado"],
        d.keyItems.map((x) => [bold((x.k && x.k.label) || "—"), fmtD(x.start), fmtD(x.end), esc(`${x.dur || 1} día${(x.dur || 1) === 1 ? "" : "s"}`), esc(K_STATUS[x.status] || "—")]),
        ["38%", "16%", "16%", "13%", "17%"]);
    }

    /* 4 — Comunicaciones */
    if (d.comms && d.comms.length) {
      const WD = (window.WEEKDAYS || []);
      const dayLbl = (arr) => (arr && arr.length) ? (arr.length === 7 ? "Todos los días" : arr.map((n) => { const w = WD.find((x) => x.iso === n); return w ? w.label.slice(0, 3) : n; }).join(" · ")) : "—";
      body += h2("4. Plan de comunicaciones");
      body += table(["Tipo", "Canales", "Periodo", "Frecuencia", "Objetivo", "Responsable"],
        d.comms.map((c) => [bold(c.type || "—"), esc((c.channels || []).join(", ")), esc(`${fmtD(c.start)} → ${fmtD(c.end)}`), esc(dayLbl(c.days)), esc(c.objective || "—"), esc(c.owner || "—")]),
        ["16%", "18%", "24%", "16%", "16%", "10%"]);
    }

    /* 5 — Checklist operativo */
    if (d.tasks && d.tasks.length) {
      body += h2("5. Checklist operativo");
      body += para(`${bold(pct + " completado")} ${dim(`· ${pr.done || 0} de ${pr.total || d.tasks.length} tareas`)}`, { mb: "8pt" });
      body += table(["Tarea", "Responsable", "Prioridad", "Deadline", "Estado"],
        d.tasks.map((t) => {
          const st = t.status || (t.done ? "done" : "todo");
          return [esc(t.title || "—"), esc(t.owner || "—"), esc(T_PRIO[t.priority] || "Media"), fmtD(t.deadline), esc(T_STATUS[st] || st)];
        }), ["40%", "18%", "12%", "15%", "15%"]);
    }

    /* 6 — Pendientes vinculados */
    if (d.pendings && d.pendings.length) {
      body += h2("6. Pendientes vinculados");
      body += table(["Pendiente", "Responsable", "Prioridad", "Deadline", "Estado"],
        d.pendings.map((p) => [esc(p.title || "—"), esc(p.owner || "—"), esc(T_PRIO[p.priority] || "Media"), fmtD(p.deadline), esc(T_STATUS[p.status] || "Pendiente")]),
        ["40%", "18%", "12%", "15%", "15%"]);
    }

    /* Footer */
    body += `<p style="margin:24pt 0 0 0;padding-top:6pt;border-top:0.5pt solid ${HAIR};font-family:Arial,sans-serif;font-size:8pt;color:${GRAY};">Documento generado automáticamente desde el Workspace de Campañas · ${fmtD(today)} · Confidencial — uso interno</p>`;

    return `<html>
<head><meta charset="utf-8"><title>Brief — ${esc(d.title)} — ${esc(d.periodLabel || "")}</title>
<style>
@page { size: A4; margin: 2cm 2.2cm 2cm 2.2cm; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { background: #f2f3f5; } .page { max-width: 17cm; margin: 24px auto; background: #fff; padding: 2cm 2.2cm; box-shadow: 0 2px 16px rgba(0,0,0,.12); } }
@media print { .page { padding: 0; } }
table { page-break-inside: auto; } tr { page-break-inside: avoid; }
</style></head>
<body><div class="page">${body}</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };<\/script>
</body></html>`;
  }

  function exportBriefPdf(data) {
    const html = buildHtml(data || {});
    const w = window.open("", "_blank");
    if (!w) { alert("Permite ventanas emergentes para descargar el PDF."); return; }
    w.document.write(html);
    w.document.close();
  }

  window.exportBriefPdf = exportBriefPdf;
})();
