/* =====================================================================
   Reporte de fallos — registro compartido de bugs del equipo.
   Cada reporte (generado desde el botón 🐞 o Ctrl/Cmd+Shift+B) se acumula
   en la nube. Desde aquí el admin los revisa, ve la secuencia de pasos de
   cada uno, y los descarga TODOS en un solo archivo listo para diagnóstico.
   ===================================================================== */
(function () {
  const React = window.React;
  const { useState } = React;
  const S = window.Store;
  const ReactDOM = window.ReactDOM;
  const { LucideIcon, Button, toast } = window;
  const cn = window.cn;

  const KIND_META = {
    click: { icon: "MousePointerClick", tone: "text-brand", label: "Clic" },
    nav: { icon: "Navigation", tone: "text-accent-violet", label: "Navegación" },
    error: { icon: "OctagonX", tone: "text-destructive", label: "Error" },
    rejection: { icon: "OctagonX", tone: "text-destructive", label: "Promesa fallida" },
    "console.error": { icon: "TerminalSquare", tone: "text-destructive", label: "Consola" },
    "console.warn": { icon: "TriangleAlert", tone: "text-accent-amber", label: "Aviso" },
    boot: { icon: "Power", tone: "text-muted-foreground", label: "Inicio" },
  };
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
  const relOf = (ts, base) => { const s = Math.round((ts - base) / 1000); return s <= 0 ? "0s" : s < 60 ? s + "s" : Math.floor(s / 60) + "m" + (s % 60) + "s"; };

  function BugReportsPage() {
    const all = S.useBugReports();
    const canManage = S.useCan("manageMembers");
    const [openKey, setOpenKey] = useState(null);
    const [filter, setFilter] = useState("open"); // open | resolved | all
    const [applyOpen, setApplyOpen] = useState(false);
    const hasErrors = (r) => (r.logs || []).some((l) => l.kind === "error" || l.kind === "rejection" || l.kind === "console.error");
    const openCount = all.filter((r) => (r.report.status || "open") !== "resolved").length;
    const resolvedCount = all.length - openCount;
    const reports = all.filter((r) => filter === "all" ? true : (r.report.status || "open") === (filter === "resolved" ? "resolved" : "open"));

    const downloadAll = () => {
      const pending = all.filter((r) => (r.report.status || "open") !== "resolved");
      if (pending.length === 0) { toast("No hay fallos abiertos para exportar"); return; }
      const payload = {
        app: "campanas-workspace", kind: "bug-report-batch", version: 2,
        exportedAt: new Date().toISOString(),
        instructions: "Devuélveme los IDs resueltos. Pégalos en la app (Marcar resueltos) o usa el objeto { resolved: [\"BUG-XXXX\", ...] }.",
        count: pending.length,
        ids: pending.map((r) => r.report.id),
        reports: pending.map((r) => r.report),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `reporte-fallos-bloque-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(`${pending.length} fallo(s) abierto(s) exportado(s)`);
    };

    return (
      <div className="min-h-screen bg-background" data-screen-label="Reporte de fallos">
        <window.SectionWash accent="rose" />
        <main className="mx-auto w-full max-w-4xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/configuracion/equipo" backLabel="Equipo">
            <div className="flex items-center gap-2">
              {reports.length > 0 && canManage && (
                <Button variant="outline" size="sm" onClick={() => { if (confirm(`¿Vaciar los ${reports.length} reportes del registro compartido? Descárgalos antes si los necesitas.`)) { S.clearBugReports(); toast("Registro de fallos vaciado"); } }} className="h-8 gap-1.5 text-muted-foreground">
                  <LucideIcon name="Trash2" className="h-3.5 w-3.5" /> Vaciar
                </Button>
              )}
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setApplyOpen(true)} className="h-8 gap-1.5">
                  <LucideIcon name="CircleCheckBig" className="h-3.5 w-3.5" /> Marcar resueltos
                </Button>
              )}
              <Button size="sm" onClick={downloadAll} disabled={openCount === 0} className="h-8 gap-1.5">
                <LucideIcon name="Download" className="h-3.5 w-3.5" /> Exportar abiertos ({openCount})
              </Button>
            </div>
          </window.PageToolbar>

          <window.SectionHeader accent="rose" icon="Bug" size="lg" title="Reporte de fallos"
            subtitle="Bugs reportados por el equipo. Descárgalos en bloque y pásaselos a Claude para diagnóstico." />

          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface/50 px-3.5 py-2.5">
            <LucideIcon name="Info" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Para reportar un fallo desde cualquier pantalla: botón <span className="font-semibold text-foreground">🐞</span> abajo a la derecha, o <kbd className="rounded border border-border bg-surface px-1 text-[10px]">Ctrl/Cmd + Shift + B</kbd>. Cada reporte guarda automáticamente los últimos pasos, la pantalla, el navegador y el estado — sin imágenes ni contraseñas.
            </p>
          </div>

          <div className="mb-3 inline-flex rounded-full border border-border bg-surface-elevated p-0.5">
            {[["open", "Abiertos", openCount], ["resolved", "Resueltos", resolvedCount], ["all", "Todos", all.length]].map(([k, lb, n]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors", filter === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {lb} <span className={cn("tabular-nums", filter === k ? "opacity-80" : "opacity-60")}>{n}</span>
              </button>
            ))}
          </div>

          {applyOpen && <ApplyResolvedModal onClose={() => setApplyOpen(false)} />}

          {reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-16 text-center">
              <LucideIcon name="BugOff" className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">{filter === "resolved" ? "Aún no hay fallos resueltos." : filter === "open" ? "Sin fallos abiertos. 🎉" : "Sin fallos reportados. 🎉"}</p>
              <p className="mt-1 text-[12px] text-muted-foreground/80">{filter === "open" ? "Cuando alguien reporte uno, aparecerá aquí para todo el equipo." : "Cambia de pestaña para ver otros estados."}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {reports.map(({ key, report }) => {
                const open = openKey === key;
                const logs = report.logs || [];
                const base = logs.length ? logs[0].t : report.createdAt ? new Date(report.createdAt).getTime() : Date.now();
                const err = hasErrors(report);
                return (
                  <div key={key} className={cn("overflow-hidden rounded-2xl border bg-surface-elevated shadow-soft", err ? "border-destructive/30" : "border-border/70")}>
                    <button type="button" onClick={() => setOpenKey(open ? null : key)} className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface/50">
                      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", err ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand")}>
                        <LucideIcon name={err ? "OctagonAlert" : "MessageSquareWarning"} className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">{report.id}</span>
                          {(report.status || "open") === "resolved"
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-green"><LucideIcon name="Check" className="h-2.5 w-2.5" /> Resuelto</span>
                            : <span className="rounded-full bg-accent-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-amber">Abierto</span>}
                          <span className="text-[13.5px] font-semibold text-foreground">{(report.comment || "").trim() || "(sin comentario)"}</span>
                          {err && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive">Con error</span>}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span title="Fecha en que se reportó">Solicitado {fmtTime(report.createdAt)}</span>
                          {report.resolvedAt && (report.status || "open") === "resolved" && <span className="text-accent-green" title="Fecha en que se marcó resuelto">· resuelto {fmtTime(report.resolvedAt)}</span>}
                          {report.context?.member?.name && <span>· {report.context.member.name}</span>}
                          <span>· {(report.context?.hash || "").slice(0, 28) || "—"}</span>
                          <span>· {logs.length} pasos</span>
                          {report.context?.build && <span>· build {report.context.build}</span>}
                        </span>
                      </span>
                      <LucideIcon name={open ? "ChevronUp" : "ChevronDown"} className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>

                    {open && (
                      <div className="border-t border-border/60 px-4 py-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5 text-[11.5px]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estado al fallar</p>
                            <p className="text-muted-foreground">Pantalla: <span className="text-foreground">{report.context?.hash || "—"}</span></p>
                            <p className="text-muted-foreground">Conexión: <span className="text-foreground">{report.context?.online ? "en línea" : "sin conexión"}{report.context?.remoteSync ? " · nube activa" : ""}</span></p>
                            <p className="text-muted-foreground">Pantalla: <span className="text-foreground">{report.context?.screen || "—"}</span></p>
                          </div>
                          <div className="space-y-1.5 text-[11.5px]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Datos técnicos</p>
                            <p className="text-muted-foreground">Versión: <span className="text-foreground tabular-nums">{report.context?.build || "—"}</span></p>
                            <p className="truncate text-muted-foreground" title={report.context?.userAgent}>Navegador: <span className="text-foreground">{(report.context?.userAgent || "").replace(/^Mozilla\/[\d.]+ \(/, "").split(")")[0] || "—"}</span></p>
                            <p className="text-muted-foreground">Usuario: <span className="text-foreground">{report.context?.member?.name || "—"} ({report.context?.member?.role || "?"})</span></p>
                          </div>
                        </div>

                        <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Secuencia de pasos</p>
                        <ol className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 bg-surface/40 p-2">
                          {logs.map((l, i) => {
                            const m = KIND_META[l.kind] || { icon: "Dot", tone: "text-muted-foreground", label: l.kind };
                            return (
                              <li key={i} className="flex items-start gap-2 px-1 py-0.5 text-[11.5px]">
                                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground/60">{relOf(l.t, base)}</span>
                                <LucideIcon name={m.icon} className={cn("mt-0.5 h-3 w-3 shrink-0", m.tone)} />
                                <span className="min-w-0 flex-1 break-words text-foreground/90">{l.msg}</span>
                              </li>
                            );
                          })}
                        </ol>

                        {canManage && (
                          <div className="mt-2.5 flex items-center justify-between">
                            <button type="button" onClick={() => S.setBugStatus(report.id, (report.status || "open") === "resolved" ? "open" : "resolved")}
                              className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors", (report.status || "open") === "resolved" ? "text-muted-foreground hover:bg-surface" : "bg-accent-green/10 text-accent-green hover:bg-accent-green/20")}>
                              <LucideIcon name={(report.status || "open") === "resolved" ? "RotateCcw" : "Check"} className="h-3 w-3" />
                              {(report.status || "open") === "resolved" ? "Reabrir" : "Marcar resuelto"}
                            </button>
                            <button type="button" onClick={() => { S.removeBugReport(key); if (openKey === key) setOpenKey(null); }}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive">
                              <LucideIcon name="Trash2" className="h-3 w-3" /> Descartar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }
  /* ============ Marcar resueltos: pegar IDs o subir el archivo de Claude ============ */
  function ApplyResolvedModal({ onClose }) {
    const [text, setText] = useState("");
    const fileRef = React.useRef(null);
    const apply = (input) => {
      const res = S.applyResolvedBugs(input);
      if (res.matched > 0) toast(`${res.matched} fallo(s) marcado(s) como resuelto(s)`);
      else toast("No se encontraron IDs que coincidan (formato BUG-XXXX)");
      onClose();
    };
    const onFile = (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { apply(JSON.parse(r.result)); } catch { apply(String(r.result)); } };
      r.readAsText(f);
    };
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]" role="dialog" aria-label="Marcar resueltos"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-green/10 text-accent-green"><LucideIcon name="CircleCheckBig" className="h-4.5 w-4.5" /></span>
            <h3 className="text-[15px] font-semibold text-foreground">Marcar fallos como resueltos</h3>
          </div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Pega los IDs que te devolvió Claude (ej. <span className="font-mono text-foreground">BUG-A3F2, BUG-9C10</span>) o sube el archivo de resolución. Los fallos coincidentes pasarán a <span className="font-medium text-accent-green">Resuelto</span> para todo el equipo.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus
            placeholder="BUG-A3F2, BUG-9C10, BUG-1B7E…"
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current && fileRef.current.click()} className="h-8 gap-1.5">
              <LucideIcon name="Upload" className="h-3.5 w-3.5" /> Subir archivo
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json,.txt" className="hidden" onChange={onFile} />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={() => apply(text)} disabled={!text.trim()} className="gap-1.5"><LucideIcon name="Check" className="h-3.5 w-3.5" /> Aplicar</Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  window.BugReportsPage = BugReportsPage;
})();
