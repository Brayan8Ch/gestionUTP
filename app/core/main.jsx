/* Router + mount. Hash-based navigation across the four screens. */
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const cn = window.cn;

  function parseRoute() {
    const raw = window.location.hash.replace(/^#/, "");
    const path = (raw.split("?")[0] || "/") || "/";
    const segs = path.split("/").filter(Boolean);
    if (segs.length === 0) return { name: "menu" };
    /* ---- grouped routes (canonical) ---- */
    if (segs[0] === "campanas") {
      if (!segs[1] || segs[1] === "brief") return { name: "home" };
      if (segs[1] === "speech") return { name: "speechs" };
      if (segs[1] === "argumentario") return { name: "argumentario" };
      if (segs[1] === "cronograma-comms") return { name: "cronograma" };
      if (segs[1] === "cronograma-campanas") return { name: "cronograma-campanas" };
      return { name: "home" };
    }
    if (segs[0] === "operativa") {
      if (segs[1] === "pendiente") return { name: "pendientes" };
      if (segs[1] === "centro") return { name: "checklist" };
      if (segs[1] === "solicitudes") return { name: "solicitudes" };
      if (segs[1] === "resumen") return { name: "resumen" };
      return { name: "checklist" };
    }
    if (segs[0] === "configuracion") {
      if (segs[1] === "equipo") return { name: "miembros" };
      if (segs[1] === "fechas") return { name: "fechas" };
      if (segs[1] === "ayuda") return { name: "ayuda" };
      if (segs[1] === "fallos") return { name: "fallos" };
      return { name: "miembros" };
    }
    if (segs[0] === "ayuda") return { name: "ayuda" };
    /* ---- legacy routes (kept as aliases so old links never break) ---- */
    if (segs[0] === "miembros") return { name: "miembros" };
    if (segs[0] === "solicitudes") return { name: "solicitudes" };
    if (segs[0] === "cronograma") return { name: "cronograma" };
    if (segs[0] === "cronograma-campanas") return { name: "cronograma-campanas" };
    if (segs[0] === "fechas") return { name: "fechas" };
    if (segs[0] === "brief" && segs[1]) return { name: "brief", slug: decodeURIComponent(segs[1]) };
    if (segs[0] === "speech" && segs[1]) return { name: "speech", slug: decodeURIComponent(segs[1]) };
    if (segs[0] === "speechs") return { name: "speechs" };
    if (segs[0] === "argumentario") return { name: "argumentario" };
    if (segs[0] === "resumen") return { name: "resumen" };
    if (segs[0] === "pendientes") return { name: "pendientes" };
    if (segs[0] === "checklist") return { name: "checklist" };
    return { name: "notfound" };
  }

  /* Ruta → módulo (para bloquear módulos deshabilitados por rol) */
  const ROUTE_MODULE = {
    home: "brief", brief: "brief", speech: "speech", speechs: "speech", argumentario: "argumentario",
    cronograma: "cronComms", "cronograma-campanas": "cronCampanas", pendientes: "pendiente",
    checklist: "centro", solicitudes: "solicitudes", resumen: "resumen",
    miembros: "equipo", fechas: "fechas", ayuda: "ayuda", fallos: "equipo",
  };
  function ModuleBlocked() {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <window.LucideIcon name="Lock" className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Módulo no habilitado</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tu rol actual no tiene acceso a este módulo. Un administrador puede habilitarlo en Equipo → Roles y permisos → Módulos.</p>
          <div className="mt-6">
            <a href="#/" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Ir al inicio</a>
          </div>
        </div>
      </div>
    );
  }

  function NotFound() {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">La página que buscas no existe o fue movida.</p>
          <div className="mt-6">
            <a href="#/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Ir al inicio</a>
          </div>
        </div>
      </div>
    );
  }

  function App() {
    const [route, setRoute] = useState(parseRoute());
    useEffect(() => {
      const onHash = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);

    // Login gate — when enabled in Miembros y permisos, require a session.
    // En producción (backend configurado) la identidad interna es SIEMPRE
    // obligatoria: nadie navega como invitado, sin importar la opción.
    const loginCfg = window.Store.useLoginSettings();
    const session = window.Store.useSession();
    const gate = window.Store.useModuleGate();
    const remoteAuth = !!(window.RemoteSync && window.RemoteSync.enabled);
    /* Registro de uso de módulos (para ordenar el menú por más usados). Por dispositivo. */
    useEffect(() => {
      const mod = ROUTE_MODULE[route.name];
      if (!mod || !session) return;
      try {
        const u = JSON.parse(localStorage.getItem("module-usage:v1") || "{}") || {};
        u[mod] = (u[mod] || 0) + 1;
        localStorage.setItem("module-usage:v1", JSON.stringify(u));
      } catch {}
    }, [route.name]);
    /* Miembro sin rol asignado: bloqueo total con instrucciones de contacto. */
    if (session && !session.role) return <window.NoRolePage />;
    if (!session) {
      // Producción: el único login es Supabase. Si la cuenta no está
      // vinculada a un miembro, se muestra la pantalla de espera (se
      // desbloquea sola cuando el admin asigna el correo).
      if (remoteAuth) return <window.LinkPendingPage />;
      if (loginCfg.enabled) return <window.LoginPage />;
    }

    let page;
    const modKey = ROUTE_MODULE[route.name];
    if (modKey && !gate(modKey)) page = <ModuleBlocked />;
    else if (route.name === "menu") page = <window.MenuPage />;
    else if (route.name === "miembros") page = <window.MembersPage />;
    else if (route.name === "solicitudes") page = <window.DesignRequestsPage />;
    else if (route.name === "cronograma") page = <window.ConsolidatedCommsPage />;
    else if (route.name === "cronograma-campanas") page = <window.CampaignScheduleHub />;
    else if (route.name === "fechas") page = <window.GlobalParamsPage />;
    else if (route.name === "home") page = <window.HomePage />;
    else if (route.name === "brief") page = <window.BriefPage key={route.slug} slug={route.slug} />;
    else if (route.name === "speech") page = <window.SpeechPage key={route.slug} slug={route.slug} />;
    else if (route.name === "speechs") page = <window.SpeechsPage />;
    else if (route.name === "argumentario") page = <window.ArgumentarioPage />;
    else if (route.name === "pendientes") page = <window.CommandCenter key="people" initialMode="people" />;
    else if (route.name === "checklist") page = <window.CommandCenter key="center" initialMode="center" />;
    else if (route.name === "resumen") page = <window.ResumenPage />;
    else if (route.name === "ayuda") page = <window.AyudaPage />;
    else if (route.name === "fallos") page = <window.BugReportsPage />;
    else page = <NotFound />;
    return (<Shell>{page}</Shell>);
  }

  // Content shell: macOS sidebar on desktop (content shifts right), iOS tab bar on mobile.
  function Shell({ children }) {
    const collapsed = window.useSidebarCollapsed();
    return (
      <React.Fragment>
        <div className={cn("pb-24 transition-[padding] duration-300 print:!pb-0 print:!pl-0 sm:pb-8", collapsed ? "sm:pl-[72px]" : "sm:pl-[248px]")}>
          {children}
        </div>
        {window.Navbar ? <window.Navbar /> : null}
        {window.ProfileGate ? <window.ProfileGate /> : null}
        {window.GlobalSearch ? <window.GlobalSearch /> : null}
      </React.Fragment>
    );
  }

  // Seed demo data SOLO en modo local (prototipo). En producción la app
  // parte de cero: configs y parámetros vacíos, sin datos de ejemplo.
  try { if (!(window.RemoteSync && window.RemoteSync.enabled)) window.Store.seedDemo(); } catch (e) { console.warn("seed failed", e); }
  if (!window.location.hash) window.location.hash = "#/";
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
