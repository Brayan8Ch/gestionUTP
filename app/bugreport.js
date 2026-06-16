/* =====================================================================
   BugReport — reporte de errores con diagnóstico automático.
   - Captura en un buffer circular: errores JS, promesas rechazadas,
     console.error/warn y navegación (migas de pan).
   - window.ReportBug() abre un modal (DOM puro: funciona aunque React
     se haya roto) para describir el problema.
   - Genera un archivo reporte-error-<fecha>.json con todo el contexto
     para pegárselo a Claude, y guarda una copia en la nube
     (bugreport:<ts>) para que el admin las recolecte.
   Este archivo se carga ANTES que la app para atrapar errores de arranque.
   ===================================================================== */
(function () {
  const MAX = 400;
  const buffer = [];
  const push = (kind, msg, extra) => {
    const e = { t: Date.now(), kind, msg: String(msg).slice(0, 600) };
    if (extra) e.extra = extra;
    buffer.push(e);
    if (buffer.length > MAX) buffer.shift();
  };

  /* ---- captura automática ---- */
  window.addEventListener("error", (e) => {
    // Errores de recursos (img, script, css) que no disparan window.onerror normal
    if (e.target && e.target !== window && (e.target.src || e.target.href)) {
      push("resource-error", (e.target.tagName || "?") + " no cargó: " + (e.target.src || e.target.href));
      return;
    }
    push("error", (e.message || "error") + " @ " + (e.filename || "?") + ":" + (e.lineno || "?") + (e.colno ? ":" + e.colno : ""),
      e.error && e.error.stack ? e.error.stack.split("\n").slice(0, 5).join("\n") : undefined);
  }, true);
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    push("rejection", r && r.message ? r.message : String(r), r && r.stack ? r.stack.split("\n").slice(0, 5).join("\n") : undefined);
  });
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a) => { push("console.error", a.map((x) => (x && x.stack) ? x.stack.split("\n").slice(0, 3).join(" | ") : String(x)).join(" ")); origError(...a); };
  console.warn = (...a) => { push("console.warn", a.map(String).join(" ")); origWarn(...a); };
  window.addEventListener("hashchange", () => push("nav", window.location.hash));
  window.addEventListener("online", () => push("net", "conexión recuperada"));
  window.addEventListener("offline", () => push("net", "sin conexión"));

  /* Rastro de clics: qué elemento tocó el usuario (texto + rol), para reconstruir
     los pasos exactos que llevaron al fallo. Sin datos sensibles (solo etiquetas). */
  const describeEl = (el) => {
    if (!el || !el.tagName) return "?";
    const tag = el.tagName.toLowerCase();
    const label = (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "";
    let txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const role = (el.getAttribute && el.getAttribute("role")) || "";
    let desc = tag;
    if (role) desc += "[" + role + "]";
    if (label) desc += " “" + label.slice(0, 40) + "”";
    else if (txt) desc += " “" + txt + "”";
    return desc;
  };
  document.addEventListener("click", (e) => {
    const target = e.target && e.target.closest ? (e.target.closest("button, a, [role], input, select, label, textarea") || e.target) : e.target;
    push("click", describeEl(target));
  }, true);

  push("boot", "app iniciada · " + window.location.href);

  /* ---- armado del reporte ---- */
  function safeParse(key, fb) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fb; } catch { return fb; } }

  /* Radiografía del estado de la app al momento del fallo: ayuda a saber si el
     bug depende de tener datos, qué periodo/rol estaba activo, cuánto hay cargado. */
  function snapshotState() {
    const s = {};
    try {
      const sess = safeParse("session:v1", null);
      const members = safeParse("members:v1", []) || [];
      const m = sess && members.find((x) => x.id === sess.memberId);
      s.session = sess ? { logged: true, memberId: sess.memberId } : { logged: false };
      s.effectiveRole = m ? (m.accessRole || "viewer") : (localStorage.getItem("current-role:v1") || "viewer");
      s.memberCount = members.length;
      s.theme = localStorage.getItem("app-theme") || "auto";

      // Conteos por dominio recorriendo las claves de localStorage (sin volcar datos).
      let campaignKeys = 0, opChecklists = 0, briefSnaps = 0, designReqs = 0, generalPend = 0, bugReports = 0, configured = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("operative-checklist:")) opChecklists++;
        else if (k.startsWith("brief:")) briefSnaps++;
        else if (k.startsWith("dr:")) designReqs++;
        else if (k.startsWith("gp:")) generalPend++;
        else if (k.startsWith("bugreport:")) bugReports++;
        else if (k.startsWith("campaign-config:")) configured++;
      }
      s.counts = { opChecklists, briefSnaps, designRequests: designReqs, generalPendings: generalPend, bugReports, configuredCampaignPeriods: configured };

      // Periodos disponibles y periodo actual.
      s.currentPeriod = localStorage.getItem("current-period:v1") || null;
      s.availablePeriods = safeParse("campaign-periods:v1", null);
      s.customCampaigns = (safeParse("custom-campaigns:v1", []) || []).length;

      // Uso de almacenamiento (cuánto pesa el estado local).
      let bytes = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bytes += (k || "").length + (localStorage.getItem(k) || "").length; }
      s.localStorageKB = Math.round(bytes / 1024);
      s.localStorageKeys = localStorage.length;
    } catch (e) { s.error = String(e); }
    return s;
  }

  /* Métricas del dispositivo / entorno para reproducir el contexto. */
  function deviceInfo() {
    const d = {};
    try {
      d.viewport = window.innerWidth + "x" + window.innerHeight;
      d.screen = (window.screen ? window.screen.width + "x" + window.screen.height : "?");
      d.dpr = window.devicePixelRatio || 1;
      d.language = navigator.language || "";
      d.languages = (navigator.languages || []).slice(0, 3).join(",");
      try { d.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
      d.timezoneOffsetMin = new Date().getTimezoneOffset();
      d.platform = navigator.platform || "";
      d.touch = (navigator.maxTouchPoints || 0) > 0;
      d.deviceMemoryGB = navigator.deviceMemory || null;
      d.cpuCores = navigator.hardwareConcurrency || null;
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) d.connection = { type: c.effectiveType, downlinkMbps: c.downlink, rttMs: c.rtt, saveData: !!c.saveData };
      d.prefersDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      d.darkApplied = document.documentElement.classList.contains("dark");
      if (performance && performance.memory) d.jsHeapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      // Tiempo desde que cargó la página (cuánto llevaba abierta antes del reporte).
      if (performance && performance.now) d.sessionUptimeSec = Math.round(performance.now() / 1000);
    } catch (e) { d.error = String(e); }
    return d;
  }

  /* Resumen legible del buffer: cuántos de cada tipo + ruta de pantallas visitadas. */
  function summarizeLogs(buf) {
    const byKind = {};
    const navPath = [];
    let firstError = null, lastError = null, errorCount = 0;
    buf.forEach((e) => {
      byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      if (e.kind === "nav" || e.kind === "boot") { const h = (e.msg.match(/#[^ ]*/) || [])[0] || e.msg; if (navPath[navPath.length - 1] !== h) navPath.push(h); }
      if (e.kind === "error" || e.kind === "rejection" || e.kind === "console.error") {
        errorCount++;
        if (!firstError) firstError = { kind: e.kind, msg: e.msg, at: e.t };
        lastError = { kind: e.kind, msg: e.msg, at: e.t };
      }
    });
    return { totalEvents: buf.length, byKind, errorCount, firstError, lastError, navPath: navPath.slice(-15) };
  }

  function buildReport(comment) {
    let member = null;
    try {
      const sess = JSON.parse(localStorage.getItem("session:v1") || "null");
      const members = JSON.parse(localStorage.getItem("members:v1") || "[]");
      const m = sess && members.find((x) => x.id === sess.memberId);
      member = m ? { name: m.name, role: m.accessRole, cargo: m.cargo || "" } : null;
    } catch {}
    const shortId = "BUG-" + Math.random().toString(16).slice(2, 6).toUpperCase();
    const logs = buffer.slice();
    return {
      app: "campanas-workspace", reportVersion: 3,
      id: shortId, status: "open",   // open | resolved
      createdAt: new Date().toISOString(),
      comment: (comment || "").slice(0, 2000),
      context: {
        build: window.APP_BUILD || "desarrollo",
        url: window.location.href,
        hash: window.location.hash,
        route: (window.location.hash || "").replace(/^#/, "") || "/",
        userAgent: navigator.userAgent,
        screen: window.innerWidth + "x" + window.innerHeight,
        online: navigator.onLine,
        remoteSync: !!(window.RemoteSync && window.RemoteSync.enabled),
        member,
      },
      device: deviceInfo(),
      appState: snapshotState(),
      logSummary: summarizeLogs(logs),
      logs,
    };
  }

  /* ---- modal (DOM puro) ---- */
  function ReportBug() {
    if (document.getElementById("bug-modal")) return;
    const wrap = document.createElement("div");
    wrap.id = "bug-modal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(10,14,22,.5);backdrop-filter:blur(3px);padding:16px;font-family:Inter,system-ui,sans-serif";
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bg = dark ? "#141a26" : "#ffffff", fg = dark ? "#e6e9f0" : "#16202e", mut = dark ? "#8b93a5" : "#6b7280", bd = dark ? "#2a3242" : "#e5e7eb";
    wrap.innerHTML =
      '<div style="width:100%;max-width:400px;background:' + bg + ";color:" + fg + ';border:1px solid ' + (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)") + ';border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.30)">' +
      '<div style="height:3px;background:linear-gradient(90deg,#34c3ff,#7dd87d,#ffb340,#ff6482)"></div>' +
      '<div style="padding:22px 22px 18px;text-align:center">' +
      '<div style="font-size:30px;line-height:1;margin-bottom:8px">🛠️</div>' +
      '<div style="font-weight:700;font-size:17px;letter-spacing:-.02em">Reportar un fallo</div>' +
      '<div style="font-size:12px;color:' + mut + ';margin-top:3px">Cuéntalo en una línea. El diagnóstico va solo.</div>' +
      '<textarea id="bug-text" rows="3" placeholder="¿Qué pasó?" autofocus style="margin-top:14px;width:100%;box-sizing:border-box;resize:none;border:1px solid ' + bd + ';border-radius:14px;background:' + (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)") + ';color:' + fg + ';padding:11px 13px;font-size:13.5px;font-family:inherit;outline:none"></textarea>' +
      '<button id="bug-send" style="margin-top:12px;width:100%;border:none;background:' + fg + ';color:' + bg + ';border-radius:99px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer">Enviar reporte</button>' +
      '<button id="bug-cancel" style="margin-top:8px;border:none;background:transparent;color:' + mut + ';font-size:12.5px;font-weight:500;cursor:pointer;padding:4px 8px">Cancelar</button>' +
      '<button id="bug-x" style="display:none"></button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector("#bug-x").onclick = close;
    wrap.querySelector("#bug-cancel").onclick = close;
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector("#bug-send").onclick = () => {
      const comment = wrap.querySelector("#bug-text").value;
      const report = buildReport(comment);
      // 1) Copia a la nube para el admin (clave bugreport:<ts>, sincronizada)
      try {
        const key = "bugreport:" + new Date().toISOString().replace(/[:.]/g, "-");
        const json = JSON.stringify(report);
        if (json.length < 150000) localStorage.setItem(key, json);
        window.dispatchEvent(new CustomEvent("bugreports-change"));
      } catch {}
      const btn = wrap.querySelector("#bug-send");
      btn.textContent = "\u2713 Guardado en Reporte de fallos";
      btn.style.background = "#1D9E75";
      setTimeout(close, 1100);
    };
    setTimeout(() => wrap.querySelector("#bug-text").focus(), 50);
  }

  window.ReportBug = ReportBug;
  window.__bugBuffer = buffer;
  window.__buildBugReport = buildReport;

  /* ---- acceso de emergencia SIEMPRE disponible ----
     El botón del menú de usuario queda inaccesible si hay un modal encima.
     Por eso añadimos: (1) un atajo de teclado global y (2) un botón flotante
     discreto que vive sobre TODO (z-index máximo), de modo que siempre se
     pueda reportar aunque la interfaz esté tapada o trabada. */
  window.addEventListener("keydown", (e) => {
    // Ctrl+Shift+B / Cmd+Shift+B → reportar un error desde cualquier lugar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      ReportBug();
    }
  });

  function mountFloatingButton() {
    if (document.getElementById("bug-fab")) return;
    const b = document.createElement("button");
    b.id = "bug-fab";
    b.type = "button";
    b.title = "Reportar un error (Ctrl/Cmd + Shift + B)";
    b.setAttribute("aria-label", "Reportar un error");
    b.textContent = "🐞";
    b.style.cssText =
      "position:fixed;right:14px;bottom:14px;z-index:2147483646;width:40px;height:40px;border:none;border-radius:999px;" +
      "background:rgba(34,81,255,.92);color:#fff;font-size:18px;line-height:40px;text-align:center;cursor:pointer;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.28);opacity:.45;transition:opacity .15s,transform .15s;padding:0";
    b.onmouseenter = () => { b.style.opacity = "1"; b.style.transform = "scale(1.08)"; };
    b.onmouseleave = () => { b.style.opacity = ".45"; b.style.transform = "scale(1)"; };
    b.onclick = () => ReportBug();
    document.body.appendChild(b);
  }
  if (document.body) mountFloatingButton();
  else window.addEventListener("DOMContentLoaded", mountFloatingButton);

  /* ---- rescate de pantalla en blanco (vigilante paciente) ----
     Muestra el aviso SOLO si el contenido lleva un buen rato sin montar
     y no hay login en pantalla. Mientras el login de RemoteSync esté
     visible (la persona escribiendo) o justo después (descarga de datos),
     el contador se reinicia. Y si la app termina de montar, el aviso se
     quita solo. Así no hay falsas alarmas durante un login lento. */
  let fatal = false;
  window.addEventListener("error", () => { fatal = true; });

  function showRescue() {
    if (document.getElementById("boot-rescue")) return;
    const d = document.createElement("div");
    d.id = "boot-rescue";
    d.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#f7f8fb;font-family:Inter,system-ui,sans-serif;padding:20px";
    d.innerHTML =
      '<div style="max-width:420px;text-align:center">' +
      '<div style="font-size:40px;margin-bottom:10px">🛠️</div>' +
      '<div style="font-weight:800;font-size:18px;color:#16202e;margin-bottom:6px">La aplicación no pudo iniciar</div>' +
      '<div style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:16px">Algo falló al cargar. Prueba recargar con <b>Ctrl+Shift+R</b>. Si sigue pasando, descarga el reporte de diagnóstico y envíaselo al administrador (o pégalo en el chat con Claude).</div>' +
      '<button id="boot-rescue-btn" style="border:none;background:#2251FF;color:#fff;border-radius:99px;padding:11px 20px;font-size:13px;font-weight:700;cursor:pointer">Descargar reporte de error</button>' +
      "</div>";
    document.body.appendChild(d);
    document.getElementById("boot-rescue-btn").onclick = () => ReportBug();
  }
  function hideRescue() {
    const d = document.getElementById("boot-rescue");
    if (d) d.remove();
  }

  window.addEventListener("DOMContentLoaded", () => {
    let emptyFor = 0;            // segundos seguidos sin contenido ni login
    const LIMIT_OK = 14;         // sin errores: esperar bastante (login+descarga lentos)
    const LIMIT_FATAL = 6;       // con error fatal registrado: avisar antes
    const timer = setInterval(() => {
      const root = document.getElementById("root");
      const mounted = root && root.children.length > 0;
      const loginVisible = !!document.getElementById("rs-login");
      if (mounted) { hideRescue(); clearInterval(timer); return; }   // la app montó: fin
      if (loginVisible) { emptyFor = 0; return; }                    // persona logueándose: paciencia
      emptyFor += 2;
      if (emptyFor >= (fatal ? LIMIT_FATAL : LIMIT_OK)) showRescue();
    }, 2000);
    // tope de vigilancia: 3 minutos
    setTimeout(() => clearInterval(timer), 180000);
  });
})();
