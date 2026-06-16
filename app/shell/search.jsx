/* =====================================================================
   Búsqueda global — Ctrl+K / Cmd+K desde cualquier pantalla.
   Cruza: campañas, tareas operativas (todas las configuradas), pendientes
   generales, solicitudes de diseño, miembros y argumentario.
   Navegación con ↑ ↓ y Enter. El índice se construye al abrir (datos
   pequeños, instantáneo).
   ===================================================================== */
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useMemo } = React;
  const S = window.Store;
  const { LucideIcon } = window;
  const cn = window.cn;

  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function buildIndex() {
    const out = [];
    const periods = S.listAvailablePeriods();
    (S.campaigns || []).forEach((c) => {
      out.push({ kind: "Campaña", icon: c.icon || "Megaphone", tone: "bg-brand/10 text-brand", title: c.title, ctx: c.description || "", href: `#/brief/${c.slug}` });
      periods.forEach((p) => {
        if (!S.isCampaignConfigured(c.slug, p)) return;
        S.readOperativeTasks(c.slug, p).forEach((t) => {
          if (!t.title) return;
          out.push({ kind: "Tarea", icon: "ListChecks", tone: "bg-accent-green/10 text-accent-green", title: t.title, ctx: `${c.title} · ${S.formatPeriodShort(p)}${t.owner ? " · " + t.owner : ""}`, href: `#/brief/${c.slug}?p=${p}` });
        });
      });
    });
    S.readGeneralPendings().forEach((i) => {
      if (!i.title) return;
      out.push({ kind: "Pendiente", icon: "CircleDot", tone: "bg-accent-violet/10 text-accent-violet", title: i.title, ctx: i.owner ? `Responsable: ${i.owner}` : "Sin asignar", href: "#/operativa/pendiente" });
    });
    (S.readDesignRequests() || []).forEach((r) => {
      if (!r.title) return;
      out.push({ kind: "Diseño", icon: "Palette", tone: "bg-accent-pink/10 text-accent-pink", title: r.title, ctx: `${(S.DR_STATUS[r.status] || {}).label || r.status}${r.designer ? " · " + r.designer : ""}`, href: "#/operativa/solicitudes" });
    });
    (S.readMembers() || []).filter((m) => m.status === "active" && m.name).forEach((m) => {
      out.push({ kind: "Miembro", icon: "UserRound", tone: "bg-muted text-muted-foreground", title: m.name, ctx: m.cargo || "", href: "#/configuracion/equipo" });
    });
    (S.readArgs ? S.readArgs() : []).forEach((a) => {
      if (!a.titulo) return;
      out.push({ kind: "Argumento", icon: "Quote", tone: "bg-accent-amber/15 text-accent-amber", title: a.titulo, ctx: (a.keywords || []).slice(0, 4).join(", "), href: "#/campanas/argumentario" });
    });
    return out;
  }

  function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const inputRef = useRef(null);
    const [index, setIndex] = useState([]);

    useEffect(() => {
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          setOpen((o) => { const n = !o; if (n) { setIndex(buildIndex()); setQ(""); setSel(0); } return n; });
        }
        if (e.key === "Escape") setOpen(false);
      };
      const onOpen = () => { setIndex(buildIndex()); setQ(""); setSel(0); setOpen(true); };
      window.addEventListener("keydown", onKey);
      window.addEventListener("open-global-search", onOpen);
      return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-global-search", onOpen); };
    }, []);
    useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

    const results = useMemo(() => {
      const nq = norm(q.trim());
      if (!nq) return [];
      const scored = [];
      for (const it of index) {
        const t = norm(it.title), c = norm(it.ctx);
        let score = -1;
        if (t.startsWith(nq)) score = 0;
        else if (t.includes(nq)) score = 1;
        else if (c.includes(nq)) score = 2;
        if (score >= 0) scored.push([score, it]);
      }
      scored.sort((a, b) => a[0] - b[0]);
      return scored.slice(0, 12).map(([, it]) => it);
    }, [q, index]);
    useEffect(() => { setSel(0); }, [q]);

    const go = (it) => { if (!it) return; setOpen(false); window.location.hash = it.href; };
    const onInputKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
    };

    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[130] flex items-start justify-center bg-foreground/30 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-elevated">
          <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
            <LucideIcon name="Search" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
              placeholder="Buscar campañas, tareas, pendientes, solicitudes, miembros…"
              className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none" />
            <kbd className="shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1.5">
            {q.trim() === "" && <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">Escribe para buscar en todo el workspace.<br /><span className="text-[11px] opacity-70">Tip: abre esta búsqueda con Ctrl+K (Cmd+K en Mac).</span></p>}
            {q.trim() !== "" && results.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">Sin resultados para "{q.trim()}".</p>}
            {results.map((r, i) => (
              <button key={r.kind + r.title + i} type="button" onClick={() => go(r)} onMouseEnter={() => setSel(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors", i === sel ? "bg-surface" : "hover:bg-surface/60")}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", r.tone)}>
                  <LucideIcon name={r.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{r.title}</span>
                  {r.ctx && <span className="block truncate text-[11px] text-muted-foreground">{r.ctx}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">{r.kind}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  window.GlobalSearch = GlobalSearch;
})();
