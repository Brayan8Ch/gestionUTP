/* =====================================================================
   RemoteSync — capa de producción para la app Campañas.

   Qué hace:
   1. Si hay credenciales en app/config.js, exige inicio de sesión real
      (Supabase Auth, email + contraseña) antes de cargar la app.
   2. Descarga todo el estado compartido desde la tabla `app_state`
      (Postgres en Supabase) y lo hidrata en localStorage. La app
      original sigue leyendo localStorage como siempre: cero cambios
      en la lógica de negocio.
   3. Intercepta TODAS las escrituras a localStorage (Storage.prototype)
      y las replica a Supabase con debounce. Última escritura gana.
   4. Se suscribe a Realtime: si otro usuario cambia algo, se actualiza
      tu localStorage y se disparan los eventos internos del store para
      que la UI se refresque al instante.
   5. Carga los scripts de la app de forma dinámica (incluida la
      transpilación Babel de los .jsx) recién cuando los datos están
      listos, evitando renders con estado vacío.

   Claves que NO se sincronizan (son por dispositivo/usuario):
     - session:v1            → con quién estás "firmando" dentro de la app
     - sidebar-collapsed:v1  → preferencia visual
     - brief-reader-mode:v1  → preferencia visual
     - exec-timer:v1         → temporizador personal en ejecución
     - sb-*                  → tokens internos de Supabase Auth
   ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG || {};
  const ENABLED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  const LOCAL_ONLY = new Set([
    "session:v1",
    "current-role:v1",      // rol activo de ESTA persona (no debe pisar el de otros)
    "current-period:v1",    // filtro de periodo: preferencia de vista por usuario
    "sidebar-collapsed:v1",
    "brief-reader-mode:v1",
    "exec-timer:v1",
    "module-usage:v1",      // hábitos de navegación: ordenan el menú de cada persona
    "notif-read:v1",        // qué notificaciones ya viste TÚ (no se comparte)
    "backup-last:v1",       // recordatorio local de respaldo del admin
  ]);
  const isLocalOnly = (k) => !k || LOCAL_ONLY.has(k) || k.startsWith("sb-");

  /* Eventos internos de la app: se disparan tras cambios remotos para
     que cada hook useSyncExternalStore relea su snapshot. */
  const APP_EVENTS = [
    "campaign-config-change", "operative-checklist-change", "general-pendings-change",
    "campaigns-change", "members-change", "roles-change", "changelog-change",
    "brief-versions-change", "design-requests-change", "argumentario-change",
    "day-plan-change", "notifs-change", "templates-change",
  ];

  /* Guardamos referencias originales ANTES de parchear. */
  const rawSet = Storage.prototype.setItem;
  const rawDel = Storage.prototype.removeItem;

  let client = null;          // cliente supabase
  const pendingTimers = new Map(); // key -> timeout id (debounce)
  const lastPushed = new Map();    // key -> último valor enviado (anti-eco)

  /* ------------------------------------------------------------------
     UI mínima: splash de carga, formulario de login y badge de estado.
     (DOM puro: React aún no está montado en esta fase.)
     ------------------------------------------------------------------ */
  const ui = {
    el: null,
    show(html) {
      if (!this.el) {
        this.el = document.createElement("div");
        this.el.id = "remote-sync-gate";
        this.el.style.cssText =
          "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
          "background:#0b1220;color:#e6e9f0;font-family:Inter,system-ui,sans-serif;";
        document.body.appendChild(this.el);
      }
      this.el.innerHTML = html;
    },
    hide() { if (this.el) { this.el.remove(); this.el = null; } },
  };

  const splash = (msg) => ui.show(
    '<div style="text-align:center;max-width:320px;padding:24px">' +
    '<div style="width:48px;height:48px;margin:0 auto 16px;border-radius:16px;background:#2251FF;display:flex;align-items:center;justify-content:center;font-size:22px">✦</div>' +
    '<div style="font-size:15px;font-weight:600">' + (CFG.APP_TITLE || "Campañas") + "</div>" +
    '<div style="margin-top:8px;font-size:13px;opacity:.65">' + msg + "</div>" +
    '<div style="margin:18px auto 0;width:120px;height:3px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden">' +
    '<div style="width:40%;height:100%;background:#2251FF;border-radius:99px;animation:rsbar 1.1s ease-in-out infinite alternate"></div></div>' +
    "<style>@keyframes rsbar{from{transform:translateX(-10%)}to{transform:translateX(210%)}}</style></div>"
  );

  function loginForm() {
    return new Promise((resolve) => {
      ui.show(
        '<div style="width:100%;max-width:360px;padding:24px">' +
        '<div style="text-align:center;margin-bottom:20px">' +
        '<div style="width:48px;height:48px;margin:0 auto 12px;border-radius:16px;background:#fff;color:#0b1220;display:flex;align-items:center;justify-content:center;font-size:22px">✦</div>' +
        '<div style="font-size:18px;font-weight:700">' + (CFG.APP_TITLE || "Campañas") + "</div>" +
        '<div style="margin-top:6px;font-size:13px;opacity:.65">Inicia sesión con tu cuenta del equipo</div></div>' +
        '<form id="rs-login" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px">' +
        '<label style="display:block;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;opacity:.6;margin-bottom:6px">Correo</label>' +
        '<input id="rs-email" type="email" required autocomplete="username" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.25);color:#fff;font-size:14px;outline:none" />' +
        '<label style="display:block;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;opacity:.6;margin:14px 0 6px">Contraseña</label>' +
        '<input id="rs-pass" type="password" required autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.25);color:#fff;font-size:14px;outline:none" />' +
        '<div id="rs-err" style="display:none;margin-top:10px;font-size:12px;color:#ff8a8a"></div>' +
        '<button id="rs-btn" type="submit" style="margin-top:16px;width:100%;padding:11px;border:none;border-radius:99px;background:#2251FF;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Entrar</button>' +
        "</form>" +
        '<div style="margin-top:14px;text-align:center;font-size:12px;opacity:.5">El acceso lo gestiona el administrador del proyecto.</div></div>'
      );
      const form = document.getElementById("rs-login");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("rs-btn");
        const err = document.getElementById("rs-err");
        btn.disabled = true; btn.textContent = "Verificando…"; err.style.display = "none";
        const email = document.getElementById("rs-email").value.trim();
        const password = document.getElementById("rs-pass").value;
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          err.textContent = "No se pudo iniciar sesión: credenciales inválidas o usuario no autorizado.";
          err.style.display = "block";
          btn.disabled = false; btn.textContent = "Entrar";
          return;
        }
        resolve();
      });
    });
  }

  /* Badge de estado de sincronización (esquina inferior derecha). */
  let badge = null, badgeTimer = null;
  function setStatus(state) {
    if (!ENABLED) return;
    if (!badge) {
      badge = document.createElement("div");
      badge.style.cssText =
        "position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;align-items:center;gap:6px;" +
        "padding:5px 10px;border-radius:99px;font:500 11px Inter,system-ui,sans-serif;" +
        "background:rgba(15,23,42,.85);color:#cbd5e1;backdrop-filter:blur(6px);pointer-events:none;transition:opacity .4s";
      document.body.appendChild(badge);
    }
    const dot = (c) => '<span style="width:7px;height:7px;border-radius:99px;background:' + c + '"></span>';
    if (state === "saving") badge.innerHTML = dot("#f59e0b") + "Guardando…";
    else if (state === "error") badge.innerHTML = dot("#ef4444") + "Sin conexión — reintentando";
    else badge.innerHTML = dot("#22c55e") + "Sincronizado";
    badge.style.opacity = "1";
    clearTimeout(badgeTimer);
    if (state === "synced") badgeTimer = setTimeout(() => { badge.style.opacity = "0"; }, 1800);
  }

  /* ------------------------------------------------------------------
     Replicación a Supabase
     ------------------------------------------------------------------ */
  const failedKeys = new Set();   // claves que agotaron reintentos
  const inflight = new Set();     // pushes en curso

  /* Banner persistente cuando hay cambios que NO llegaron al servidor. */
  let failBanner = null;
  function renderFailBanner() {
    if (failedKeys.size === 0) { if (failBanner) { failBanner.remove(); failBanner = null; } return; }
    if (!failBanner) {
      failBanner = document.createElement("div");
      failBanner.style.cssText =
        "position:fixed;left:50%;bottom:52px;transform:translateX(-50%);z-index:99998;display:flex;align-items:center;gap:10px;" +
        "padding:10px 14px;border-radius:14px;font:500 12.5px Inter,system-ui,sans-serif;max-width:92vw;" +
        "background:#7f1d1d;color:#fee2e2;box-shadow:0 8px 30px rgba(0,0,0,.35)";
      document.body.appendChild(failBanner);
    }
    failBanner.innerHTML =
      '<span style="width:8px;height:8px;border-radius:99px;background:#f87171;flex:none"></span>' +
      "<span>Hay <b>" + failedKeys.size + "</b> cambio(s) sin guardar en el servidor. No cierres esta pestaña.</span>" +
      '<button id="rs-retry" style="flex:none;border:none;border-radius:99px;padding:6px 12px;background:#fee2e2;color:#7f1d1d;font-weight:700;font-size:12px;cursor:pointer">Reintentar</button>';
    failBanner.querySelector("#rs-retry").onclick = () => {
      const keys = Array.from(failedKeys);
      failedKeys.clear(); renderFailBanner(); setStatus("saving");
      keys.forEach((k) => pushKey(k));
    };
  }

  function schedulePush(key) {
    clearTimeout(pendingTimers.get(key));
    pendingTimers.set(key, setTimeout(() => pushKey(key), 350));
    setStatus("saving");
  }

  async function pushKey(key, attempt) {
    pendingTimers.delete(key);
    inflight.add(key);
    const value = localStorage.getItem(key);
    try {
      if (value === null) {
        lastPushed.set(key, null);
        const { error } = await client.from("app_state").delete().eq("key", key);
        if (error) throw error;
      } else {
        lastPushed.set(key, value);
        const { error } = await client.from("app_state").upsert(
          { key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }
        );
        if (error) throw error;
      }
      inflight.delete(key);
      failedKeys.delete(key); renderFailBanner();
      if (pendingTimers.size === 0 && inflight.size === 0 && failedKeys.size === 0) setStatus("synced");
    } catch (e) {
      console.warn("[RemoteSync] error al guardar", key, e);
      inflight.delete(key);
      setStatus("error");
      const n = (attempt || 0) + 1;
      if (n <= 5) setTimeout(() => pushKey(key, n), Math.min(15000, 1000 * Math.pow(2, n)));
      else { failedKeys.add(key); renderFailBanner(); }
    }
  }

  /* Aviso del navegador si se intenta cerrar con cambios aún no guardados. */
  window.addEventListener("beforeunload", (e) => {
    if (!ENABLED) return;
    if (pendingTimers.size > 0 || inflight.size > 0 || failedKeys.size > 0) {
      e.preventDefault();
      e.returnValue = "Hay cambios que aún no se guardan en el servidor.";
    }
  });

  function patchStorage() {
    Storage.prototype.setItem = function (key, value) {
      rawSet.call(this, key, value);
      if (this === window.localStorage && !isLocalOnly(key)) schedulePush(key);
    };
    Storage.prototype.removeItem = function (key) {
      rawDel.call(this, key);
      if (this === window.localStorage && !isLocalOnly(key)) schedulePush(key);
    };
  }

  /* Cambio remoto entrante → aplicar localmente + refrescar UI. */
  function applyRemote(key, value) {
    if (isLocalOnly(key)) return;
    const current = localStorage.getItem(key);
    if (current === value) return;                 // anti-eco
    if (lastPushed.get(key) === value) return;     // es nuestro propio push
    if (value === null) rawDel.call(localStorage, key);
    else rawSet.call(localStorage, key, value);
    try { window.dispatchEvent(new StorageEvent("storage", { key })); } catch {}
    APP_EVENTS.forEach((evt) => { try { window.dispatchEvent(new CustomEvent(evt)); } catch {} });
  }

  /* ------------------------------------------------------------------
     Hidratación inicial y semilla
     ------------------------------------------------------------------ */
  async function hydrate() {
    let from = 0, total = 0;
    const remoteKeys = new Set();
    for (;;) {
      const { data, error } = await client.from("app_state")
        .select("key,value").order("key").range(from, from + 999);
      if (error) throw error;
      (data || []).forEach((row) => {
        remoteKeys.add(row.key);
        if (!isLocalOnly(row.key)) {
          rawSet.call(localStorage, row.key, row.value);
          lastPushed.set(row.key, row.value);
        }
      });
      total += (data || []).length;
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    /* La nube es la fuente de verdad: cualquier clave local que ya no exista
       en remoto (p. ej. datos demo viejos o datos borrados por otro usuario)
       se purga del navegador para que no "reviva" al primer guardado. */
    if (total > 0) {
      const stale = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!isLocalOnly(k) && !remoteKeys.has(k)) stale.push(k);
      }
      stale.forEach((k) => rawDel.call(localStorage, k));
      if (stale.length) console.info("[RemoteSync] purgadas " + stale.length + " claves locales obsoletas.");
    }
    return total;
  }

  async function seedFromLocal() {
    const rows = [{ key: "app:initialized", value: String(Date.now()) }];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isLocalOnly(key)) continue;
      rows.push({ key, value: localStorage.getItem(key) });
    }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await client.from("app_state").upsert(rows.slice(i, i + 200), { onConflict: "key" });
      if (error) throw error;
    }
    rows.forEach((r) => lastPushed.set(r.key, r.value));
    return rows.length;
  }

  function subscribeRealtime() {
    client.channel("app_state_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_state" }, (payload) => {
        if (payload.eventType === "DELETE") applyRemote(payload.old.key, null);
        else applyRemote(payload.new.key, payload.new.value);
      })
      .subscribe();
  }

  /* ------------------------------------------------------------------
     Puente de identidad: una sola pantalla de login.
     El correo de la cuenta Supabase se compara con el campo "email" de
     cada miembro (Equipo → Miembros). Si coincide, la sesión interna se
     firma sola: nada de segundo login. Si nadie coincide, se muestra el
     selector clásico una vez, hasta que el admin asigne el correo.
     ------------------------------------------------------------------ */
  /* Verificación de contraseña (para confirmar acciones destructivas):
     re-autentica contra Supabase con la sesión actual. */
  async function verifyPassword(password) {
    if (!client) return { ok: false, error: "Sin conexión con el servidor." };
    try {
      const { data: { user } } = await client.auth.getUser();
      const email = user && user.email;
      if (!email) return { ok: false, error: "Sesión no válida. Recarga la página." };
      /* Verificación con un cliente DESECHABLE y aislado: no persiste sesión
         ni toca el token de la sesión activa. Re-loguearse sobre el cliente
         principal reemplazaba la sesión en vivo y podía tumbar el realtime
         (colapso reportado en Safari). */
      const tmp = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error } = await tmp.auth.signInWithPassword({ email, password });
      try { if (!error) await tmp.auth.signOut({ scope: "local" }); } catch {}
      if (error) return { ok: false, error: "Contraseña incorrecta." };
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo verificar. Revisa tu conexión." };
    }
  }

  async function bridgeIdentity() {
    if (!client) return;
    const { data: { user } } = await client.auth.getUser();
    const email = ((user && user.email) || "").trim().toLowerCase();
    if (!email) return;

    const tryAutoLogin = () => {
      let members = [];
      try { members = JSON.parse(localStorage.getItem("members:v1") || "[]") || []; } catch {}
      /* Bootstrap de espacio vacío: si no existe NINGÚN miembro (base recién
         estrenada), el primer usuario autenticado se convierte en el
         administrador inicial. Sin esto, nadie podría crear al equipo. */
      if (!members.length) {
        const first = {
          id: "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          name: email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          cargo: "", accessRole: "admin", status: "active", email,
        };
        members = [first];
        localStorage.setItem("members:v1", JSON.stringify(members));
        console.info("[RemoteSync] Espacio vacío: " + email + " creado como administrador inicial.");
      }
      const match = members.find((m) => m && m.status === "active" && (m.email || "").trim().toLowerCase() === email);
      if (!match) return false;
      let session = null;
      try { session = JSON.parse(localStorage.getItem("session:v1") || "null"); } catch {}
      if (session && session.memberId === match.id) return true; // ya firmado
      // Supabase ya autenticó a esta persona → firmar sesión interna sin pedir clave.
      rawSet.call(localStorage, "session:v1", JSON.stringify({ memberId: match.id, ts: Date.now() }));
      rawSet.call(localStorage, "current-role:v1", match.accessRole || "viewer");
      ["session-change", "roles-change", "campaign-config-change"].forEach((evt) => {
        try { window.dispatchEvent(new CustomEvent(evt)); } catch {}
      });
      return true;
    };

    if (!tryAutoLogin()) {
      // Si aún no hay correo asignado, reintenta cuando cambie la lista de miembros
      // (p. ej. el admin lo asigna desde otra máquina y llega por realtime).
      const h = () => { if (tryAutoLogin()) window.removeEventListener("members-change", h); };
      window.addEventListener("members-change", h);
    }
  }

  /* Logout unificado: cerrar sesión interna también cierra Supabase. */
  function unifyLogout() {
    const S = window.Store;
    if (!client || !S || typeof S.logout !== "function" || S.logout.__unified) return;
    const orig = S.logout;
    const unified = function () { orig(); client.auth.signOut(); };
    unified.__unified = true;
    S.logout = unified;
  }

  /* ------------------------------------------------------------------
     Carga dinámica de la app (.js directo, .jsx vía Babel)
     ------------------------------------------------------------------ */
  function loadJs(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src));
      document.body.appendChild(s);
    });
  }
  async function loadJsx(src) {
    const r = await fetch(src);
    if (!r.ok) throw new Error("No se pudo cargar " + src);
    const code = await r.text();
    const out = Babel.transform(code, { presets: ["react"], filename: src }).code;
    const s = document.createElement("script");
    s.text = out + "\n//# sourceURL=" + src;
    document.body.appendChild(s);
  }
  async function loadScripts(list) {
    for (const src of list) {
      if (src.endsWith(".jsx")) await loadJsx(src);
      else await loadJs(src);
    }
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  async function boot(scripts) {
    if (!ENABLED) {
      // Modo local: comportamiento idéntico al prototipo.
      console.info("[RemoteSync] Sin credenciales en app/config.js → modo local (localStorage).");
      await loadScripts(scripts);
      return;
    }
    try {
      splash("Conectando con el servidor…");
      await loadJs("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
      client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      window.RemoteSync.client = client;

      const { data: { session } } = await client.auth.getSession();
      if (!session) await loginForm();

      splash("Cargando datos del equipo…");
      const remoteRows = await hydrate();
      if (remoteRows === 0) {
        const seeded = await seedFromLocal();
        if (seeded) console.info("[RemoteSync] Base vacía: se migraron " + seeded + " claves locales a Supabase.");
      }

      patchStorage();
      subscribeRealtime();

      splash("Preparando la aplicación…");
      await bridgeIdentity();
      await loadScripts(scripts);
      unifyLogout();
      ui.hide();
      setStatus("synced");

      // Si la sesión de Supabase expira o se cierra, recargar al login.
      client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") window.location.reload();
      });
    } catch (e) {
      console.error("[RemoteSync] fallo de arranque", e);
      ui.show(
        '<div style="text-align:center;max-width:340px;padding:24px">' +
        '<div style="font-size:16px;font-weight:700">No se pudo conectar</div>' +
        '<div style="margin-top:8px;font-size:13px;opacity:.7">Revisa la configuración en <code>app/config.js</code> y que el script SQL se haya ejecutado en Supabase.</div>' +
        '<div style="margin-top:8px;font-size:12px;opacity:.5">' + (e && e.message ? e.message : e) + "</div>" +
        '<button onclick="location.reload()" style="margin-top:16px;padding:10px 22px;border:none;border-radius:99px;background:#2251FF;color:#fff;font-weight:600;cursor:pointer">Reintentar</button></div>'
      );
    }
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    else window.location.reload();
  }

  window.RemoteSync = { boot, signOut, verifyPassword, enabled: ENABLED, client: null };
})();
