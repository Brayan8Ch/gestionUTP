/* Chrome global — reconstruido desde cero al estilo macOS:
   sidebar translúcido colapsable (desktop) + tab bar iOS con sheet "Más" (móvil).
   Identidad de sección: chips de color plano estilo iOS Settings (sin gradientes). */
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useSyncExternalStore } = React;
  const { LucideIcon } = window;
  const cn = window.cn;

  /* ---------- sidebar collapsed state (persistente) ---------- */
  const SB_KEY = "sidebar-collapsed:v1";
  const SB_EVT = "sidebar-collapsed-change";
  const readSb = () => { try { return localStorage.getItem(SB_KEY) === "1"; } catch { return false; } };
  const writeSb = (v) => { try { localStorage.setItem(SB_KEY, v ? "1" : "0"); } catch {} window.dispatchEvent(new CustomEvent(SB_EVT)); };
  function useSidebarCollapsed() {
    return useSyncExternalStore(
      (cb) => { window.addEventListener(SB_EVT, cb); return () => window.removeEventListener(SB_EVT, cb); },
      () => readSb(), () => false
    );
  }
  window.useSidebarCollapsed = useSidebarCollapsed;

  /* ---------- pila de navegación propia ----------
     El botón Atrás vuelve a la pantalla ANTERIOR real (no a un destino fijo).
     El `to` de BackButton queda como respaldo cuando se entra por URL directa.
     Solo se apilan cambios de página (cambios de query como ?p= no cuentan). */
  const pathOnly = (h) => (String(h || "").replace(/^#/, "").split("?")[0]) || "/";
  const navStack = [];
  let navCurrent = window.location.hash || "#/";
  let navBackFlag = false;
  window.addEventListener("hashchange", () => {
    const next = window.location.hash || "#/";
    if (navBackFlag) { navBackFlag = false; navCurrent = next; return; }
    if (pathOnly(next) !== pathOnly(navCurrent)) {
      navStack.push(navCurrent);
      if (navStack.length > 50) navStack.shift();
    }
    navCurrent = next;
  });
  window.__appNavBack = () => {
    if (!navStack.length) return false;
    navBackFlag = true;
    window.location.hash = navStack.pop();
    return true;
  };

  function useHashPath() {
    const get = () => (window.location.hash.replace(/^#/, "").split("?")[0]) || "/";
    const [path, setPath] = useState(get);
    useEffect(() => {
      const on = () => setPath(get());
      window.addEventListener("hashchange", on);
      return () => window.removeEventListener("hashchange", on);
    }, []);
    return path;
  }

  /* ---------- navegación agrupada (rutas nuevas + alias legados) ---------- */
  const NAV_GROUPS = [
    {
      label: "Campañas",
      items: [
        { key: "brief", label: "Brief", href: "#/campanas/brief", icon: "Megaphone", accent: "brand", paths: ["/campanas", "/campanas/brief"], prefixes: ["/brief/"] },
        { key: "speech", label: "Speech", href: "#/campanas/speech", icon: "Mic", accent: "fuchsia", paths: ["/campanas/speech", "/speechs"], prefixes: ["/speech/"] },
        { key: "argumentario", label: "Argumentario", href: "#/campanas/argumentario", icon: "Quote", accent: "ink", paths: ["/campanas/argumentario", "/argumentario"] },
        { key: "cronComms", label: "Cronograma de comms", href: "#/campanas/cronograma-comms", icon: "Send", accent: "cyan", paths: ["/campanas/cronograma-comms", "/cronograma"] },
        { key: "cronCampanas", label: "Cronograma de campañas", href: "#/campanas/cronograma-campanas", icon: "CalendarRange", accent: "amber", paths: ["/campanas/cronograma-campanas", "/cronograma-campanas"] },
      ],
    },
    {
      label: "Operativa",
      items: [
        { key: "pendiente", label: "Pendientes", href: "#/operativa/pendiente", icon: "ListChecks", accent: "violet", paths: ["/operativa/pendiente", "/pendientes"] },
        { key: "centro", label: "Centro de operaciones", href: "#/operativa/centro", icon: "Gauge", accent: "green", paths: ["/operativa/centro", "/checklist"] },
        { key: "solicitudes", label: "Solicitudes de diseño", href: "#/operativa/solicitudes", icon: "Palette", accent: "pink", paths: ["/operativa/solicitudes", "/solicitudes"] },
        { key: "resumen", label: "Resumen ejecutivo", href: "#/operativa/resumen", icon: "FileText", accent: "ink", paths: ["/operativa/resumen", "/resumen"] },
      ],
    },
    {
      label: "Configuración",
      items: [
        { key: "equipo", label: "Equipo", href: "#/configuracion/equipo", icon: "Users", accent: "slate", paths: ["/configuracion/equipo", "/miembros"] },
        { key: "fechas", label: "Fechas del periodo", href: "#/configuracion/fechas", icon: "CalendarCog", accent: "slate", paths: ["/configuracion/fechas", "/fechas"] },
        { key: "ayuda", label: "Documentación", href: "#/configuracion/ayuda", icon: "CircleHelp", accent: "slate", paths: ["/configuracion/ayuda", "/ayuda"] },
        { key: "fallos", label: "Reporte de fallos", href: "#/configuracion/fallos", icon: "Bug", accent: "slate", paths: ["/configuracion/fallos"] },
      ],
    },
  ];
  const itemActive = (path, it) =>
    (it.paths || []).some((p) => path === p) || (it.prefixes || []).some((p) => path.startsWith(p));

  /* ---------- identidad de sección: color plano estilo iOS Settings ---------- */
  const SECTION_GRAD = {
    brand: "#0071e3", green: "#30b450", violet: "#5e5ce6", cyan: "#2aa1dc", pink: "#fa3a5e",
    amber: "#f59300", slate: "#8e8e93", ink: "#1d1d1f", fuchsia: "#bd4fd8",
  };
  window.SECTION_GRAD = SECTION_GRAD;

  /* Lavado de sección: profundidad neutra, casi imperceptible (sin color). */
  function SectionWash() {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[260px] print:hidden"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)" }} />
    );
  }
  window.SectionWash = SectionWash;

  function SectionHeader({ accent = "brand", icon, title, subtitle, size = "md", className }) {
    const fill = SECTION_GRAD[accent] || SECTION_GRAD.brand;
    const big = size === "lg";
    return (
      <header className={cn("mb-6 flex items-center gap-3.5", className)}>
        <span className={cn("flex shrink-0 items-center justify-center rounded-[10px] text-white shadow-soft", big ? "h-11 w-11" : "h-9 w-9")} style={{ background: fill }}>
          <LucideIcon name={icon} className={big ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1 className={cn("font-bold tracking-tight text-foreground", big ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl")}>{title}</h1>
          {subtitle && <p className={cn("text-muted-foreground", big ? "mt-1 max-w-2xl text-sm" : "mt-0.5 text-xs")}>{subtitle}</p>}
        </div>
      </header>
    );
  }
  window.SectionHeader = SectionHeader;

  /* ---------- back button + toolbar (estilo barra macOS) ---------- */
  function BackButton({ to = "#/", label = "Volver" }) {
    const onClick = (e) => {
      if (window.__appNavBack && window.__appNavBack()) e.preventDefault();
    };
    return (
      <a href={to} onClick={onClick} aria-label={label} title={label}
        className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 print:hidden">
        <LucideIcon name="ChevronLeft" className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" strokeWidth={2.2} />
      </a>
    );
  }
  window.BackButton = BackButton;

  function PageToolbar({ back = "#/", backLabel, left, children, className }) {
    return (
      <div className={cn("sticky top-0 z-40 -mx-4 mb-6 flex h-13 min-h-[52px] items-center justify-between gap-3 overflow-hidden border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl print:hidden sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8", className)}>
        <div className="flex shrink-0 items-center gap-2">
          <window.BackButton to={back} label={backLabel} />
          {left}
        </div>
        {children != null && <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">{children}</div>}
      </div>
    );
  }
  window.PageToolbar = PageToolbar;

  /* ---------- chip de usuario (popover hacia arriba) ---------- */
  function UserChip({ collapsed }) {
    const S = window.Store;
    const session = S.useSession();
    const theme = S.useTheme();
    const roles = S.useRoles();
    const [current, setCurrent] = S.useCurrentRole();
    const [open, setOpen] = useState(false);
    const [editProfile, setEditProfile] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const name = session ? session.name : "Invitado";
    const roleKey = session ? session.role : current;
    const roleLabel = ((roles.find((r) => r.key === roleKey) || {}).label) || roleKey;
    const initial = (name || "?").trim().slice(0, 1).toUpperCase();

    return (
      <div ref={ref} className="relative">
        {open && (
          <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-elevated">
            {session ? (
              <React.Fragment>
                <div className="border-b border-border/70 px-2.5 pb-2 pt-1.5">
                  <p className="truncate text-[13px] font-semibold text-foreground">{session.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{session.cargo || "—"} · {roleLabel}</p>
                  <p className="mt-0.5 truncate text-[9.5px] tabular-nums text-muted-foreground/60" title="Versión desplegada — verifica que coincida tras cada actualización">build {window.APP_BUILD || "desarrollo"}</p>
                </div>
                <a href="#/configuracion/equipo" onClick={() => setOpen(false)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
                  <LucideIcon name="Users" className="h-3.5 w-3.5 text-muted-foreground" /> Miembros y permisos
                </a>
                <button type="button" onClick={() => { setOpen(false); setEditProfile(true); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
                  <LucideIcon name="UserRound" className="h-3.5 w-3.5 text-muted-foreground" /> Editar mi perfil
                </button>
                <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("open-global-search")); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
                  <span className="flex items-center gap-2"><LucideIcon name="Search" className="h-3.5 w-3.5 text-muted-foreground" /> Buscar en todo</span>
                  <kbd className="rounded border border-border bg-surface px-1 text-[9px] text-muted-foreground">Ctrl K</kbd>
                </button>
                <button type="button" onClick={() => { setOpen(false); window.ReportBug && window.ReportBug(); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
                  <span className="flex items-center gap-2"><LucideIcon name="Bug" className="h-3.5 w-3.5 text-muted-foreground" /> Reportar un error</span>
                  <kbd className="rounded border border-border bg-surface px-1 text-[9px] text-muted-foreground">⇧⌘B</kbd>
                </button>
                <a href="#/configuracion/fallos" onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
                  <LucideIcon name="ListChecks" className="h-3.5 w-3.5 text-muted-foreground" /> Ver reporte de fallos
                </a>
                <div className="my-1 border-t border-border/60" />
                <div className="px-2.5 py-1.5">
                  <p className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><LucideIcon name="Palette" className="h-3 w-3" /> Tema</p>
                  <div className="grid grid-cols-3 gap-1">
                    {[["light", "Sun", "Claro"], ["dark", "Moon", "Oscuro"], ["auto", "Monitor", "Auto"]].map(([k, ic, lb]) => (
                      <button key={k} type="button" onClick={() => window.Store.setTheme(k)}
                        className={cn("flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-colors", theme === k ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground")}>
                        <LucideIcon name={ic} className="h-3.5 w-3.5" /> {lb}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="my-1 border-t border-border/60" />
                <button type="button" onClick={() => { setOpen(false); window.Store.logout(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-destructive transition-colors hover:bg-destructive/10">
                  <LucideIcon name="LogOut" className="h-3.5 w-3.5" /> Cerrar sesión
                </button>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Viendo como</p>
                {roles.map((r) => (
                  <button key={r.key} type="button" onClick={() => { setCurrent(r.key); setOpen(false); }}
                    className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors hover:bg-surface", current === r.key ? "text-foreground" : "text-muted-foreground")}>
                    {r.label}
                    {current === r.key && <LucideIcon name="Check" className="h-3.5 w-3.5 text-brand" />}
                  </button>
                ))}
              </React.Fragment>
            )}
          </div>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} title={`${name} · ${roleLabel}`}
          className={cn("flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-foreground/[0.05]", collapsed && "justify-center")}>
          {window.Avatar
            ? <window.Avatar name={name} className="h-8 w-8 text-[12.5px]" />
            : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/12 text-[12.5px] font-bold text-brand">{initial}</span>}
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-foreground">{name}</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{session ? roleLabel : `Viendo como ${roleLabel}`}</span>
            </span>
          )}
          {!collapsed && <LucideIcon name="ChevronsUpDown" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
        </button>
        {editProfile && session && window.ProfileModal && (
          <window.ProfileModal memberId={session.memberId} title="Editar mi perfil" onClose={() => setEditProfile(false)} />
        )}
      </div>
    );
  }

  /* ---------- sidebar macOS (desktop) ---------- */
  function SidebarItem({ it, active, collapsed }) {
    return (
      <a href={it.href} title={collapsed ? it.label : undefined} aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors",
          collapsed && "justify-center px-0",
          active ? "bg-brand text-white shadow-soft" : "text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground"
        )}>
        <LucideIcon name={it.icon} className={cn("h-[17px] w-[17px] shrink-0", active ? "text-white" : "text-foreground/55 group-hover:text-foreground/80")} strokeWidth={1.9} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{it.label}</span>}
      </a>
    );
  }

  function Sidebar() {
    const path = useHashPath();
    const collapsed = useSidebarCollapsed();
    const S = window.Store;
    const gate = S.useModuleGate();

    return (
      <aside aria-label="Navegación principal"
        className={cn("glass fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/80 print:!hidden sm:flex", collapsed ? "w-[72px]" : "w-[248px]")}
        style={{ transition: "width 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
        {/* identidad */}
        <div className={cn("flex items-center gap-2.5 px-4 pb-2 pt-5", collapsed && "justify-center px-0")}>
          <a href="#/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white shadow-soft" style={{ background: "#0071e3" }} aria-label="Inicio">
            <LucideIcon name="Megaphone" className="h-[18px] w-[18px]" strokeWidth={2} />
          </a>
          {!collapsed && (
            <a href="#/" className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold tracking-tight text-foreground">Retención UTP</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">Workspace de campañas</span>
            </a>
          )}
        </div>

        {/* navegación */}
        <nav className="flex-1 overflow-y-auto px-2.5 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarItem it={{ href: "#/", icon: "Home", label: "Inicio" }} active={path === "/"} collapsed={collapsed} />
          {NAV_GROUPS.map((g) => {
            const items = g.items.filter((it) => gate(it.key));
            if (!items.length) return null;
            return (
            <div key={g.label} className="mt-4">
              {collapsed
                ? <div className="mx-3 mb-2 h-px bg-border/80"></div>
                : <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">{g.label}</p>}
              <div className="space-y-0.5">
                {items.map((it) => <SidebarItem key={it.key} it={it} active={itemActive(path, it)} collapsed={collapsed} />)}
              </div>
            </div>
            );
          })}
        </nav>

        {/* acciones inferiores */}
        <div className={cn("border-t border-border/70 p-2.5", collapsed && "p-2")}>
          {window.NotifBell && <window.NotifBell collapsed={collapsed} />}
          <UserChip collapsed={collapsed} />
          <button type="button" onClick={() => writeSb(!collapsed)} aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            className={cn("mt-1 flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground", collapsed && "justify-center px-0")}>
            <LucideIcon name={collapsed ? "PanelLeftOpen" : "PanelLeftClose"} className="h-4 w-4" strokeWidth={1.9} />
            {!collapsed && "Contraer"}
          </button>
        </div>
      </aside>
    );
  }

  /* ---------- tab bar iOS (móvil) ---------- */
  const MORE_GROUPS = [
    {
      label: "Campañas",
      items: [
        { key: "speech", label: "Speech", href: "#/campanas/speech", icon: "Mic" },
        { key: "argumentario", label: "Argumentario", href: "#/campanas/argumentario", icon: "Quote" },
        { key: "cronComms", label: "Cronograma de comms", href: "#/campanas/cronograma-comms", icon: "Send" },
        { key: "cronCampanas", label: "Cronograma de campañas", href: "#/campanas/cronograma-campanas", icon: "CalendarRange" },
      ],
    },
    {
      label: "Operativa",
      items: [
        { key: "solicitudes", label: "Solicitudes de diseño", href: "#/operativa/solicitudes", icon: "Palette" },
        { key: "resumen", label: "Resumen ejecutivo", href: "#/operativa/resumen", icon: "FileText" },
      ],
    },
    {
      label: "Configuración",
      items: [
        { key: "equipo", label: "Equipo", href: "#/configuracion/equipo", icon: "Users" },
        { key: "fechas", label: "Fechas del periodo", href: "#/configuracion/fechas", icon: "CalendarCog" },
        { key: "ayuda", label: "Documentación", href: "#/configuracion/ayuda", icon: "CircleHelp" },
        { key: "fallos", label: "Reporte de fallos", href: "#/configuracion/fallos", icon: "Bug" },
      ],
    },
  ];
  const MORE_PATHS = ["/campanas/speech", "/speechs", "/campanas/argumentario", "/argumentario", "/campanas/cronograma-comms", "/cronograma", "/campanas/cronograma-campanas", "/cronograma-campanas", "/operativa/solicitudes", "/solicitudes", "/operativa/resumen", "/resumen", "/configuracion/equipo", "/miembros", "/configuracion/fechas", "/fechas", "/configuracion/ayuda", "/ayuda"];

  function MobileTabBar() {
    const path = useHashPath();
    const [moreOpen, setMoreOpen] = useState(false);
    const [editProfile, setEditProfile] = useState(false);
    const S = window.Store;
    const session = S.useSession();
    const gate = S.useModuleGate();
    useEffect(() => { setMoreOpen(false); }, [path]);
    useEffect(() => {
      document.body.style.overflow = moreOpen ? "hidden" : "";
      return () => { document.body.style.overflow = ""; };
    }, [moreOpen]);

    const TABS = [
      { key: "inicio", label: "Inicio", icon: "Home", href: "#/", mod: null, active: path === "/" },
      { key: "campanas", label: "Campañas", icon: "Megaphone", href: "#/campanas", mod: "brief", active: path === "/campanas" || path === "/campanas/brief" || path.startsWith("/brief/") },
      { key: "pendientes", label: "Pendientes", icon: "ListChecks", href: "#/operativa/pendiente", mod: "pendiente", active: path === "/operativa/pendiente" || path === "/pendientes" },
      { key: "centro", label: "Operaciones", icon: "Gauge", href: "#/operativa/centro", mod: "centro", active: path === "/operativa/centro" || path === "/checklist" },
    ].filter((t) => !t.mod || gate(t.mod));
    const moreActive = MORE_PATHS.some((p) => path === p || path.startsWith(p + "/")) || path.startsWith("/speech/");

    return (
      <React.Fragment>
        {moreOpen && (
          <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-label="Más secciones">
            <button type="button" aria-label="Cerrar" onClick={() => setMoreOpen(false)} className="fade-in absolute inset-0 w-full bg-foreground/30 backdrop-blur-[2px]"></button>
            <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface-elevated px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5 shadow-elevated">
              <span aria-hidden="true" className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-border"></span>
              {MORE_GROUPS.map((g) => {
                const items = g.items.filter((it) => gate(it.key));
                if (!items.length) return null;
                return (
                <div key={g.label} className="mb-4">
                  <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{g.label}</p>
                  <div className="overflow-hidden rounded-2xl bg-surface">
                    {items.map((it, i) => (
                      <a key={it.key} href={it.href} onClick={() => setMoreOpen(false)}
                        className={cn("flex min-h-[52px] items-center gap-3.5 px-4 py-3 transition-colors active:bg-muted", i > 0 && "border-t border-border/60")}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <LucideIcon name={it.icon} className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <span className="flex-1 text-[15px] font-medium text-foreground">{it.label}</span>
                        <LucideIcon name="ChevronRight" className="h-4 w-4 text-muted-foreground/60" />
                      </a>
                    ))}
                  </div>
                </div>
                );
              })}
              {session && window.NotifBell && (
                <div className="rounded-2xl bg-surface px-2 py-1"><window.NotifBell collapsed={false} /></div>
              )}
              {session && (
                <button type="button" onClick={() => { setMoreOpen(false); window.dispatchEvent(new CustomEvent("open-global-search")); }}
                  className="flex min-h-[52px] w-full items-center gap-3.5 rounded-2xl bg-surface px-4 py-3 transition-colors active:bg-muted">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><LucideIcon name="Search" className="h-4 w-4" strokeWidth={1.9} /></span>
                  <span className="flex-1 text-left text-[15px] font-medium text-foreground">Buscar en todo</span>
                  <LucideIcon name="ChevronRight" className="h-4 w-4 text-muted-foreground/60" />
                </button>
              )}
              {session && (
                <button type="button" onClick={() => { setMoreOpen(false); window.ReportBug && window.ReportBug(); }}
                  className="flex min-h-[52px] w-full items-center gap-3.5 rounded-2xl bg-surface px-4 py-3 transition-colors active:bg-muted">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><LucideIcon name="Bug" className="h-4 w-4" strokeWidth={1.9} /></span>
                  <span className="flex-1 text-left text-[15px] font-medium text-foreground">Reportar un error</span>
                  <LucideIcon name="ChevronRight" className="h-4 w-4 text-muted-foreground/60" />
                </button>
              )}
              {session && (
                <button type="button" onClick={() => { setMoreOpen(false); setEditProfile(true); }}
                  className="flex min-h-[52px] w-full items-center gap-3.5 rounded-2xl bg-surface px-4 py-3 transition-colors active:bg-muted">
                  {window.Avatar
                    ? <window.Avatar name={session.name} className="h-8 w-8 text-[12px]" />
                    : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-[12px] font-semibold text-brand">{(session.name || "?").slice(0, 1).toUpperCase()}</span>}
                  <span className="flex-1 text-left text-[15px] font-medium text-foreground">Mi perfil</span>
                  <LucideIcon name="ChevronRight" className="h-4 w-4 text-muted-foreground/60" />
                </button>
              )}
              {session && (
                <button type="button" onClick={() => { setMoreOpen(false); window.Store.logout(); }}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-surface text-[15px] font-medium text-destructive transition-colors active:bg-destructive/10">
                  <LucideIcon name="LogOut" className="h-4 w-4" /> Cerrar sesión · {session.name}
                </button>
              )}
            </div>
          </div>
        )}
        <nav aria-label="Navegación principal" className="glass-panel fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 print:hidden sm:hidden" style={{ borderRadius: 0 }}>
          <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${TABS.length + 1}, minmax(0, 1fr))` }}>
            {TABS.map((t) => (
              <a key={t.key} href={t.href} aria-label={t.label} aria-current={t.active ? "page" : undefined}
                className={cn("flex min-h-[52px] flex-col items-center justify-center gap-0.5", t.active ? "text-brand" : "text-muted-foreground")}>
                <LucideIcon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={t.active ? 2.1 : 1.8} />
                <span className="text-[10px] font-medium leading-none">{t.label}</span>
              </a>
            ))}
            <button type="button" aria-label="Más" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}
              className={cn("flex min-h-[52px] flex-col items-center justify-center gap-0.5", moreOpen || moreActive ? "text-brand" : "text-muted-foreground")}>
              <LucideIcon name="LayoutGrid" className="h-[22px] w-[22px]" strokeWidth={moreOpen || moreActive ? 2.1 : 1.8} />
              <span className="text-[10px] font-medium leading-none">Más</span>
            </button>
          </div>
        </nav>
        {editProfile && session && window.ProfileModal && (
          <window.ProfileModal memberId={session.memberId} title="Editar mi perfil" onClose={() => setEditProfile(false)} />
        )}
      </React.Fragment>
    );
  }

  function Navbar() {
    return (
      <React.Fragment>
        <Sidebar />
        <MobileTabBar />
      </React.Fragment>
    );
  }

  window.Navbar = Navbar;
})();
