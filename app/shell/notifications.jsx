/* =====================================================================
   Notificaciones — campanita con contador de no-leídos.
   Avisos dirigidos a la persona con sesión: asignaciones de pendientes,
   menciones @nombre en avances, y eventos de solicitudes de diseño.
   Además agrega avisos derivados: deadlines que vencen hoy/mañana.
   ===================================================================== */
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useMemo } = React;
  const S = window.Store;
  const { LucideIcon } = window;
  const cn = window.cn;

  const TYPE_META = {
    mention: { icon: "AtSign", tone: "bg-accent-violet/10 text-accent-violet" },
    task: { icon: "ListChecks", tone: "bg-brand/10 text-brand" },
    design: { icon: "Palette", tone: "bg-accent-pink/10 text-accent-pink" },
    due: { icon: "AlarmClock", tone: "bg-accent-amber/15 text-accent-amber" },
    info: { icon: "Info", tone: "bg-muted text-muted-foreground" },
  };
  const relTime = (ts) => {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
  };
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const tomorrowISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  /* Vencimientos derivados (no se almacenan): mis tareas/pendientes con
     deadline hoy o mañana y no completados. */
  function useDueAlerts(myName) {
    S.useGeneralPendings();           // re-render con cambios
    const [, force] = useState(0);
    useEffect(() => {
      const h = () => force((x) => x + 1);
      window.addEventListener("campaign-config-change", h);
      return () => window.removeEventListener("campaign-config-change", h);
    }, []);
    return useMemo(() => {
      if (!myName) return [];
      const hoy = todayISO(), man = tomorrowISO();
      const out = [];
      const pushDue = (title, deadline, href, ctx) => out.push({
        id: "due-" + title + deadline, ts: Date.now(), type: "due", seen: true, derived: true,
        title: deadline === hoy ? "Vence HOY" : "Vence mañana",
        detail: title + (ctx ? ` · ${ctx}` : ""), href, deadline,
      });
      // pendientes generales
      S.readGeneralPendings().forEach((i) => {
        if (i.owner === myName && i.status !== "done" && (i.deadline === hoy || i.deadline === man)) pushDue(i.title || "Pendiente", i.deadline, "#/operativa/pendiente");
      });
      // tareas operativas del periodo actual en campañas configuradas
      let period = "";
      try { period = localStorage.getItem("current-period:v1") || ""; } catch {}
      if (period) {
        (S.campaigns || []).forEach((c) => {
          if (!S.isCampaignConfigured(c.slug, period)) return;
          S.readOperativeTasks(c.slug, period).forEach((t) => {
            if (t.owner === myName && t.status !== "done" && !t.done && (t.deadline === hoy || t.deadline === man))
              pushDue(t.title, t.deadline, `#/brief/${c.slug}?p=${period}`, c.title);
          });
        });
      }
      out.sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
      return out.slice(0, 10);
    }, [myName]);
  }

  function NotifBell({ collapsed }) {
    const session = S.useSession();
    const myName = session && session.name;
    const { items, unread } = S.useNotifs(myName || "");
    const due = useDueAlerts(myName);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const DUE_SEEN_KEY = "notif-due-seen:" + (myName || "anon").toLowerCase();
    const [dueSeenDay, setDueSeenDay] = useState(() => { try { return localStorage.getItem(DUE_SEEN_KEY) || ""; } catch { return ""; } });
    const dueToday = due.filter((d) => d.deadline === todayISO()).length;
    const badge = unread + (dueSeenDay === todayISO() ? 0 : dueToday);

    useEffect(() => {
      if (!open) return;
      const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const openList = () => {
      const next = !open;
      setOpen(next);
      if (next && unread > 0) S.markNotifsSeen(items.filter((n) => !n.seen).map((n) => n.id));
      if (next) { try { localStorage.setItem(DUE_SEEN_KEY, todayISO()); } catch {} setDueSeenDay(todayISO()); }
    };
    if (!myName) return null;
    const all = [...due, ...items];

    return (
      <div ref={ref} className="relative">
        {open && (
          <div className="absolute bottom-full left-0 z-50 mb-2 max-h-[60vh] w-[19rem] overflow-y-auto rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-elevated">
            <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notificaciones</p>
            {all.length === 0 && <p className="px-2.5 py-5 text-center text-[12px] text-muted-foreground">Todo al día ✓ Sin avisos pendientes.</p>}
            {all.map((n) => {
              const m = TYPE_META[n.type] || TYPE_META.info;
              const inner = (
                <div className="flex items-start gap-2.5">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", m.tone)}>
                    <LucideIcon name={m.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold text-foreground">{n.title}</span>
                      {!n.seen && !n.derived && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    </span>
                    {n.detail && <span className="block truncate text-[11px] text-muted-foreground">{n.detail}</span>}
                    <span className="block text-[10px] text-muted-foreground/70">{n.derived ? n.deadline : `${n.from || ""} · ${relTime(n.ts)}`}</span>
                  </span>
                </div>
              );
              return n.href ? (
                <a key={n.id} href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-2.5 py-2 transition-colors hover:bg-surface">{inner}</a>
              ) : (
                <div key={n.id} className="rounded-xl px-2.5 py-2">{inner}</div>
              );
            })}
          </div>
        )}
        <button type="button" onClick={openList} title="Notificaciones"
          className={cn("relative flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-foreground/[0.05]", collapsed && "justify-center")}>
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70">
            <LucideIcon name="Bell" className="h-4 w-4" strokeWidth={1.9} />
            {badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>
            )}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-foreground">Notificaciones</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{badge > 0 ? `${badge} sin leer` : "Al día"}</span>
            </span>
          )}
        </button>
      </div>
    );
  }
  window.NotifBell = NotifBell;
})();
