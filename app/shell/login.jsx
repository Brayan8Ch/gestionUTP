/* Login screen — member picker + clave, customizable from Miembros y permisos. */
(function () {
  const React = window.React;
  const { useState } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input } = window;
  const cn = window.cn;

  const ROLE_TONE = {
    admin: "bg-brand/10 text-brand",
    editor: "bg-accent-violet/10 text-accent-violet",
    viewer: "bg-muted text-muted-foreground",
  };
  const roleTone = (k) => ROLE_TONE[k] || "bg-accent-green/10 text-accent-green";

  function LoginPage() {
    const members = S.useMembers().filter((m) => m.status === "active" && (m.name || "").trim());
    const roles = S.useRoles();
    const cfg = S.useLoginSettings();
    const [selected, setSelected] = useState(null);
    const [clave, setClave] = useState("");
    const [error, setError] = useState("");
    const roleLabel = (k) => (roles.find((r) => r.key === k) || {}).label || k;
    const sel = members.find((m) => m.id === selected);
    const needsClave = sel && (sel.clave || "") !== "";

    const submit = () => {
      if (!sel) return;
      const res = S.login(sel.id, clave);
      if (!res.ok) { setError(res.error); setClave(""); return; }
      /* Producción: vincula el correo de la cuenta autenticada a este miembro
         (solo si aún no tiene uno) → las próximas entradas serán directas. */
      if (window.RemoteSync && window.RemoteSync.enabled && window.RemoteSync.client) {
        window.RemoteSync.client.auth.getUser().then(({ data: { user } }) => {
          const email = ((user && user.email) || "").trim().toLowerCase();
          if (email && !(sel.email || "").trim()) S.updateMember(sel.id, { email });
        }).catch(() => {});
      }
      window.location.hash = "#/";
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" data-screen-label="Inicio de sesión">
        <div aria-hidden className="hero-radial pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] opacity-60" />
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
              <LucideIcon name="Sparkles" className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{cfg.title}</h1>
            {cfg.subtitle && <p className="mt-1 max-w-xs text-[13px] leading-snug text-muted-foreground">{cfg.subtitle}</p>}
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-elevated">
            {window.RemoteSync && window.RemoteSync.enabled && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-brand/5 p-2.5">
                <LucideIcon name="Link2" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Tu cuenta aún no está vinculada a un miembro del equipo. Elige quién eres: tu correo quedará
                  vinculado automáticamente y las próximas entradas serán directas.
                </p>
              </div>
            )}
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">¿Quién eres?</p>
            <div className="space-y-1">
              {members.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">No hay miembros activos. Pide a un administrador que te agregue.</p>}
              {members.map((m) => (
                <button key={m.id} type="button"
                  onClick={() => { setSelected(m.id); setClave(""); setError(""); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors",
                    selected === m.id ? "border-brand bg-brand/5" : "border-transparent hover:bg-surface")}>
                  {window.Avatar && m.photo
                    ? <window.Avatar name={m.name} photo={m.photo} className="h-8 w-8 text-[12px]" />
                    : <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", roleTone(m.accessRole))}>
                        {(m.name || "?").trim().slice(0, 1).toUpperCase()}
                      </span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{m.name}</span>
                    {cfg.showCargo && m.cargo && <span className="block truncate text-[11px] text-muted-foreground">{m.cargo}</span>}
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", roleTone(m.accessRole))}>{roleLabel(m.accessRole)}</span>
                  {(m.clave || "") !== "" && <LucideIcon name="Lock" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                </button>
              ))}
            </div>

            {needsClave && (
              <div className="mt-3 border-t border-border pt-3">
                <label className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clave de acceso</label>
                <Input type="password" value={clave} autoFocus onChange={(e) => { setClave(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  placeholder="••••" className="h-9 bg-surface tabular-nums" />
              </div>
            )}
            {error && <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-medium text-destructive"><LucideIcon name="AlertCircle" className="h-3.5 w-3.5" /> {error}</p>}

            <Button onClick={submit} disabled={!sel || (needsClave && !clave)} className="mt-4 w-full gap-1.5 rounded-xl">
              {cfg.buttonLabel || "Entrar"} <LucideIcon name="ArrowRight" className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            El acceso y las claves se administran en <span className="font-medium text-foreground">Miembros y permisos</span>.
          </p>
        </div>
      </div>
    );
  }

  window.LoginPage = LoginPage;

  /* Producción: cuenta autenticada en Supabase pero sin miembro vinculado.
     Se resuelve sola en vivo cuando un admin asigna el correo en Equipo
     (el puente reintenta con cada cambio de miembros). */
  function LinkPendingPage() {
    const [email, setEmail] = React.useState("");
    React.useEffect(() => {
      const c = window.RemoteSync && window.RemoteSync.client;
      if (!c) return;
      c.auth.getUser().then(({ data: { user } }) => setEmail((user && user.email) || ""));
    }, []);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" data-screen-label="Cuenta sin vincular">
        <div aria-hidden className="hero-radial pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] opacity-60" />
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-amber/15 text-accent-amber">
            <LucideIcon name="UserSearch" className="h-7 w-7" strokeWidth={1.7} />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Cuenta pendiente de vincular</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Iniciaste sesión correctamente{email ? <span> como <span className="font-semibold text-foreground">{email}</span></span> : ""}, pero
            tu correo aún no está asignado a ningún miembro del equipo.
          </p>
          <div className="mt-5 rounded-2xl border border-border bg-surface-elevated p-4 text-left">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">¿Qué hacer?</span> Pide a un administrador que entre a
              <span className="font-medium text-foreground"> Configuración → Equipo</span> y escriba tu correo en la columna
              <span className="font-medium text-foreground"> Correo (login)</span> de tu miembro. En cuanto lo haga,
              esta pantalla se desbloqueará sola — no necesitas recargar.
            </p>
          </div>
          <button type="button" onClick={() => window.RemoteSync && window.RemoteSync.signOut()}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-4 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
            <LucideIcon name="LogOut" className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
          {/* La espera con un cachimbo es menos espera */}
          <div className="mx-auto mt-5 w-full max-w-md text-left">
            <UtpRunner />
          </div>
        </div>
      </div>
    );
  }
  window.LinkPendingPage = LinkPendingPage;

  /* ============ Usuario sin rol asignado: bloqueo total + minijuego ============
     Estilo "dinosaurio de Chrome": un estudiante UTP corre hacia su titulación
     saltando exámenes. Espacio / clic / tap para saltar. */
  function UtpRunner() {
    const canvasRef = React.useRef(null);
    const [score, setScore] = React.useState(0);
    const [best, setBest] = React.useState(0);
    const [dead, setDead] = React.useState(false);
    const stateRef = React.useRef(null);

    React.useEffect(() => {
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return; // canvas no disponible (navegador restringido): sin juego, sin errores
      const W = cv.width, H = cv.height, GROUND = H - 28;
      const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const C = dark
        ? { fg: "#e6e9f0", soft: "#8b93a5", accent: "#5b8cff", danger: "#ff7a7a", ground: "#3a4152" }
        : { fg: "#1c2433", soft: "#8a90a0", accent: "#2251FF", danger: "#d8452c", ground: "#c9cfdb" };
      const st = { y: GROUND, vy: 0, jumping: false, obs: [], t: 0, speed: 4.2, alive: true, score: 0, raf: 0, next: 60 };
      stateRef.current = st;

      const jump = () => {
        if (!st.alive) { restart(); return; }
        if (!st.jumping) { st.vy = -10.5; st.jumping = true; }
      };
      const restart = () => {
        st.obs = []; st.t = 0; st.speed = 4.2; st.alive = true; st.score = 0; st.y = GROUND; st.vy = 0; st.jumping = false; st.next = 60;
        setDead(false); setScore(0); loop();
      };
      const onKey = (e) => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); } };
      const onTap = (e) => { e.preventDefault(); jump(); };
      window.addEventListener("keydown", onKey);
      cv.addEventListener("pointerdown", onTap);

      function drawStudent(x, yTop) {
        ctx.fillStyle = C.fg;
        ctx.fillRect(x + 6, yTop, 12, 12);                 // cabeza
        ctx.fillStyle = C.accent;
        ctx.fillRect(x + 2, yTop + 13, 20, 16);            // polo UTP
        ctx.fillStyle = C.fg;
        ctx.fillRect(x + 4, yTop + 30, 6, 12);             // piernas
        ctx.fillRect(x + 14, yTop + 30, 6, 12);
        ctx.fillStyle = C.danger;
        ctx.fillRect(x - 3, yTop + 14, 6, 12);             // mochila
        ctx.fillStyle = C.fg;
        ctx.fillRect(x + 3, yTop - 4, 18, 4);              // birrete
        ctx.fillRect(x + 9, yTop - 8, 6, 5);
      }
      function drawExam(o) {
        ctx.fillStyle = C.danger;
        ctx.fillRect(o.x, GROUND + 42 - o.h, o.w, o.h);
        ctx.fillStyle = dark ? "#1c2433" : "#ffffff";
        ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(o.label, o.x + o.w / 2, GROUND + 42 - o.h / 2 + 3);
      }
      const LABELS = ["EXAMEN", "PARCIAL", "FINAL", "TAREA", "QUIZ"];

      function loop() {
        if (!st.alive) return;
        st.raf = requestAnimationFrame(loop);
        st.t++;
        ctx.clearRect(0, 0, W, H);
        // suelo
        ctx.strokeStyle = C.ground; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, GROUND + 43); ctx.lineTo(W, GROUND + 43); ctx.stroke();
        // física del salto
        st.vy += 0.55; st.y += st.vy;
        if (st.y >= GROUND) { st.y = GROUND; st.vy = 0; st.jumping = false; }
        drawStudent(36, st.y);
        // obstáculos
        if (st.t >= st.next) {
          const h = 22 + Math.random() * 16;
          st.obs.push({ x: W + 10, w: 44, h, label: LABELS[Math.floor(Math.random() * LABELS.length)] });
          st.next = st.t + 70 + Math.random() * 70 - Math.min(30, st.speed * 3);
        }
        st.obs = st.obs.filter((o) => o.x + o.w > -5);
        st.obs.forEach((o) => { o.x -= st.speed; drawExam(o); });
        // colisión (cajas con margen amable)
        const px = 38, pw = 18, pTop = st.y - 6, pBot = st.y + 42;
        for (const o of st.obs) {
          const oTop = GROUND + 42 - o.h;
          if (px + pw > o.x + 6 && px < o.x + o.w - 6 && pBot > oTop + 4) {
            st.alive = false; cancelAnimationFrame(st.raf);
            setDead(true); setBest((b) => Math.max(b, Math.floor(st.score)));
            ctx.fillStyle = C.soft; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("¡Jalaste el ciclo! Toca o presiona espacio para reintentar", W / 2, 36);
            return;
          }
        }
        // puntaje: créditos aprobados
        st.score += 0.08 + st.speed * 0.004;
        st.speed += 0.0012;
        setScore(Math.floor(st.score));
        ctx.fillStyle = C.soft; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
        ctx.fillText("Rumbo a la titulación →", 8, 16);
      }
      loop();
      return () => { cancelAnimationFrame(st.raf); window.removeEventListener("keydown", onKey); cv.removeEventListener("pointerdown", onTap); };
    }, []);

    return (
      <div className="rounded-2xl border border-border bg-surface-elevated p-3">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mientras esperas… ayuda al cachimbo a titularse</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">Créditos: <span className="font-semibold text-foreground">{score}</span>{best > 0 && <span> · Récord {best}</span>}</p>
        </div>
        <canvas ref={canvasRef} width="460" height="150" className="w-full cursor-pointer rounded-xl bg-surface" aria-label="Minijuego: estudiante saltando exámenes" />
        <p className="mt-1.5 px-1 text-[10.5px] text-muted-foreground">Espacio, clic o tap para saltar los exámenes.{dead ? " ¡Otra vez se puede!" : ""}</p>
      </div>
    );
  }

  function NoRolePage() {
    const S = window.Store;
    const session = S.useSession();
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" data-screen-label="Sin rol asignado">
        <div aria-hidden className="hero-radial pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] opacity-60" />
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-border bg-surface-elevated p-6 text-center shadow-elevated">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-violet/15 text-accent-violet">
              <LucideIcon name="ShieldQuestion" className="h-7 w-7" strokeWidth={1.7} />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Acceso pendiente de activación</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Hola{session && session.name ? ` ${session.name.split(" ")[0]}` : ""} 👋 Tu cuenta ya está vinculada, pero
              <span className="font-semibold text-foreground"> aún no tienes un rol asignado</span>, así que por ahora no puedes ver los módulos.
            </p>
            <div className="mt-3 rounded-2xl bg-brand/5 p-3">
              <p className="text-[12.5px] leading-relaxed text-foreground">
                Contáctate con <span className="font-bold text-brand">rbullon</span> para que te asigne tu rol y desbloquear el acceso.
              </p>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Cuando te lo asignen, esta pantalla se desbloqueará sola — no necesitas recargar.</p>
            <button type="button" onClick={() => window.Store.logout()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted">
              <LucideIcon name="LogOut" className="h-3.5 w-3.5" /> Cerrar sesión
            </button>
          </div>
          <div className="mt-4">
            <UtpRunner />
          </div>
        </div>
      </div>
    );
  }
  window.NoRolePage = NoRolePage;
})();
