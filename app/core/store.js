/* =====================================================================
   Store: localStorage-backed state with cross-component sync events.
   Ported from campaignPeriod.ts / operativeChecklist.ts / generalPendings.ts
   / BriefContext.tsx. Plain JS using the global React (no JSX here).
   ===================================================================== */
(function () {
  const R = window.React;
  const { useCallback, useEffect, useState, useSyncExternalStore, useMemo, useRef } = R;
  const TEMPLATES = window.CHECKLIST_TEMPLATES || {};

  /* ---------------- Campaign master list ---------------- */
  /* Catálogo demo SOLO para modo local/prototipo. En producción el
     catálogo vive 100% en la base de datos (custom-campaigns:v1): si la
     BD empieza de cero, no hay ninguna campaña hasta que el equipo las cree. */
  const PROD = !!(window.RemoteSync && window.RemoteSync.enabled) || !!(window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL);
  const demoCampaigns = [
    { slug: "bienvenida", title: "Bienvenida", description: "Onboarding de nuevos ingresos al ciclo académico.", icon: "HandHeart", accent: "brand" },
    { slug: "reinscritos", title: "Reinscritos", description: "Continuidad de alumnos que renuevan su matrícula.", icon: "RefreshCw", accent: "violet" },
    { slug: "reincorporados", title: "Reincorporados", description: "Regreso de alumnos tras una pausa académica.", icon: "Undo2", accent: "green" },
    { slug: "recupero", title: "Recupero", description: "Recuperación de alumnos en riesgo de deserción.", icon: "LifeBuoy", accent: "pink" },
    { slug: "inasistencia", title: "Inasistencia", description: "Seguimiento y reactivación por baja asistencia.", icon: "CalendarX", accent: "amber" },
    { slug: "tricas-cuatricas", title: "Tricas y Cuatricas", description: "Comunicación de periodos trimestrales y cuatrimestrales.", icon: "Layers3", accent: "brand" },
    { slug: "rol-examenes", title: "Rol de exámenes y rezagados", description: "Calendarios oficiales y procesos para rezagados.", icon: "ClipboardList", accent: "violet" },
    { slug: "talleres-tutorias", title: "Talleres y tutorías", description: "Oferta de acompañamiento académico y talleres.", icon: "GraduationCap", accent: "green" },
    { slug: "aulas-libres", title: "Aulas libres de arquitectura", description: "Disponibilidad de espacios para trabajo libre.", icon: "DoorOpen", accent: "pink" },
    { slug: "lab-mac", title: "Lab Mac", description: "Reservas y novedades del laboratorio Mac.", icon: "Monitor", accent: "brand" },
    { slug: "cursos-flexibles", title: "Cursos flexibles", description: "Oferta de cursos con modalidad y horarios flexibles.", icon: "BookOpen", accent: "amber" },
    { slug: "ivu", title: "IVU", description: "Información, vinculación y actualización universitaria.", icon: "Compass", accent: "violet" },
  ];
  const builtinCampaigns = PROD ? [] : demoCampaigns;
  const campaigns = builtinCampaigns.slice();

  /* ---------------- Keys + events ---------------- */
  const DEFAULT_PERIODS = ["2026-1", "2026-2", "2026-3"];
  const CURRENT_PERIOD_KEY = "current-period:v1";
  const PERIODS_KEY = "campaign-periods:v1";
  const CONFIG_KEY = (slug, p) => `campaign-config:${slug}:${p}`;
  const META_KEY = (slug, p) => `campaign-meta:${slug}:${p}`;
  const LINKS_KEY = (slug, p) => `campaign-links:${slug}:${p}`;
  const BRIEF_KEY = (slug, p) => `brief:${slug}:${p}`;
  const CHECK_KEY = (slug, p) => `operative-checklist:${slug}:${p}`;
  const GP_KEY = "general-pendings:v1";

  const EVT = "campaign-config-change";
  const CHECK_EVT = "operative-checklist-change";
  const GP_EVT = "general-pendings-change";

  const emit = () => window.dispatchEvent(new CustomEvent(EVT));
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const parse = (raw, fb) => { try { return raw ? JSON.parse(raw) : fb; } catch { return fb; } };

  /* ---------------- Custom campaigns (master, persistent) ----------------
     Three layers of persistence drive the master list:
       - custom-campaigns: user-created campaigns (full objects)
       - campaign-overrides: per-slug edits applied on top of any campaign
       - removed-campaigns: built-in slugs the user has hidden
     `campaigns` is a single live array (spliced in place) so existing
     references (S.campaigns) stay valid across edits. */
  const CUSTOM_CAMPAIGNS_KEY = "custom-campaigns:v1";
  const CAMPAIGN_OVERRIDES_KEY = "campaign-overrides:v1";
  const REMOVED_CAMPAIGNS_KEY = "removed-campaigns:v1";
  const CAMPAIGNS_EVT = "campaigns-change";
  let campaignsVersion = 0;

  function readCustomCampaigns() { const v = parse(ls.get(CUSTOM_CAMPAIGNS_KEY), []); return Array.isArray(v) ? v : []; }
  function readOverrides() { const v = parse(ls.get(CAMPAIGN_OVERRIDES_KEY), {}); return v && typeof v === "object" ? v : {}; }
  function readRemoved() { const v = parse(ls.get(REMOVED_CAMPAIGNS_KEY), []); return Array.isArray(v) ? v : []; }

  // Recompute the live `campaigns` array in place from all persistence layers.
  function rebuildCampaigns() {
    const removed = new Set(readRemoved());
    const overrides = readOverrides();
    const next = [...builtinCampaigns, ...readCustomCampaigns()]
      .filter((c) => c && c.slug && !removed.has(c.slug))
      .map((c) => (overrides[c.slug] ? { ...c, ...overrides[c.slug] } : c));
    campaigns.splice(0, campaigns.length, ...next);
  }
  rebuildCampaigns();

  function notifyCampaigns() {
    campaignsVersion++;
    window.dispatchEvent(new CustomEvent(CAMPAIGNS_EVT));
    emit();
  }
  function subscribeCampaigns(cb) {
    const h = () => { rebuildCampaigns(); cb(); };
    window.addEventListener(CAMPAIGNS_EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(CAMPAIGNS_EVT, h); window.removeEventListener("storage", h); };
  }
  function useCampaigns() {
    useSyncExternalStore(subscribeCampaigns, () => campaignsVersion, () => campaignsVersion);
    return campaigns;
  }
  function createCampaign({ title, description, icon, accent }) {
    const base = slugify(title) || "campana";
    const taken = new Set([...builtinCampaigns, ...readCustomCampaigns()].map((c) => c.slug));
    let slug = base, i = 2;
    while (taken.has(slug)) slug = `${base}-${i++}`;
    const c = { slug, title: title.trim(), description: (description || "").trim(), icon: icon || "Megaphone", accent: accent || "brand", custom: true };
    const custom = readCustomCampaigns(); custom.push(c);
    ls.set(CUSTOM_CAMPAIGNS_KEY, JSON.stringify(custom));
    rebuildCampaigns();
    notifyCampaigns();
    return slug;
  }
  // Edit any campaign (built-in or custom). Built-ins persist as overrides.
  function updateCampaign(slug, patch) {
    const clean = {};
    ["title", "description", "icon", "accent"].forEach((k) => {
      if (patch[k] !== undefined) clean[k] = typeof patch[k] === "string" ? patch[k].trim() : patch[k];
    });
    const custom = readCustomCampaigns();
    const idx = custom.findIndex((c) => c.slug === slug);
    if (idx >= 0) {
      custom[idx] = { ...custom[idx], ...clean };
      ls.set(CUSTOM_CAMPAIGNS_KEY, JSON.stringify(custom));
    } else {
      const ov = readOverrides();
      ov[slug] = { ...(ov[slug] || {}), ...clean };
      ls.set(CAMPAIGN_OVERRIDES_KEY, JSON.stringify(ov));
    }
    rebuildCampaigns();
    notifyCampaigns();
  }
  // Remove any campaign. Custom ones are deleted; built-ins are hidden.
  function removeCampaign(slug) {
    const custom = readCustomCampaigns();
    if (custom.some((c) => c.slug === slug)) {
      ls.set(CUSTOM_CAMPAIGNS_KEY, JSON.stringify(custom.filter((c) => c.slug !== slug)));
    } else {
      const removed = readRemoved();
      if (!removed.includes(slug)) { removed.push(slug); ls.set(REMOVED_CAMPAIGNS_KEY, JSON.stringify(removed)); }
    }
    const ov = readOverrides();
    if (ov[slug]) { delete ov[slug]; ls.set(CAMPAIGN_OVERRIDES_KEY, JSON.stringify(ov)); }
    // Limpiar datos por periodo para no dejar huérfanos (config, tareas, brief,
    // links, versiones, resumen, meta) en todos los periodos disponibles.
    try {
      readAvailable().forEach((p) => {
        ls.del(CONFIG_KEY(slug, p)); ls.del(CHECK_KEY(slug, p)); ls.del(BRIEF_KEY(slug, p));
        ls.del(LINKS_KEY(slug, p)); ls.del(META_KEY(slug, p));
        ls.del(`brief-summary:${slug}:${p}`); ls.del(`brief-versions:${slug}:${p}`);
      });
    } catch (e) {}
    rebuildCampaigns();
    notifyCampaigns();
    emit();
  }

  /* ---------------- Period formatting ---------------- */
  const formatPeriodLabel = (p) => { const [y, n] = String(p).split("-"); return y && n ? `${y}-${n}` : p; };
  const formatPeriodShort = (p) => { const [y, n] = String(p).split("-"); return y && n ? `${y}-${n}` : p; };

  /* ---------------- Available + current period ---------------- */
  const REMOVED_PERIODS_KEY = "campaign-periods-removed:v1";
  function readRemovedPeriods() { const v = parse(ls.get(REMOVED_PERIODS_KEY), []); return Array.isArray(v) ? v : []; }
  function readAvailable() {
    const stored = parse(ls.get(PERIODS_KEY), []);
    const removed = new Set(readRemovedPeriods());
    const merged = Array.from(new Set([...DEFAULT_PERIODS, ...stored])).filter((p) => !removed.has(p));
    merged.sort();
    return merged.length ? merged : [DEFAULT_PERIODS[DEFAULT_PERIODS.length - 1]];
  }
  function writeAvailable(list) {
    ls.set(PERIODS_KEY, JSON.stringify(Array.from(new Set(list)).sort()));
  }
  function subscribe(cb) {
    const h = () => cb();
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }
  const useAvailablePeriods = () => useSyncExternalStore(subscribe, () => JSON.stringify(readAvailable()), () => JSON.stringify(DEFAULT_PERIODS));
  const listAvailablePeriods = () => readAvailable();
  function addPeriod(p) {
    // Si estaba marcado como eliminado, lo restaura.
    ls.set(REMOVED_PERIODS_KEY, JSON.stringify(readRemovedPeriods().filter((x) => x !== p)));
    writeAvailable([...readAvailable(), p]); emit();
  }
  /* Eliminar un periodo lo quita del selector global. Los datos guardados bajo
     ese periodo NO se borran (recuperables si se vuelve a agregar). */
  function removePeriod(p) {
    if (readAvailable().length <= 1) return false; // siempre queda al menos uno
    ls.set(REMOVED_PERIODS_KEY, JSON.stringify(Array.from(new Set([...readRemovedPeriods(), p]))));
    writeAvailable(readAvailable().filter((x) => x !== p));
    emit();
    return true;
  }

  /* ---------------- Periodo: filtro POR SECCIÓN (efímero, por pestaña) ----------------
     Elegir un periodo dentro de una sección solo afecta ESA sección y se descarta al
     salir de ella. No se persiste: dos pestañas pueden trabajar periodos distintos en
     simultáneo (p.ej. Inasistencia 2026-2 y Bienvenida 2026-3). El valor guardado en
     CURRENT_PERIOD_KEY queda como periodo por defecto del workspace. */
  const sectionOfPath = (path) => {
    const segs = String(path || "/").split("/").filter(Boolean);
    if (!segs.length) return "inicio";
    return segs.slice(0, 2).join("/");
  };
  const currentSection = () => sectionOfPath((window.location.hash.replace(/^#/, "").split("?")[0]) || "/");
  let sectionPeriod = null; // { section, period } — solo en memoria de esta pestaña
  window.addEventListener("hashchange", () => {
    if (sectionPeriod && sectionPeriod.section !== currentSection()) { sectionPeriod = null; emit(); }
  });
  const defaultPeriod = () => ls.get(CURRENT_PERIOD_KEY) || DEFAULT_PERIODS[0];
  function writeCurrentPeriod(p) { sectionPeriod = { section: currentSection(), period: p }; emit(); }
  function readEffectivePeriod() {
    const ov = sectionPeriod && sectionPeriod.section === currentSection() ? sectionPeriod.period : null;
    return ov || defaultPeriod();
  }
  function useCurrentPeriod() {
    const value = useSyncExternalStore(subscribe, readEffectivePeriod, () => DEFAULT_PERIODS[0]);
    const available = readAvailable();
    const resolved = available.includes(value) ? value : DEFAULT_PERIODS[0];
    return [resolved, writeCurrentPeriod];
  }
  /* ¿Hay un filtro de periodo activo en esta sección (distinto del por defecto)? */
  function useSectionPeriodActive() {
    useSyncExternalStore(subscribe, () => (sectionPeriod ? `${sectionPeriod.section}:${sectionPeriod.period}` : "") + "|" + (ls.get(CURRENT_PERIOD_KEY) || ""), () => "");
    return !!(sectionPeriod && sectionPeriod.section === currentSection() && sectionPeriod.period !== defaultPeriod());
  }

  /* ---------------- Selección multi-periodo por sección ----------------
     value: "all" | "current" | string[] — solo en memoria; se limpia al salir de la sección. */
  let sectionPeriodsSel = null; // { section, value }
  window.addEventListener("hashchange", () => {
    if (sectionPeriodsSel && sectionPeriodsSel.section !== currentSection()) { sectionPeriodsSel = null; emit(); }
  });
  function writeSelectedPeriods(v) { sectionPeriodsSel = { section: currentSection(), value: v }; emit(); }
  function useSelectedPeriods(def = "all") {
    useSyncExternalStore(subscribe, () => JSON.stringify(sectionPeriodsSel) + "|" + (ls.get(CURRENT_PERIOD_KEY) || "") + "|" + readAvailable().join(","), () => "");
    const available = readAvailable();
    const value = sectionPeriodsSel && sectionPeriodsSel.section === currentSection() ? sectionPeriodsSel.value : def;
    let resolved;
    if (value === "all") resolved = available.slice();
    else if (value === "current") resolved = available.includes(readEffectivePeriod()) ? [readEffectivePeriod()] : available.slice(-1);
    else resolved = value.filter((p) => available.includes(p));
    if (!resolved.length) resolved = available.slice();
    return { value, periods: resolved, set: writeSelectedPeriods, isFiltered: value !== def };
  }

  /* ---------------- Per-campaign / per-period configuration ---------------- */
  const isCampaignConfigured = (slug, p) => ls.get(CONFIG_KEY(slug, p)) === "1";
  function markCampaignConfigured(slug, p) { ls.set(CONFIG_KEY(slug, p), "1"); touchCampaign(slug, p); emit(); }
  function unmarkCampaignConfigured(slug, p) {
    ls.del(CONFIG_KEY(slug, p)); ls.del(CHECK_KEY(slug, p)); ls.del(LINKS_KEY(slug, p)); ls.del(BRIEF_KEY(slug, p)); emit();
  }
  function getConfiguredPeriods(slug) { return readAvailable().filter((p) => ls.get(CONFIG_KEY(slug, p)) === "1"); }
  function getPreviousConfiguredPeriod(slug, before) {
    const configured = getConfiguredPeriods(slug);
    const all = readAvailable();
    const idx = all.indexOf(before);
    if (idx === -1) return null;
    for (let i = idx - 1; i >= 0; i--) if (configured.includes(all[i])) return all[i];
    const others = configured.filter((p) => p !== before).sort();
    return others.length ? others[others.length - 1] : null;
  }
  function duplicateCampaignConfig(slug, from, to) {
    const tasks = readOperativeTasks(slug, from);
    const cloned = tasks.map((t) => ({ ...t, id: `${slug}-${to}-${uuid()}`, status: "todo", done: false }));
    writeOperativeTasks(slug, to, cloned);
    const rawLinks = ls.get(LINKS_KEY(slug, from)); if (rawLinks) ls.set(LINKS_KEY(slug, to), rawLinks);
    const rawBrief = ls.get(BRIEF_KEY(slug, from)); if (rawBrief) ls.set(BRIEF_KEY(slug, to), rawBrief);
    markCampaignConfigured(slug, to);
  }
  function createBlankCampaignConfig(slug, p, meta) { writeOperativeTasks(slug, p, []); if (meta) writeConfigMeta(slug, p, meta); markCampaignConfigured(slug, p); }

  /* ---------------- Config meta (responsable, etc.) ---------------- */
  function readConfigMeta(slug, p) { return parse(ls.get(META_KEY(slug, p)), {}); }
  function writeConfigMeta(slug, p, meta) { ls.set(META_KEY(slug, p), JSON.stringify({ ...readConfigMeta(slug, p), ...meta, updatedAt: Date.now() })); emit(); }
  function useConfigMeta(slug, p) {
    useSyncExternalStore(subscribe, () => ls.get(META_KEY(slug, p)) || "", () => "");
    return readConfigMeta(slug, p);
  }
  // Stamp last-modified without otherwise changing meta (used by tasks/brief/comms writes).
  function touchCampaign(slug, p) {
    const m = readConfigMeta(slug, p);
    ls.set(META_KEY(slug, p), JSON.stringify({ ...m, updatedAt: Date.now() }));
  }

  /* ---------------- Approval status: draft → pending → approved ---------------- */
  function getCampaignStatus(slug, p) {
    if (!isCampaignConfigured(slug, p)) return "draft";
    return readConfigMeta(slug, p).approval === "approved" ? "approved" : "pending";
  }
  const STATUS_META = {
    draft: { key: "draft", label: "Sin habilitar", dot: "bg-muted-foreground/50", soft: "bg-muted text-muted-foreground" },
    pending: { key: "pending", label: "Pendiente aprobación", dot: "bg-accent-amber", soft: "bg-accent-amber/15 text-accent-amber" },
    approved: { key: "approved", label: "Aprobada", dot: "bg-accent-green", soft: "bg-accent-green/10 text-accent-green" },
  };
  function setApproval(slug, p, approved, user) {
    const m = readConfigMeta(slug, p);
    const next = { ...m, updatedAt: Date.now() };
    if (approved) { next.approval = "approved"; next.approvedAt = Date.now(); next.approvedBy = user || ""; }
    else { next.approval = "pending"; delete next.approvedAt; delete next.approvedBy; }
    ls.set(META_KEY(slug, p), JSON.stringify(next));
    emit();
  }
  function useCampaignStatus(slug, p) {
    useSyncExternalStore(subscribe, () => (isCampaignConfigured(slug, p) ? "1" : "0") + (ls.get(META_KEY(slug, p)) || ""), () => "0");
    return STATUS_META[getCampaignStatus(slug, p)];
  }

  /* Shift an ISO yyyy-mm-dd string by N days (returns "" for empty). */
  function shiftISO(iso, days) {
    if (!iso || !days) return iso || "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  /* Duplicate a config into a new period, optionally overriding before commit. */
  function duplicateConfigWithOverrides(slug, from, to, opts) {
    opts = opts || {};
    const off = Number(opts.dateOffsetDays) || 0;
    const tasks = readOperativeTasks(slug, from);
    const cloned = tasks.map((t) => ({
      ...t,
      id: `${slug}-${to}-${uuid()}`,
      deadline: t.deadline ? shiftISO(t.deadline, off) : t.deadline,
      owner: opts.reassignOwner ? opts.reassignOwner : t.owner,
      // Se copia toda la configuración pero NUNCA el estado de completado.
      status: "todo", done: false, doneAt: undefined, completedAt: undefined,
    }));
    writeOperativeTasks(slug, to, cloned);
    // Brief snapshot: shift parameter dates by offset.
    const snap = loadBriefSnapshot(slug, from);
    if (snap) {
      const shifted = {
        ...snap,
        params: (snap.params || []).map((p) => ({ ...p, date: shiftISO(p.date, off) })),
        comms: (snap.comms || []).map((c) => ({ ...c, status: "todo",
          start: c.start ? shiftISO(c.start, off) : c.start, end: c.end ? shiftISO(c.end, off) : c.end })),
        canva: opts.canva !== undefined ? opts.canva : snap.canva,
        dropbox: opts.dropbox !== undefined ? opts.dropbox : snap.dropbox,
      };
      ls.set(BRIEF_KEY(slug, to), JSON.stringify(shifted));
    }
    // Links
    const srcLinks = readCampaignLinks(slug, from);
    ls.set(LINKS_KEY(slug, to), JSON.stringify({
      canva: opts.canva !== undefined ? opts.canva : (srcLinks.canva || ""),
      dropbox: opts.dropbox !== undefined ? opts.dropbox : (srcLinks.dropbox || ""),
    }));
    if (opts.responsable !== undefined || opts.supervisor !== undefined) {
      const m = {};
      if (opts.responsable !== undefined) m.responsable = opts.responsable;
      if (opts.supervisor !== undefined) m.supervisor = opts.supervisor;
      writeConfigMeta(slug, to, m);
    }
    markCampaignConfigured(slug, to);
    // Fechas referenciadas a parámetros: recalcular contra el nuevo periodo.
    rematerializeComms(slug, to);
    rematerializeTaskDeadlines(slug, to);
  }

  function useConfigured(slug, p) {
    return useSyncExternalStore(subscribe, () => (isCampaignConfigured(slug, p) ? "1" : "0"), () => "0") === "1";
  }

  /* ---------------- Links ---------------- */
  function readCampaignLinks(slug, p) { return parse(ls.get(LINKS_KEY(slug, p)), {}); }
  function writeCampaignLinks(slug, p, links) { ls.set(LINKS_KEY(slug, p), JSON.stringify(links)); emit(); }
  function useCampaignLinks(slug, p) {
    useSyncExternalStore(subscribe, () => ls.get(LINKS_KEY(slug, p)) || "", () => "");
    return readCampaignLinks(slug, p);
  }

  /* ---------------- Sessions (login) ---------------- */
  const SESSION_KEY = "session:v1";
  const LOGIN_SETTINGS_KEY = "login-settings:v1";
  const SESSION_EVT = "session-change";

  function readSession() {
    const s = parse(ls.get(SESSION_KEY), null);
    if (!s || !s.memberId) return null;
    const m = (readMembers() || []).find((x) => x.id === s.memberId);
    if (!m || m.status !== "active") return null; // removed/deactivated member → invalid session
    return { ...s, name: m.name, role: m.accessRole, cargo: m.cargo };
  }
  function subscribeSession(cb) {
    const h = () => cb();
    window.addEventListener(SESSION_EVT, h);
    window.addEventListener(MEMBERS_EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(SESSION_EVT, h); window.removeEventListener(MEMBERS_EVT, h); window.removeEventListener("storage", h); };
  }
  function useSession() {
    useSyncExternalStore(subscribeSession, () => (ls.get(SESSION_KEY) || "") + "|" + (ls.get(MEMBERS_KEY) || ""), () => "");
    return readSession();
  }
  /* ---------------- Orígenes de puntos adicionales (categorías administrables) ---------------- */
  const PENDING_ORIGINS_KEY = "pending-origins:v1";
  const DEFAULT_PENDING_ORIGINS = ["Comité de retención", "Daily", "Gerencia", "Ad hoc"];
  function readPendingOrigins() {
    try { const raw = ls.get(PENDING_ORIGINS_KEY); const arr = raw ? JSON.parse(raw) : null; return Array.isArray(arr) && arr.length ? arr : DEFAULT_PENDING_ORIGINS.slice(); } catch { return DEFAULT_PENDING_ORIGINS.slice(); }
  }
  function writePendingOrigins(arr) {
    const clean = Array.from(new Set(arr.map((x) => String(x).trim()).filter(Boolean)));
    ls.set(PENDING_ORIGINS_KEY, JSON.stringify(clean)); emit();
  }
  function usePendingOrigins() {
    useSyncExternalStore(subscribe, () => ls.get(PENDING_ORIGINS_KEY) || "", () => "");
    return readPendingOrigins();
  }

  /* Verificación de clave de la sesión activa — para confirmar acciones destructivas. */
  function sessionClaveInfo() {
    try {
      const raw = ls.get(SESSION_KEY);
      const memberId = raw ? JSON.parse(raw).memberId : null;
      const m = memberId ? (readMembers() || []).find((x) => x.id === memberId) : null;
      if (!m) return { logged: false, hasClave: false, name: null };
      return { logged: true, hasClave: (m.clave || "") !== "", name: m.name };
    } catch { return { logged: false, hasClave: false, name: null }; }
  }
  function verifySessionClave(clave) {
    const info = sessionClaveInfo();
    if (!info.logged) return { ok: true, note: "no-session" };
    if (!info.hasClave) return { ok: true, note: "no-clave" };
    try {
      const raw = ls.get(SESSION_KEY);
      const memberId = JSON.parse(raw).memberId;
      const m = (readMembers() || []).find((x) => x.id === memberId);
      return (clave || "") === m.clave ? { ok: true } : { ok: false, error: "Clave incorrecta." };
    } catch { return { ok: false, error: "No se pudo verificar la clave." }; }
  }

  function login(memberId, clave) {
    const m = (readMembers() || []).find((x) => x.id === memberId);
    if (!m) return { ok: false, error: "Miembro no encontrado." };
    if (m.status !== "active") return { ok: false, error: "Este miembro está inactivo." };
    if ((m.clave || "") !== "" && (clave || "") !== m.clave) return { ok: false, error: "Clave incorrecta." };
    ls.set(SESSION_KEY, JSON.stringify({ memberId: m.id, ts: Date.now() }));
    // The session drives the active role.
    ls.set(CURRENT_ROLE_KEY, m.accessRole || "viewer");
    window.dispatchEvent(new CustomEvent(SESSION_EVT));
    window.dispatchEvent(new CustomEvent(ROLES_EVT));
    emit();
    return { ok: true };
  }
  function logout() {
    ls.del(SESSION_KEY);
    window.dispatchEvent(new CustomEvent(SESSION_EVT));
    window.dispatchEvent(new CustomEvent(ROLES_EVT));
    emit();
  }
  function defaultLoginSettings() {
    return { enabled: false, title: "Workspace de Campañas", subtitle: "Selecciona tu usuario para entrar al espacio de trabajo.", buttonLabel: "Entrar", showCargo: true };
  }
  function readLoginSettings() { return { ...defaultLoginSettings(), ...(parse(ls.get(LOGIN_SETTINGS_KEY), {}) || {}) }; }
  function writeLoginSettings(patch) {
    ls.set(LOGIN_SETTINGS_KEY, JSON.stringify({ ...readLoginSettings(), ...patch }));
    window.dispatchEvent(new CustomEvent(SESSION_EVT));
    emit();
  }
  function useLoginSettings() {
    useSyncExternalStore(subscribeSession, () => ls.get(LOGIN_SETTINGS_KEY) || "", () => "");
    return readLoginSettings();
  }

  /* ---------------- Current user (session first, then acting-as role) ---------------- */
  function currentUserName() {
    try {
      const sess = readSession();
      if (sess && sess.name) return sess.name;
      const rk = currentRoleKey();
      const mem = (readMembers() || []).filter((m) => m.status === "active" && m.accessRole === rk);
      if (mem[0] && mem[0].name) return mem[0].name;
      const roles = readRoles();
      return (roles[rk] && roles[rk].label) || "Sistema";
    } catch { return "Sistema"; }
  }

  /* ---------------- Reporte de fallos (bugreport:<ts>, compartido) ----------
     Los reportes que genera bugreport.js se acumulan aquí; el admin los
     descarga en bloque como un solo JSON listo para diagnosticar. */
  const BUGREPORT_PREFIX = "bugreport:";
  const BUGREPORTS_EVT = "bugreports-change";
  function readBugReports() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BUGREPORT_PREFIX)) {
        let v = parse(ls.get(k), null);
        if (v) { const id = ensureBugId(k, v); if (v.id !== id) v = { ...v, id }; out.push({ key: k, report: v }); }
      }
    }
    out.sort((a, b) => (a.report.createdAt < b.report.createdAt ? 1 : -1));
    return out;
  }
  function removeBugReport(key) { ls.del(key); window.dispatchEvent(new CustomEvent(BUGREPORTS_EVT)); }
  /* Reportes legados sin ID: se les asigna uno derivado de su clave para que
     siempre exista un identificador estable que marcar como resuelto. */
  function ensureBugId(key, report) {
    if (report && report.id) return report.id;
    const id = "BUG-" + (key || "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase().padStart(4, "0");
    try { ls.set(key, JSON.stringify({ ...report, id, status: report.status || "open" })); } catch {}
    return id;
  }
  function setBugStatus(id, status) {
    let changed = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(BUGREPORT_PREFIX)) continue;
      const v = parse(ls.get(k), null); if (!v) continue;
      const rid = ensureBugId(k, v);
      if (rid !== id) continue;
      // Si ya está en ese estado, NO se reescribe: se conserva intacto el
      // reporte (su createdAt original y su resolvedAt de la primera vez).
      if ((v.status || "open") === status && v.id === rid) continue;
      const next = { ...v, id: rid, status };
      // createdAt (fecha de solicitud) nunca se toca. resolvedAt se sella una
      // sola vez: al resolver por primera vez; reabrir lo limpia.
      if (status === "resolved") { if (!next.resolvedAt) next.resolvedAt = new Date().toISOString(); }
      else { delete next.resolvedAt; }
      ls.set(k, JSON.stringify(next));
      changed++;
    }
    if (changed) window.dispatchEvent(new CustomEvent(BUGREPORTS_EVT));
    return changed;
  }
  /* Aplica una lista de IDs resueltos (lo que devuelve Claude tras revisar el
     bloque). Acepta IDs sueltos o el objeto {resolved:[...]} de un archivo. */
  function applyResolvedBugs(input) {
    let ids = [];
    if (Array.isArray(input)) ids = input;
    else if (input && Array.isArray(input.resolved)) ids = input.resolved;
    else if (typeof input === "string") ids = input.match(/BUG-[A-Z0-9]{4}/gi) || [];
    ids = ids.map((s) => String(s).toUpperCase().trim()).filter(Boolean);
    let n = 0;
    ids.forEach((id) => { n += setBugStatus(id, "resolved") > 0 ? 1 : 0; });
    return { matched: n, requested: ids.length };
  }
  function clearBugReports() {
    readBugReports().forEach((r) => ls.del(r.key));
    window.dispatchEvent(new CustomEvent(BUGREPORTS_EVT));
  }
  /* ---- "Mientras no estabas": novedades de fallos resueltos por usuario ----
     Cada persona tiene una marca (changelog-seen:<usuario>) con el resolvedAt
     más reciente que ya vio. Al entrar, si hay resueltos posteriores, se le
     muestran una sola vez; luego la marca se actualiza. Es por-dispositivo/usuario. */
  function changelogSeenKey(user) { return "changelog-seen:" + (user || "anon").toLowerCase(); }
  function unseenResolvedBugs(user) {
    const name = (user || currentUserName() || "").trim();
    const seen = ls.get(changelogSeenKey(name)) || "";
    const out = readBugReports()
      .filter((r) => (r.report.status === "resolved") && r.report.resolvedAt && r.report.resolvedAt > seen)
      .sort((a, b) => (a.report.resolvedAt < b.report.resolvedAt ? 1 : -1));
    return out.map((r) => r.report);
  }
  function markChangelogSeen(user) {
    const name = (user || currentUserName() || "").trim();
    let max = ls.get(changelogSeenKey(name)) || "";
    readBugReports().forEach((r) => { if (r.report.status === "resolved" && r.report.resolvedAt && r.report.resolvedAt > max) max = r.report.resolvedAt; });
    if (max) ls.set(changelogSeenKey(name), max);
  }

  function useBugReports() {
    useSyncExternalStore(
      (cb) => { const h = () => cb(); window.addEventListener(BUGREPORTS_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(BUGREPORTS_EVT, h); window.removeEventListener("storage", h); }; },
      // El snapshot codifica id+estado de cada reporte: si uno pasa a resuelto,
      // la huella cambia y React vuelve a renderizar (BUG-4447).
      () => {
        const parts = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(BUGREPORT_PREFIX)) { const v = parse(ls.get(k), null); if (v) parts.push((v.id || k) + ":" + (v.status || "open")); } }
        return parts.sort().join("|");
      },
      () => ""
    );
    return readBugReports();
  }

  /* ---------------- Notificaciones (una clave por aviso: notif:<id>) ----------
     Avisos dirigidos a una persona (asignaciones, menciones, diseño).
     El estado de "leído" es por dispositivo (notif-read:v1, no sincroniza). */
  const NOTIF_PREFIX = "notif:";
  const NOTIF_EVT = "notifs-change";
  const NOTIF_READ_KEY = "notif-read:v1";
  function notify(p) {
    p = p || {};
    const to = (p.to || "").trim();
    if (!to) return;
    const n = {
      id: uuid(), ts: Date.now(), to,
      from: p.from || currentUserName() || "Sistema",
      type: p.type || "info", title: (p.title || "").slice(0, 140),
      detail: (p.detail || "").slice(0, 200), href: p.href || "",
    };
    if (n.from === to) return; // no auto-notificarse
    // Anti-duplicado (BUG-82DE): si el mismo aviso (destinatario+tipo+título+detalle)
    // ya se emitió en los últimos 8s, no se repite. Cubre los casos en que una
    // misma acción dispara notify desde dos rutas (p.ej. asignar un pendiente
    // desde el Centro pasa por checklist y por el store).
    const all = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(NOTIF_PREFIX)) { const v = parse(ls.get(k), null); if (v && v.ts) all.push(v); } }
    const dup = all.some((v) => v.to === n.to && v.type === n.type && v.title === n.title && v.detail === n.detail && (n.ts - v.ts) < 8000);
    if (dup) return;
    ls.set(NOTIF_PREFIX + n.id, JSON.stringify(n));
    // Poda global: conservar las 200 más recientes.
    if (all.length + 1 > 200) all.sort((a, b) => a.ts - b.ts).slice(0, all.length + 1 - 200).forEach((o) => ls.del(NOTIF_PREFIX + o.id));
    window.dispatchEvent(new CustomEvent(NOTIF_EVT));
  }
  function readNotifs(toName) {
    const me = (toName || "").trim().toLowerCase();
    if (!me) return [];
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NOTIF_PREFIX)) { const v = parse(ls.get(k), null); if (v && (v.to || "").trim().toLowerCase() === me) out.push(v); }
    }
    out.sort((a, b) => b.ts - a.ts);
    return out.slice(0, 60);
  }
  function readNotifSeen() { const v = parse(ls.get(NOTIF_READ_KEY), {}); return v && typeof v === "object" ? v : {}; }
  function markNotifsSeen(ids) {
    const seen = readNotifSeen(); const now = Date.now();
    (ids || []).forEach((id) => { seen[id] = now; });
    // poda del marcador local
    const keys = Object.keys(seen); if (keys.length > 400) keys.sort((a, b) => seen[a] - seen[b]).slice(0, keys.length - 400).forEach((k) => delete seen[k]);
    ls.set(NOTIF_READ_KEY, JSON.stringify(seen));
    window.dispatchEvent(new CustomEvent(NOTIF_EVT));
  }
  let notifVersion = 0;
  function useNotifs(toName) {
    useSyncExternalStore(
      (cb) => { const h = () => { notifVersion++; cb(); }; window.addEventListener(NOTIF_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(NOTIF_EVT, h); window.removeEventListener("storage", h); }; },
      () => notifVersion, () => 0
    );
    const seen = readNotifSeen();
    const items = readNotifs(toName).map((n) => ({ ...n, seen: !!seen[n.id] }));
    return { items, unread: items.filter((n) => !n.seen).length };
  }
  /* Menciones @Nombre dentro de un texto → notificación a cada mencionado. */
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function notifyMentions(text, ctx) {
    const t = norm(text || "");
    if (!t.includes("@")) return [];
    const hit = [];
    (readMembers() || []).filter((m) => m.status === "active" && (m.name || "").trim()).forEach((m) => {
      const full = norm(m.name), first = full.split(/\s+/)[0];
      if (t.includes("@" + full) || t.includes("@" + first) || (m.apodo && t.includes("@" + norm(m.apodo)))) hit.push(m.name);
    });
    Array.from(new Set(hit)).forEach((name) => notify({
      to: name, type: "mention",
      title: (ctx && ctx.title) || "Te mencionaron en un avance",
      detail: (text || "").slice(0, 160), href: (ctx && ctx.href) || "",
    }));
    return hit;
  }

  /* ---------------- Brief changelog — TRANSVERSAL por campaña ----------------
     El historial vive a nivel de campaña (todos los periodos juntos) y cada
     entrada registra para qué periodo se hizo la modificación. Las entradas
     legadas por-periodo se fusionan en lectura para no perder nada. */
  const CHANGELOG_KEY = (slug, p) => `brief-changelog:${slug}:${p}`;   // legado
  const CHANGELOG_ALL_KEY = (slug) => `brief-changelog:${slug}:all`;
  const CHANGELOG_EVT = "changelog-change";
  function readChangelog(slug) {
    const own = parse(ls.get(CHANGELOG_ALL_KEY(slug)), []);
    const all = Array.isArray(own) ? own.slice() : [];
    readAvailable().forEach((p) => {
      const v = parse(ls.get(CHANGELOG_KEY(slug, p)), []);
      if (Array.isArray(v)) v.forEach((e) => all.push({ ...e, period: e.period || p }));
    });
    all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return all.slice(0, 300);
  }
  function logChange(slug, p, entry) {
    if (!slug || !p) return;
    const own = parse(ls.get(CHANGELOG_ALL_KEY(slug)), []);
    const list = Array.isArray(own) ? own : [];
    const e = {
      id: uuid(), ts: Date.now(), user: entry.user || currentUserName(),
      kind: entry.kind || "edit", section: entry.section || "Brief", period: p,
      label: entry.label || "", before: entry.before ?? null, after: entry.after ?? null,
    };
    // Coalesce: skip if identical to the most recent change of same label within 2s.
    const last = list[0];
    if (last && last.label === e.label && last.section === e.section && String(last.after) === String(e.after) && e.ts - last.ts < 2000) return;
    const next = [e, ...list].slice(0, 300);
    ls.set(CHANGELOG_ALL_KEY(slug), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGELOG_EVT, { detail: { slug, period: p } }));
  }
  function clearChangelog(slug) {
    ls.del(CHANGELOG_ALL_KEY(slug));
    readAvailable().forEach((p) => ls.del(CHANGELOG_KEY(slug, p)));
    window.dispatchEvent(new CustomEvent(CHANGELOG_EVT, { detail: { slug } }));
  }
  function useChangelog(slug) {
    useSyncExternalStore(
      (cb) => { const h = () => cb(); window.addEventListener(CHANGELOG_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(CHANGELOG_EVT, h); window.removeEventListener("storage", h); }; },
      () => (ls.get(CHANGELOG_ALL_KEY(slug)) || "") + "|" + readAvailable().map((p) => ls.get(CHANGELOG_KEY(slug, p)) || "").join("|"), () => ""
    );
    return readChangelog(slug);
  }

  /* ---------------- Operative checklist ---------------- */
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const slugify = (s) => (s.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32) || "t");

  /* Plantillas editables: los ajustes del equipo viven en checklist-templates:v1
     (sincronizado) y prevalecen sobre la plantilla de fábrica de templates.js. */
  const TEMPLATE_OVERRIDES_KEY = "checklist-templates:v1";
  const TEMPLATES_EVT = "templates-change";
  function readTemplateOverrides() { const v = parse(ls.get(TEMPLATE_OVERRIDES_KEY), {}); return v && typeof v === "object" ? v : {}; }
  function effectiveTemplate(slug) {
    const ov = readTemplateOverrides();
    if (Array.isArray(ov[slug])) return ov[slug];
    return TEMPLATES[slug] || [];
  }
  function hasTemplateOverride(slug) { return Array.isArray(readTemplateOverrides()[slug]); }
  function writeTemplateOverride(slug, rows) {
    const ov = readTemplateOverrides();
    ov[slug] = (rows || []).map((r) => ({ title: (r.title || "").trim(), owner: (r.owner || "").trim(), month: (r.month || "").trim() })).filter((r) => r.title);
    ls.set(TEMPLATE_OVERRIDES_KEY, JSON.stringify(ov));
    window.dispatchEvent(new CustomEvent(TEMPLATES_EVT)); emit();
  }
  function resetTemplateOverride(slug) {
    const ov = readTemplateOverrides(); delete ov[slug];
    ls.set(TEMPLATE_OVERRIDES_KEY, JSON.stringify(ov));
    window.dispatchEvent(new CustomEvent(TEMPLATES_EVT)); emit();
  }
  let tplVersion = 0;
  function useTemplates() {
    useSyncExternalStore(
      (cb) => { const h = () => { tplVersion++; cb(); }; window.addEventListener(TEMPLATES_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(TEMPLATES_EVT, h); window.removeEventListener("storage", h); }; },
      () => tplVersion, () => 0
    );
    return { effective: effectiveTemplate, factory: (slug) => TEMPLATES[slug] || [], hasOverride: hasTemplateOverride };
  }
  function buildFromTemplate(slug, p) {
    const t = effectiveTemplate(slug);
    // ID único por tarea con uuid (NO el índice): así nunca colisiona entre
    // campañas ni periodos, ni al duplicar o regenerar la plantilla (BUG-2021).
    return t.map((x) => ({
      id: `${slug}-${p}-${uuid()}`,
      title: x.title, owner: x.owner, month: x.month,
      done: false, status: "todo", priority: "med",
    }));
  }
  /* Repara IDs duplicados en tareas ya guardadas: solo regenera cuando un ID se
     REPITE (colisión real). No toca IDs únicos aunque tengan formato viejo —
     hacerlo rompía la selección masiva porque el ID mutaba entre lecturas
     (regresión BUG-741A). Idempotente y estable. */
  function dedupeTaskIds(tasks, slug, p) {
    const seen = new Set();
    let changed = false;
    const out = (tasks || []).map((t) => {
      const id = t.id || "";
      if (!id || seen.has(id)) {
        changed = true;
        const nid = `${slug}-${p}-${uuid()}`;
        seen.add(nid);
        return { ...t, id: nid };
      }
      seen.add(id);
      return t;
    });
    return { tasks: out, changed };
  }
  function normalizeTasks(tasks) {
    return tasks.map((t) => ({ ...t, status: t.status ?? (t.done ? "done" : "todo"), priority: t.priority ?? "med" }));
  }
  function readOperativeTasks(slug, p) {
    const parsed = parse(ls.get(CHECK_KEY(slug, p)), null);
    if (!Array.isArray(parsed)) return [];
    // Auto-reparación de IDs duplicados/legados (BUG-2021): si detecta colisiones
    // o formato viejo, regenera y persiste una sola vez.
    const { tasks, changed } = dedupeTaskIds(parsed, slug, p);
    if (changed) { try { ls.set(CHECK_KEY(slug, p), JSON.stringify(tasks)); } catch (e) {} }
    return normalizeTasks(tasks);
  }
  function writeOperativeTasks(slug, p, tasks) {
    ls.set(CHECK_KEY(slug, p), JSON.stringify(tasks));
    touchCampaign(slug, p);
    window.dispatchEvent(new CustomEvent(CHECK_EVT, { detail: { slug, period: p } }));
  }
  function subscribeCheck(cb) {
    const h = () => cb();
    window.addEventListener(CHECK_EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(CHECK_EVT, h); window.removeEventListener("storage", h); };
  }

  function useOperativeChecklist(slug, p) {
    const [tasks, setTasks] = useState(() => readOperativeTasks(slug, p));
    useEffect(() => { setTasks(readOperativeTasks(slug, p)); }, [slug, p]);
    useEffect(() => {
      const handler = (e) => {
        const d = e.detail;
        if (!d || (d.slug === slug && d.period === p)) setTasks(readOperativeTasks(slug, p));
      };
      window.addEventListener(CHECK_EVT, handler);
      return () => window.removeEventListener(CHECK_EVT, handler);
    }, [slug, p]);

    const persist = useCallback((next) => { setTasks(next); writeOperativeTasks(slug, p, next); }, [slug, p]);
    const toggle = (id) => {
      const t = tasks.find((x) => x.id === id);
      if (t) logChange(slug, p, { kind: t.done ? "edit" : "done", section: "Checklist operativo", label: t.title || "Tarea", before: t.done ? "Completada" : "Pendiente", after: t.done ? "Pendiente" : "Completada" });
      persist(tasks.map((t) => t.id === id ? { ...t, done: !t.done, status: !t.done ? "done" : "todo" } : t));
    };
    const update = (id, patch) => {
      const prev = tasks.find((x) => x.id === id);
      if (prev) {
        if (patch.owner !== undefined && patch.owner !== prev.owner) logChange(slug, p, { kind: "edit", section: "Checklist operativo", label: `Responsable · ${prev.title || "Tarea"}`, before: prev.owner || "—", after: patch.owner || "—" });
        if (patch.status !== undefined && patch.status !== prev.status) logChange(slug, p, { kind: patch.status === "done" ? "done" : "edit", section: "Checklist operativo", label: `Estado · ${prev.title || "Tarea"}`, before: prev.status || "todo", after: patch.status });
      }
      persist(tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if (patch.status !== undefined) next.done = patch.status === "done";
        if (patch.done !== undefined) next.status = patch.done ? "done" : (next.status === "done" ? "todo" : (next.status ?? "todo"));
        return next;
      }));
    };
    const add = () => persist([...tasks, { id: `${slug}-${p}-${uuid()}`, title: "", owner: "", month: "", done: false, status: "todo", priority: "med", updates: [] }]);
    const remove = (id) => { const t = tasks.find((x) => x.id === id); if (t && t.title) logChange(slug, p, { kind: "remove", section: "Checklist operativo", label: "Tarea eliminada", after: t.title }); persist(tasks.filter((t) => t.id !== id)); };
    const reset = () => persist(buildFromTemplate(slug, p));
    // Task updates (operative log per task)
    const addUpdate = (id, upd) => {
      const t = tasks.find((x) => x.id === id);
      const entry = { id: uuid(), ts: Date.now(), type: upd.type || "comment", text: (upd.text || "").trim(), user: upd.user || currentUserName() };
      if (t) logChange(slug, p, { kind: upd.type === "block" ? "block" : "update", section: "Checklist operativo", label: `Update · ${t.title || "Tarea"}`, after: UPDATE_LABELS[entry.type] || "Comentario" });
      persist(tasks.map((x) => x.id === id ? { ...x, updates: [...(x.updates || []), entry] } : x));
    };
    const removeUpdate = (id, updId) => persist(tasks.map((x) => x.id === id ? { ...x, updates: (x.updates || []).filter((u) => u.id !== updId) } : x));
    const editUpdate = (id, updId, patch) => persist(tasks.map((x) => x.id === id ? { ...x, updates: (x.updates || []).map((u) => u.id === updId ? { ...u, ...patch, editedTs: Date.now() } : u) } : x));
    return { tasks, toggle, update, add, remove, reset, addUpdate, removeUpdate, editUpdate };
  }
  const UPDATE_LABELS = { progress: "Avance", block: "Bloqueo", risk: "Riesgo", change: "Cambio", done: "Completado", comment: "Comentario" };

  function useOperativeProgress(slug, p) {
    useSyncExternalStore(subscribeCheck, () => ls.get(CHECK_KEY(slug, p)) || "", () => "");
    const tasks = readOperativeTasks(slug, p);
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  /* ---------------- General pendings ---------------- */
  /* Una clave por pendiente (gp:<id>): dos personas editando pendientes
     DISTINTOS al mismo tiempo ya no se pisan entre sí. El formato legado
     (lista única) se migra automáticamente en la primera lectura. */
  const GP_PREFIX = "gp:";
  function gpMigrate() {
    const legacy = parse(ls.get(GP_KEY), null);
    if (Array.isArray(legacy)) {
      legacy.forEach((i) => { if (i && i.id) ls.set(GP_PREFIX + i.id, JSON.stringify(i)); });
      ls.del(GP_KEY);
    }
  }
  function readGeneralPendings() {
    gpMigrate();
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GP_PREFIX)) { const v = parse(ls.get(k), null); if (v && v.id) items.push(v); }
    }
    items.sort((a, b) => ((b.createdAt || "") > (a.createdAt || "") ? 1 : -1));
    return items;
  }
  function writeGeneralPendings(items) {
    gpMigrate();
    const ids = new Set((items || []).map((i) => i.id));
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GP_PREFIX) && !ids.has(k.slice(GP_PREFIX.length))) stale.push(k);
    }
    stale.forEach((k) => ls.del(k));
    (items || []).forEach((i) => {
      const k = GP_PREFIX + i.id, nv = JSON.stringify(i);
      if (ls.get(k) !== nv) ls.set(k, nv);
    });
    window.dispatchEvent(new CustomEvent(GP_EVT));
  }
  function writeGeneralPending(item) { ls.set(GP_PREFIX + item.id, JSON.stringify(item)); window.dispatchEvent(new CustomEvent(GP_EVT)); }
  function removeGeneralPending(id) { ls.del(GP_PREFIX + id); window.dispatchEvent(new CustomEvent(GP_EVT)); }
  function addGeneralPending(partial) {
    const item = { id: uuid(), title: "", owner: "", priority: "med", status: "todo", createdAt: new Date().toISOString(), createdBy: currentUserName() || "", ...(partial || {}) };
    writeGeneralPending(item); window.dispatchEvent(new CustomEvent(GP_EVT));
    return item.id;
  }
  function useGeneralPendings() {
    const [items, setItems] = useState([]);
    useEffect(() => {
      setItems(readGeneralPendings());
      const handler = () => setItems(readGeneralPendings());
      window.addEventListener(GP_EVT, handler);
      window.addEventListener("storage", handler);
      return () => { window.removeEventListener(GP_EVT, handler); window.removeEventListener("storage", handler); };
    }, []);
    const add = (partial) => {
      /* createdBy: trazabilidad de quién generó el pendiente (badge "Generado por mí") */
      const item = { id: uuid(), title: "", owner: "", priority: "med", status: "todo", createdAt: new Date().toISOString(), createdBy: currentUserName() || "", ...partial };
      writeGeneralPending(item);
      if (item.owner && item.title) notify({ to: item.owner, type: "task", title: "Te asignaron un pendiente", detail: item.title, href: "#/operativa/pendiente" });
      setItems(readGeneralPendings());
      return item.id;
    };
    const update = (id, patch) => {
      const cur = readGeneralPendings().find((i) => i.id === id);
      if (!cur) return;
      if (patch.owner && patch.owner !== cur.owner) notify({ to: patch.owner, type: "task", title: "Te asignaron un pendiente", detail: cur.title || "Pendiente", href: "#/operativa/pendiente" });
      writeGeneralPending({ ...cur, ...patch });
      setItems(readGeneralPendings());
    };
    const remove = (id) => { removeGeneralPending(id); setItems(readGeneralPendings()); };
    return { items, add, update, remove };
  }

  /* ---------------- Brief defaults ---------------- */
  const defaultParams = [
    { id: "teaser", label: "Inicio de teaser", date: "2026-02-22" },
    { id: "start", label: "Inicio de campaña", date: "2026-03-08" },
    { id: "peak", label: "Pico de campaña", date: "2026-03-15" },
    { id: "close", label: "Cierre de campaña", date: "2026-03-29" },
    { id: "postmortem", label: "Reporte post-mortem", date: "2026-04-05" },
  ];
  const defaultKeyDates = [
    { id: "k1", label: "Lanzamiento de piezas orgánicas", paramId: "teaser", offsetDays: 0, durationDays: 14 },
    { id: "k2", label: "Activación de pauta", paramId: "start", offsetDays: 0, durationDays: 21 },
    { id: "k3", label: "Envío de mailing principal", paramId: "peak", offsetDays: -2, durationDays: 3 },
    { id: "k4", label: "Recordatorio final", paramId: "close", offsetDays: -3, durationDays: 2 },
    { id: "k5", label: "Entrega de reporte", paramId: "postmortem", offsetDays: 0, durationDays: 1 },
  ];
  const BRIEF_STORAGE = (slug, p) => BRIEF_KEY(slug, p);
  function loadBriefSnapshot(slug, p) { return parse(ls.get(BRIEF_KEY(slug, p)), null); }
  /* ---------------- Global parameter dates (per period, configured once) ---------------- */
  const GLOBAL_PARAMS_KEY = (p) => `global-params:${p}`;
  function readGlobalParams(p) {
    const v = parse(ls.get(GLOBAL_PARAMS_KEY(p)), null);
    if (Array.isArray(v) && v.length) return v;
    /* Producción: un periodo sin configurar NO trae fechas precargadas;
       el equipo las define (o carga las base con "Restablecer"). El
       modo prototipo conserva las fechas demo para explorar. */
    return PROD ? [] : defaultParams.map((x) => ({ ...x }));
  }
  function hasGlobalParams(p) { const v = parse(ls.get(GLOBAL_PARAMS_KEY(p)), null); return Array.isArray(v) && v.length > 0; }
  function writeGlobalParams(p, arr) { ls.set(GLOBAL_PARAMS_KEY(p), JSON.stringify(arr || [])); emit(); }
  function useGlobalParams(p) {
    useSyncExternalStore(subscribe, () => ls.get(GLOBAL_PARAMS_KEY(p)) || "", () => "");
    return readGlobalParams(p);
  }
  function readComms(slug, p) {
    const snap = parse(ls.get(BRIEF_KEY(slug, p)), null);
    if (snap && Array.isArray(snap.comms) && snap.comms.length) return snap.comms;
    return (window.DEFAULT_COMMS || []);
  }

  /* ===== Estado de envío por ejecución (BUG-DF8E) =====
     Cada ejecución (comunicación × día × canal) se identifica por una clave
     estable. Guardamos el set de ejecutadas por (campaña, periodo). Esto permite
     marcar en el cronograma qué envíos ya se hicieron sin tocar la regla del brief. */
  const COMM_EXEC_KEY = (slug, p) => `comm-exec:${slug}:${p}`;
  const COMM_EXEC_EVT = "comm-exec-change";
  function readCommExecutions(slug, p) { const v = parse(ls.get(COMM_EXEC_KEY(slug, p)), null); return v && typeof v === "object" ? v : {}; }
  function isCommExecuted(slug, p, execId) { return !!readCommExecutions(slug, p)[execId]; }
  function setCommExecuted(slug, p, execId, done) {
    const m = readCommExecutions(slug, p);
    if (done) m[execId] = Date.now(); else delete m[execId];
    ls.set(COMM_EXEC_KEY(slug, p), JSON.stringify(m));
    window.dispatchEvent(new CustomEvent(COMM_EXEC_EVT, { detail: { slug, period: p } }));
    emit();
  }
  function useCommExecutions(slug, p) {
    useSyncExternalStore(
      (cb) => { const h = () => cb(); window.addEventListener(COMM_EXEC_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(COMM_EXEC_EVT, h); window.removeEventListener("storage", h); }; },
      () => ls.get(COMM_EXEC_KEY(slug, p)) || "", () => ""
    );
    return readCommExecutions(slug, p);
  }

  /* Parámetros activos del brief (custom del snapshot o globales del periodo). */
  function activeBriefParams(slug, p) {
    const snap = parse(ls.get(BRIEF_KEY(slug, p)), null) || {};
    if (snap.paramsMode === "custom" && Array.isArray(snap.params) && snap.params.length) return snap.params;
    return readGlobalParams(p) || [];
  }
  /* Resuelve una fecha referenciada a una fecha clave (param) + offset en días → ISO. */
  function resolveParamISO(slug, p, paramId, offsetDays) {
    if (!paramId) return "";
    const prm = activeBriefParams(slug, p).find((x) => x.id === paramId);
    if (!prm || !prm.date) return "";
    return shiftISO(prm.date, Number(offsetDays) || 0);
  }
  /* Re-calcula deadlines de tareas referenciadas a fechas clave. */
  function rematerializeTaskDeadlines(slug, p) {
    const tasks = readOperativeTasks(slug, p);
    let changed = false;
    const next = tasks.map((t) => {
      if (!t.deadlineParamId) return t;
      const iso = resolveParamISO(slug, p, t.deadlineParamId, t.deadlineOffset);
      if (iso && iso !== t.deadline) { changed = true; return { ...t, deadline: iso }; }
      return t;
    });
    if (changed) writeOperativeTasks(slug, p, next);
  }
  /* Re-calcula inicio/fin de comunicaciones referenciadas a fechas clave. */
  function rematerializeComms(slug, p) {
    const snap = parse(ls.get(BRIEF_KEY(slug, p)), null);
    if (!snap || !Array.isArray(snap.comms)) return;
    let changed = false;
    const comms = snap.comms.map((r) => {
      const n = { ...r };
      if (n.startParamId) { const iso = resolveParamISO(slug, p, n.startParamId, n.startOffset); if (iso && iso !== n.start) { n.start = iso; changed = true; } }
      if (n.endParamId) { const iso = resolveParamISO(slug, p, n.endParamId, n.endOffset); if (iso && iso !== n.end) { n.end = iso; changed = true; } }
      return n;
    });
    if (changed) { ls.set(BRIEF_KEY(slug, p), JSON.stringify({ ...snap, comms })); emit(); }
  }

  function saveBriefSnapshot(slug, p, snap) {
    ls.set(BRIEF_KEY(slug, p), JSON.stringify(snap));
    ls.set(LINKS_KEY(slug, p), JSON.stringify({ canva: snap.canva, dropbox: snap.dropbox }));
    touchCampaign(slug, p);
    pushBriefVersion(slug, p, snap);
    // Las fechas clave pudieron cambiar → recalcular deadlines referenciados.
    rematerializeTaskDeadlines(slug, p);
    emit();
  }

  /* ---------------- Brief versions (for "Comparar versión anterior") ---------------- */
  const VERSIONS_KEY = (slug, p) => `brief-versions:${slug}:${p}`;
  const VERSIONS_EVT = "brief-versions-change";
  function readBriefVersions(slug, p) { const v = parse(ls.get(VERSIONS_KEY(slug, p)), []); return Array.isArray(v) ? v : []; }
  function snapshotForVersion(slug, p, snap) {
    const meta = readConfigMeta(slug, p);
    const tasks = readOperativeTasks(slug, p);
    return {
      responsable: meta.responsable || "",
      params: (snap.params || []).map((x) => ({ label: x.label, date: x.date })),
      keyDates: (snap.keyDates || []).map((k) => ({ label: k.label, paramId: k.paramId, offsetDays: k.offsetDays, durationDays: k.durationDays })),
      canva: snap.canva || "", dropbox: snap.dropbox || "",
      taskCount: tasks.length, doneCount: tasks.filter((t) => t.done).length,
    };
  }
  function pushBriefVersion(slug, p, snap) {
    const list = readBriefVersions(slug, p);
    const state = snapshotForVersion(slug, p, snap);
    const last = list[0];
    // Skip if identical to last saved version.
    if (last && JSON.stringify(last.state) === JSON.stringify(state)) return;
    const entry = { id: uuid(), ts: Date.now(), user: currentUserName(), state };
    const next = [entry, ...list].slice(0, 20);
    ls.set(VERSIONS_KEY(slug, p), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(VERSIONS_EVT, { detail: { slug, period: p } }));
  }
  function useBriefVersions(slug, p) {
    useSyncExternalStore(
      (cb) => { const h = () => cb(); window.addEventListener(VERSIONS_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(VERSIONS_EVT, h); window.removeEventListener("storage", h); }; },
      () => ls.get(VERSIONS_KEY(slug, p)) || "", () => ""
    );
    return readBriefVersions(slug, p);
  }

  /* ====================================================================
     Members + RBAC (roles & permissions). Persisted decoupled from the
     rest of the app so it can later sync with a real backend.
     ==================================================================== */
  const MEMBERS_KEY = "members:v1";
  const MEMBERS_EVT = "members-change";
  const ROLES_KEY = "roles:v1";
  const CURRENT_ROLE_KEY = "current-role:v1";
  const ROLES_EVT = "roles-change";

  const PERMISSIONS = [
    { key: "createTasks", label: "Crear tareas", group: "Tareas" },
    { key: "editTasks", label: "Editar tareas", group: "Tareas" },
    { key: "approveTasks", label: "Aprobar tareas en revisión", group: "Tareas" },
    { key: "deleteTasks", label: "Eliminar tareas", group: "Tareas" },
    { key: "createCampaigns", label: "Crear campañas", group: "Campañas" },
    { key: "editCampaigns", label: "Editar campañas", group: "Campañas" },
    { key: "deleteCampaigns", label: "Eliminar campañas", group: "Campañas" },
    { key: "manageMembers", label: "Gestionar miembros", group: "Administración" },
    { key: "editRoles", label: "Editar roles y permisos", group: "Administración" },
    { key: "managePeriods", label: "Administrar periodos", group: "Administración" },
    { key: "viewReports", label: "Ver reportes y estados", group: "Acceso" },
    { key: "accessConfig", label: "Acceso a configuración", group: "Acceso" },
  ];
  const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

  function permSet(val) { const o = {}; PERMISSION_KEYS.forEach((k) => (o[k] = val)); return o; }

  /* ---------------- Módulos habilitables por rol (mínimo privilegio) ---------------- */
  const MODULE_DEFS = [
    { key: "brief", label: "Brief de campañas", icon: "Megaphone", group: "Campañas" },
    { key: "speech", label: "Speech", icon: "Mic", group: "Campañas" },
    { key: "argumentario", label: "Argumentario", icon: "Quote", group: "Campañas" },
    { key: "cronComms", label: "Cronograma de comms", icon: "Send", group: "Campañas" },
    { key: "cronCampanas", label: "Cronograma de campañas", icon: "CalendarRange", group: "Campañas" },
    { key: "pendiente", label: "Pendientes", icon: "ListChecks", group: "Operativa" },
    { key: "centro", label: "Centro de operaciones", icon: "Gauge", group: "Operativa" },
    { key: "solicitudes", label: "Solicitudes de diseño", icon: "Palette", group: "Operativa" },
    { key: "resumen", label: "Resumen ejecutivo", icon: "FileText", group: "Operativa" },
    { key: "equipo", label: "Equipo y permisos", icon: "Users", group: "Configuración" },
    { key: "fechas", label: "Fechas del periodo", icon: "CalendarCog", group: "Configuración" },
    { key: "ayuda", label: "Documentación", icon: "CircleHelp", group: "Configuración" },
  ];
  const moduleSet = (val) => { const o = {}; MODULE_DEFS.forEach((m) => (o[m.key] = val)); return o; };
  function defaultRoles() {
    return {
      admin: { key: "admin", label: "Administrador", desc: "Acceso total al sistema.", system: true, permissions: permSet(true) },
      editor: { key: "editor", label: "Editor", desc: "Acceso operativo con restricciones administrativas.", system: true,
        permissions: { ...permSet(false), createTasks: true, editTasks: true, createCampaigns: true, editCampaigns: true, viewReports: true } },
      disenador: { key: "disenador", label: "Diseñador", desc: "Atiende solicitudes de diseño y sus pendientes; ve campañas y reportes.", system: true, tone: "pink",
        permissions: { ...permSet(false), editTasks: true, viewReports: true },
        modules: { ...moduleSet(false), solicitudes: true, pendiente: true, centro: true, resumen: true, brief: true, ayuda: true } },
      viewer: { key: "viewer", label: "Visualizador", desc: "Acceso de solo lectura.", system: true,
        permissions: { ...permSet(false), viewReports: true } },
    };
  }
  const ROLE_ORDER_KEY = "role-order:v1";
  function readRoleOrder() {
    const v = parse(ls.get(ROLE_ORDER_KEY), null);
    if (!Array.isArray(v)) return ["admin", "editor", "disenador", "viewer"];
    // Forward-compat: si el orden guardado es viejo y existe el rol diseñador, insértalo.
    if (!v.includes("disenador") && readRoles().disenador) {
      const i = v.indexOf("viewer");
      if (i >= 0) v.splice(i, 0, "disenador"); else v.push("disenador");
    }
    return v;
  }
  function writeRoleOrder(arr) { ls.set(ROLE_ORDER_KEY, JSON.stringify(arr)); }

  /* Normaliza un mapa de roles: completa permisos/módulos y garantiza el acceso
     total del admin. Se aplica tanto a roles guardados como a los por defecto. */
  function normalizeRoles(v) {
    Object.keys(v).forEach((k) => {
      v[k].permissions = { ...permSet(false), ...(v[k].permissions || {}) };
      // Si el rol ya trae 'modules' (acceso restringido a propósito), se respeta
      // y solo se completan claves nuevas en false. Si no trae, ve todo (true).
      v[k].modules = v[k].modules ? { ...moduleSet(false), ...v[k].modules } : moduleSet(true);
    });
    if (v.admin) v.admin.permissions = permSet(true);
    return v;
  }
  function readRoles() {
    const v = parse(ls.get(ROLES_KEY), null);
    if (!v || typeof v !== "object") return normalizeRoles(defaultRoles());
    // Forward-compat: inyecta roles de sistema nuevos que aún no estén guardados
    // (p. ej. "Diseñador"), sin pisar los que el usuario ya tenga.
    const defs = defaultRoles();
    Object.keys(defs).forEach((k) => { if (!v[k]) v[k] = defs[k]; });
    return normalizeRoles(v);
  }
  function writeRoles(r) { ls.set(ROLES_KEY, JSON.stringify(r)); window.dispatchEvent(new CustomEvent(ROLES_EVT)); }
  function rolesList() { const r = readRoles(); return readRoleOrder().filter((k) => r[k]).map((k) => r[k]); }

  function subscribeRoles(cb) {
    const h = () => cb();
    window.addEventListener(ROLES_EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(ROLES_EVT, h); window.removeEventListener("storage", h); };
  }
  function useRoles() {
    useSyncExternalStore(subscribeRoles, () => (ls.get(ROLES_KEY) || "") + (ls.get(ROLE_ORDER_KEY) || ""), () => "");
    return rolesList();
  }
  function setRolePermission(roleKey, permKey, val) {
    const r = readRoles(); if (!r[roleKey]) return;
    r[roleKey] = { ...r[roleKey], permissions: { ...r[roleKey].permissions, [permKey]: !!val } };
    writeRoles(r);
  }
  function updateRoleMeta(roleKey, patch) {
    const r = readRoles(); if (!r[roleKey]) return;
    r[roleKey] = { ...r[roleKey], ...patch };
    writeRoles(r);
  }
  function addRole({ label, desc, basedOn }) {
    const r = readRoles();
    const base = r[basedOn] ? { ...r[basedOn].permissions } : permSet(false);
    let key = (label || "rol").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "rol";
    let k = key, i = 2; while (r[k]) k = `${key}-${i++}`;
    r[k] = { key: k, label: (label || "Nuevo rol").trim(), desc: (desc || "").trim(), system: false, permissions: base };
    writeRoles(r);
    writeRoleOrder([...readRoleOrder(), k]);
    return k;
  }
  function removeRole(key) {
    const r = readRoles(); if (!r[key] || r[key].system) return;
    delete r[key]; writeRoles(r);
    writeRoleOrder(readRoleOrder().filter((x) => x !== key));
    if ((ls.get(CURRENT_ROLE_KEY) || "viewer") === key) { ls.set(CURRENT_ROLE_KEY, "viewer"); }
    // Reassign members on the removed role to viewer for safety.
    writeMembers((readMembers() || []).map((m) => m.accessRole === key ? { ...m, accessRole: "viewer" } : m));
  }
  function resetRoles() { ls.del(ROLES_KEY); ls.del(ROLE_ORDER_KEY); window.dispatchEvent(new CustomEvent(ROLES_EVT)); }

  function useCurrentRole() {
    const value = useSyncExternalStore(subscribeRoles, () => ls.get(CURRENT_ROLE_KEY) || "viewer", () => "viewer");
    const roles = readRoles();
    const resolved = roles[value] ? value : "viewer";
    const set = (k) => { ls.set(CURRENT_ROLE_KEY, k); window.dispatchEvent(new CustomEvent(ROLES_EVT)); };
    return [resolved, set];
  }
  /* El rol efectivo se deriva del MIEMBRO VIVO de la sesión: si un admin te
     cambia el rol, tu interfaz se actualiza al instante sin re-login (BUG-C652).
     CURRENT_ROLE_KEY queda como respaldo (sesiones legadas). */
  function currentRoleKey() {
    try {
      const s = parse(ls.get(SESSION_KEY), null);
      if (s && s.memberId) {
        const m = (readMembers() || []).find((x) => x.id === s.memberId);
        if (m) return m.accessRole || "viewer";
      }
    } catch {}
    return ls.get(CURRENT_ROLE_KEY) || "viewer";
  }
  function subscribeAuth(cb) {
    const h = () => cb();
    window.addEventListener(ROLES_EVT, h);
    window.addEventListener(MEMBERS_EVT, h);
    window.addEventListener(SESSION_EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(ROLES_EVT, h); window.removeEventListener(MEMBERS_EVT, h); window.removeEventListener(SESSION_EVT, h); window.removeEventListener("storage", h); };
  }
  const authSnapshot = () => currentRoleKey() + ":" + (ls.get(ROLES_KEY) || "") + ":" + (ls.get(SESSION_KEY) || "");
  function can(permKey) {
    const roles = readRoles();
    const r = roles[currentRoleKey()] || roles.viewer;
    return !!(r && r.permissions && r.permissions[permKey]);
  }
  function useCan(permKey) {
    useSyncExternalStore(subscribeAuth, authSnapshot, () => "viewer:");
    return can(permKey);
  }
  /* Acceso a módulos por rol: deshabilitado → fuera de la navegación y ruta bloqueada. */
  function setRoleModule(roleKey, modKey, val) {
    const r = readRoles(); if (!r[roleKey] || roleKey === "admin") return; // admin: siempre acceso total
    r[roleKey] = { ...r[roleKey], modules: { ...moduleSet(true), ...(r[roleKey].modules || {}), [modKey]: !!val } };
    writeRoles(r);
  }
  function canModule(modKey) {
    const roles = readRoles();
    const r = roles[currentRoleKey()] || roles.viewer;
    if (!r) return false;
    if (r.key === "admin") return true;
    return !r.modules || r.modules[modKey] !== false;
  }
  function useModuleGate() {
    useSyncExternalStore(subscribeAuth, authSnapshot, () => "viewer:");
    return canModule;
  }

  /* ---------------- Members ---------------- */
  function readMembers() { const v = parse(ls.get(MEMBERS_KEY), null); return Array.isArray(v) ? v : null; }
  function writeMembers(list) { ls.set(MEMBERS_KEY, JSON.stringify(list || [])); window.dispatchEvent(new CustomEvent(MEMBERS_EVT)); }
  function subscribeMembers(cb) {
    const h = () => cb();
    window.addEventListener(MEMBERS_EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(MEMBERS_EVT, h); window.removeEventListener("storage", h); };
  }
  function useMembers() {
    useSyncExternalStore(subscribeMembers, () => ls.get(MEMBERS_KEY) || "", () => "");
    return readMembers() || [];
  }
  /* Nombre temporal estilo nametag para un miembro recién creado sin nombre.
     La persona lo reemplaza en su onboarding (profileCompleted sigue en false). */
  const NAMETAG_ADJ = ["Nuevo", "Cachimbo", "Invitado", "Visitante", "Recluta"];
  const NAMETAG_NOUN = ["Tigre", "Cóndor", "Puma", "Halcón", "Zorro", "Búho", "Lobo", "Delfín", "Llama", "Jaguar"];
  function randomNametag() {
    const a = NAMETAG_ADJ[Math.floor(Math.random() * NAMETAG_ADJ.length)];
    const n = NAMETAG_NOUN[Math.floor(Math.random() * NAMETAG_NOUN.length)];
    const num = Math.floor(10 + Math.random() * 90);
    return `${a} ${n} ${num}`;
  }
  function addMember(p) {
    p = p || {};
    const item = { id: uuid(), name: (p.name || "").trim() || randomNametag(), cargo: (p.cargo || "").trim(), accessRole: p.accessRole !== undefined ? p.accessRole : "editor", status: p.status || "active" };
    writeMembers([...(readMembers() || []), item]);
    return item.id;
  }
  /* Renombrar a alguien migra TODO lo asignado a su nombre viejo: pendientes
     generales, tareas operativas de cada campaña×periodo, pedidos de diseño
     (como diseñador y como solicitante) y responsables de campaña (BUG-F6CD). */
  function migrateOwnerName(oldName, newName) {
    const from = (oldName || "").trim(), to = (newName || "").trim();
    if (!from || !to || from === to) return;
    const eq = (v) => (v || "").trim() === from;
    // 1) Pendientes generales
    (readGeneralPendings() || []).forEach((i) => { if (eq(i.owner)) writeGeneralPending({ ...i, owner: to }); });
    // 2) Tareas operativas (todas las campañas × periodos conocidos)
    const periods = readAvailable();
    campaigns.forEach((c) => {
      periods.forEach((p) => {
        const tasks = readOperativeTasks(c.slug, p);
        if (!tasks || !tasks.length) return;
        let changed = false;
        const next = tasks.map((t) => { if (eq(t.owner)) { changed = true; return { ...t, owner: to }; } return t; });
        if (changed) writeOperativeTasks(c.slug, p, next);
      });
    });
    // 3) Pedidos de diseño (diseñador y solicitante)
    (readDesignRequests() || []).forEach((r) => {
      const patch = {};
      if (eq(r.designer)) patch.designer = to;
      if (eq(r.requester)) patch.requester = to;
      if (Object.keys(patch).length) ls.set(DR_PREFIX + r.id, JSON.stringify({ ...r, ...patch }));
    });
    window.dispatchEvent(new CustomEvent(DR_EVT));
    // 4) Responsable/supervisor en la configuración de campañas
    campaigns.forEach((c) => {
      periods.forEach((p) => {
        const meta = readConfigMeta(c.slug, p);
        if (!meta) return;
        const patch = {};
        if (eq(meta.responsable)) patch.responsable = to;
        if (eq(meta.supervisor)) patch.supervisor = to;
        if (Object.keys(patch).length) writeConfigMeta(c.slug, p, { ...meta, ...patch });
      });
    });
    window.dispatchEvent(new CustomEvent(GP_EVT));
    emit();
  }
  function updateMember(id, patch) {
    const cur = (readMembers() || []).find((m) => m.id === id);
    writeMembers((readMembers() || []).map((m) => m.id === id ? { ...m, ...patch } : m));
    // Si cambió el nombre visible, reasigna todo lo suyo al nombre nuevo.
    if (cur && patch.name !== undefined && (patch.name || "").trim() && (cur.name || "").trim() !== (patch.name || "").trim()) {
      migrateOwnerName(cur.name, patch.name);
    }
  }
  function removeMember(id) { writeMembers((readMembers() || []).filter((m) => m.id !== id)); }

  function seedMembersAndRoles() {
    if (!ls.get(ROLES_KEY)) writeRoles(defaultRoles());
    if (!ls.get(ROLE_ORDER_KEY)) writeRoleOrder(["admin", "editor", "viewer"]);
    if (!ls.get(CURRENT_ROLE_KEY)) ls.set(CURRENT_ROLE_KEY, "admin");
    if (ls.get("members-seed:v1") !== "1") {
      ls.set("members-seed:v1", "1");
      writeMembers([
        { id: uuid(), name: "Camila", cargo: "Lead de Campañas", accessRole: "admin", status: "active" },
        { id: uuid(), name: "Diego", cargo: "Performance & Pauta", accessRole: "editor", status: "active" },
        { id: uuid(), name: "Lucía", cargo: "Contenido", accessRole: "editor", status: "active" },
        { id: uuid(), name: "Ana", cargo: "Diseño", accessRole: "editor", status: "active" },
        { id: uuid(), name: "Equipo", cargo: "Operaciones", accessRole: "viewer", status: "active" },
      ]);
    }
  }

  /* ---------------- Demo seed (one-shot, makes the prototype feel alive) ---------------- */
  function seedDemo() {
    seedMembersAndRoles();
    seedDesignRequests();
    // Argumentario seed — one-shot, independent guard
    if (!ls.get(ARGS_KEY)) {
      const mkArg = (titulo, keywords, contenido) => ({ id: uuid(), titulo, keywords, contenido, updatedAt: Date.now() });
      writeArgs([
        mkArg("Objeción: precio / no tengo dinero", ["precio", "caro", "dinero", "pago", "costo", "beca"],
          "Entiendo que el presupuesto es una preocupación real. Justamente por eso tenemos facilidades: puedes matricularte fraccionando la primera cuota y mantienes la pensión de tu último ciclo congelada. Además, por reincorporación calificas a evaluación de beca. ¿Revisamos juntos qué opción se ajusta mejor a tu caso?"),
        mkArg("Objeción: no tengo tiempo / trabajo", ["tiempo", "trabajo", "horario", "ocupado", "noche"],
          "Muchos de nuestros alumnos trabajan a tiempo completo. Para eso existen los horarios nocturnos y de fin de semana, y cursos virtuales asincrónicos que avanzas a tu ritmo. Con 2 cursos por ciclo retomas la carrera sin descuidar tu empleo. ¿Qué franja te acomodaría más?"),
        mkArg("Objeción: lo voy a pensar", ["pensar", "después", "luego", "decidir", "duda"],
          "Claro, es una decisión importante. Solo considera que la matrícula con descuento cierra pronto y los cupos de horario noche se agotan primero. Puedo reservarte el cupo hoy sin compromiso mientras lo decides. ¿Qué información adicional te ayudaría a tomar la decisión?"),
        mkArg("Objeción: me fue mal / desaprobé cursos", ["notas", "desaprobé", "difícil", "miedo", "promedio"],
          "Que un ciclo no haya salido como esperabas no define tu carrera. Al reincorporarte accedes a tutoría académica y talleres de nivelación sin costo, y puedes empezar con una carga ligera para retomar confianza. Varios alumnos en tu situación hoy ya están por egresar."),
      ]);
    }
    if (ls.get("demo-seed:v4") === "1") return;
    ls.set("demo-seed:v4", "1");
    const period = "2026-1";
    // base date around "today" = 2026-06-08
    const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const seeds = {
      bienvenida: (tasks) => tasks.map((t, i) => {
        if (i < 4) return { ...t, status: "done", done: true, deadline: iso(2026, 5, 18 + i) };
        if (i === 4) return { ...t, status: "blocked", priority: "high", deadline: iso(2026, 6, 5) };
        if (i === 5) return { ...t, status: "in_progress", priority: "high", deadline: iso(2026, 6, 9) };
        if (i === 6) return { ...t, status: "in_progress", deadline: iso(2026, 6, 12) };
        if (i === 7) return { ...t, status: "todo", priority: "high", deadline: iso(2026, 6, 8) };
        return t;
      }),
      reinscritos: (tasks) => tasks.map((t, i) => {
        if (i < 6) return { ...t, status: "done", done: true };
        if (i === 6) return { ...t, status: "in_progress", priority: "high", deadline: iso(2026, 6, 10) };
        if (i === 7) return { ...t, status: "blocked", priority: "high", deadline: iso(2026, 6, 4) };
        if (i === 8) return { ...t, status: "todo", deadline: iso(2026, 6, 15) };
        if (i === 9) return { ...t, status: "todo", priority: "high", deadline: iso(2026, 6, 8) };
        return t;
      }),
      reincorporados: (tasks) => tasks.map((t, i) => {
        if (i < 5) return { ...t, status: "done", done: true };
        if (i === 5) return { ...t, status: "in_progress", deadline: iso(2026, 6, 11) };
        if (i === 6) return { ...t, status: "todo", priority: "high", deadline: iso(2026, 6, 6) };
        if (i === 7) return { ...t, status: "todo", deadline: iso(2026, 6, 20) };
        return t;
      }),
      recupero: (tasks) => tasks.map((t, i) => {
        if (i < 3) return { ...t, status: "done", done: true };
        if (i === 3) return { ...t, status: "in_progress", priority: "high", deadline: iso(2026, 6, 9) };
        if (i === 4) return { ...t, status: "blocked", priority: "high", deadline: iso(2026, 6, 2) };
        if (i === 6) return { ...t, status: "todo", deadline: iso(2026, 6, 13) };
        return t;
      }),
    };
    const responsables = { bienvenida: "Camila", reinscritos: "Diego", reincorporados: "Lucía", recupero: "Ana" };
    Object.entries(seeds).forEach(([slug, fn]) => {
      const tasks = fn(buildFromTemplate(slug, period));
      writeOperativeTasks(slug, period, tasks);
      ls.set(CONFIG_KEY(slug, period), "1");
      ls.set(META_KEY(slug, period), JSON.stringify({ responsable: responsables[slug] }));
    });
    // A couple of general pendings, some linked
    const gp = [
      { id: uuid(), title: "Aprobar arte final de piezas de Bienvenida", owner: "Ana", priority: "high", status: "in_progress", deadline: iso(2026, 6, 9), campaignSlug: "bienvenida", period, createdAt: new Date().toISOString(), description: "Falta visto bueno de marca sobre las 3 variantes." },
      { id: uuid(), title: "Solicitar base actualizada a BI", owner: "Lucía", priority: "high", status: "todo", deadline: iso(2026, 6, 8), campaignSlug: "reinscritos", period, createdAt: new Date().toISOString() },
      { id: uuid(), title: "Definir presupuesto de pauta Q2", owner: "Diego", priority: "med", status: "todo", deadline: iso(2026, 6, 18), createdAt: new Date().toISOString() },
      { id: uuid(), title: "Revisar copy de SMS de recupero", owner: "Ana", priority: "low", status: "blocked", campaignSlug: "recupero", period, createdAt: new Date().toISOString(), description: "Bloqueado por aprobación legal." },
    ];
    writeGeneralPendings(gp);
    ls.set(CURRENT_PERIOD_KEY, period);
  }

  /* ====================================================================
     Design requests — two-stage workflow (requerimiento → entrega/revisión)
     with full action log + visual timeline. Persisted decoupled.
     Status machine: pending → in_design → delivered → in_review → approved | feedback
     ==================================================================== */
  const DR_KEY = "design-requests:v1";
  const DR_EVT = "design-requests-change";
  const DR_STATUS = {
    pending: { key: "pending", label: "Pendiente", dot: "bg-muted-foreground/50", soft: "bg-muted text-muted-foreground", icon: "Inbox" },
    in_design: { key: "in_design", label: "En diseño", dot: "bg-accent-violet", soft: "bg-accent-violet/10 text-accent-violet", icon: "PenTool" },
    delivered: { key: "delivered", label: "Entregado", dot: "bg-brand", soft: "bg-brand/10 text-brand", icon: "Upload" },
    in_review: { key: "in_review", label: "En revisión", dot: "bg-accent-amber", soft: "bg-accent-amber/15 text-accent-amber", icon: "Eye" },
    approved: { key: "approved", label: "Aprobado", dot: "bg-accent-green", soft: "bg-accent-green/10 text-accent-green", icon: "CheckCircle2" },
    feedback: { key: "feedback", label: "Con feedback", dot: "bg-destructive", soft: "bg-destructive/10 text-destructive", icon: "MessageSquareWarning" },
    cancelled: { key: "cancelled", label: "Cancelado", dot: "bg-muted-foreground/60", soft: "bg-muted text-muted-foreground", icon: "Ban" },
  };
  const DR_STATUS_ORDER = ["pending", "in_design", "delivered", "in_review", "approved", "feedback", "cancelled"];
  const DR_TYPES_DEFAULT = ["Banner / Display", "Pieza para redes", "Email / Mailing", "Landing / Web", "Video / Motion", "Material impreso", "Identidad / Branding", "Tótem", "Otro"];
  const DR_TYPES_KEY = "dr-types:v1";
  const DR_TYPES_EVT = "dr-types-change";
  function readDRTypes() {
    const v = parse(ls.get(DR_TYPES_KEY), null);
    return (Array.isArray(v) && v.length) ? v : DR_TYPES_DEFAULT.slice();
  }
  function writeDRTypes(list) {
    const clean = (list || []).map((s) => String(s).trim()).filter(Boolean);
    // dedup preservando orden
    const seen = new Set(), out = [];
    clean.forEach((t) => { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t); } });
    ls.set(DR_TYPES_KEY, JSON.stringify(out.length ? out : DR_TYPES_DEFAULT.slice()));
    window.dispatchEvent(new CustomEvent(DR_TYPES_EVT)); emit();
  }
  function useDRTypes() {
    useSyncExternalStore(
      (cb) => { const h = () => cb(); window.addEventListener(DR_TYPES_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(DR_TYPES_EVT, h); window.removeEventListener("storage", h); }; },
      () => ls.get(DR_TYPES_KEY) || "", () => ""
    );
    return readDRTypes();
  }
  // Compat: algunos componentes leen S.DR_TYPES como arreglo directo.
  const DR_TYPES = readDRTypes();
  const DR_PRIORITY = { high: { label: "Alta", soft: "bg-destructive/10 text-destructive", dot: "bg-destructive" }, med: { label: "Media", soft: "bg-accent-amber/15 text-accent-amber", dot: "bg-accent-amber" }, low: { label: "Baja", soft: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" } };
  // Action log kinds → how the timeline renders them.
  const DR_LOG_KINDS = {
    created: { label: "Solicitud creada", icon: "FilePlus2", tone: "brand" },
    locked: { label: "Requerimiento fijado", icon: "Lock", tone: "violet" },
    unlocked: { label: "Requerimiento reabierto", icon: "Unlock", tone: "muted" },
    edited: { label: "Requerimiento editado", icon: "Pencil", tone: "muted" },
    deadline: { label: "Deadline modificado", icon: "CalendarClock", tone: "amber" },
    assigned: { label: "Diseñador asignado", icon: "UserCheck", tone: "violet" },
    status: { label: "Cambio de estado", icon: "ArrowRightLeft", tone: "muted" },
    delivery: { label: "Entrega subida", icon: "Upload", tone: "brand" },
    approved: { label: "Entrega aprobada", icon: "CheckCircle2", tone: "green" },
    feedback: { label: "Feedback enviado", icon: "MessageSquare", tone: "red" },
    comment: { label: "Comentario", icon: "MessageCircle", tone: "muted" },
    cancelled: { label: "Solicitud cancelada", icon: "Ban", tone: "red" },
    reactivated: { label: "Solicitud reactivada", icon: "RotateCcw", tone: "green" },
  };

  /* Una clave por solicitud (dr:<id>): ediciones simultáneas sobre
     solicitudes distintas ya no colisionan. Migración automática del legado. */
  const DR_PREFIX = "dr:";
  function drMigrate() {
    const legacy = parse(ls.get(DR_KEY), null);
    if (Array.isArray(legacy)) {
      legacy.forEach((r) => { if (r && r.id) ls.set(DR_PREFIX + r.id, JSON.stringify(r)); });
      ls.del(DR_KEY);
    }
  }
  function readDesignRequests() {
    drMigrate();
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DR_PREFIX)) { const v = parse(ls.get(k), null); if (v && v.id) items.push(v); }
    }
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return items;
  }
  function writeDesignRequests(list) {
    drMigrate();
    const ids = new Set((list || []).map((r) => r.id));
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DR_PREFIX) && !ids.has(k.slice(DR_PREFIX.length))) stale.push(k);
    }
    stale.forEach((k) => ls.del(k));
    (list || []).forEach((r) => {
      const k = DR_PREFIX + r.id, nv = JSON.stringify(r);
      if (ls.get(k) !== nv) ls.set(k, nv);
    });
    window.dispatchEvent(new CustomEvent(DR_EVT));
  }
  let drVersion = 0;
  function subscribeDR(cb) {
    const h = () => { drVersion++; cb(); };
    window.addEventListener(DR_EVT, h); window.addEventListener("storage", h);
    return () => { window.removeEventListener(DR_EVT, h); window.removeEventListener("storage", h); };
  }
  function useDesignRequests() {
    useSyncExternalStore(subscribeDR, () => drVersion, () => 0);
    ensureDRNumbers();
    return readDesignRequests() || [];
  }
  function getDesignRequest(id) { return (readDesignRequests() || []).find((r) => r.id === id) || null; }
  /* Asegura un número de pedido secuencial estable a los pedidos antiguos
     (creados antes de existir el contador), ordenados por fecha de creación. */
  function ensureDRNumbers() {
    const list = (readDesignRequests() || []);
    const missing = list.filter((r) => typeof r.num !== "number");
    if (!missing.length) return;
    let max = 0; list.forEach((r) => { if (typeof r.num === "number" && r.num > max) max = r.num; });
    missing.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach((r) => {
      r.num = ++max; ls.set(DR_PREFIX + r.id, JSON.stringify(r));
    });
    window.dispatchEvent(new CustomEvent(DR_EVT));
  }

  function drLog(kind, detail) {
    return { id: uuid(), kind, ts: Date.now(), user: currentUserName(), ...(detail || {}) };
  }
  function nextDRNum() {
    let max = 0;
    (readDesignRequests() || []).forEach((r) => { if (typeof r.num === "number" && r.num > max) max = r.num; });
    return max + 1;
  }
  function addDesignRequest(p) {
    p = p || {};
    const item = {
      id: uuid(), num: nextDRNum(),
      title: (p.title || "").trim(), description: (p.description || "").trim(),
      priority: p.priority || "med", type: p.type || readDRTypes()[0], deadline: p.deadline || "",
      refs: p.refs || [], designer: p.designer || "", requester: currentUserName(),
      status: "pending", locked: false, deliveries: [], reviews: [],
      createdAt: Date.now(),
      log: [drLog("created", { label: (p.title || "Solicitud").trim() })],
    };
    ls.set(DR_PREFIX + item.id, JSON.stringify(item));
    window.dispatchEvent(new CustomEvent(DR_EVT));
    if (item.designer) notify({ to: item.designer, type: "design", title: "Nueva solicitud de diseño asignada", detail: item.title, href: "#/operativa/solicitudes" });
    return item.id;
  }
  function mutateDR(id, fn) {
    drMigrate();
    const cur = parse(ls.get(DR_PREFIX + id), null);
    if (!cur || !cur.id) return;
    ls.set(DR_PREFIX + id, JSON.stringify(fn({ ...cur })));
    window.dispatchEvent(new CustomEvent(DR_EVT));
  }
  function pushLog(r, kind, detail) { r.log = [...(r.log || []), drLog(kind, detail)]; return r; }

  function updateDesignRequest(id, patch, opts) {
    opts = opts || {};
    mutateDR(id, (r) => {
      const before = { ...r };
      Object.assign(r, patch);
      if (opts.log) pushLog(r, opts.log.kind, opts.log.detail);
      else {
        // auto-detect a couple of meaningful changes
        if (patch.deadline !== undefined && patch.deadline !== before.deadline)
          pushLog(r, "deadline", { before: before.deadline || "—", after: patch.deadline || "—" });
        if (patch.designer !== undefined && patch.designer !== before.designer) {
          pushLog(r, "assigned", { after: patch.designer || "—" });
          // Asignar un diseñador a un pedido recién creado lo mueve a "En diseño",
          // así el estado deja de ser inalcanzable (BUG-2017).
          if (patch.designer && r.status === "pending") { r.status = "in_design"; pushLog(r, "status", { before: "Solicitado", after: "En diseño" }); if (patch.designer) notify({ to: patch.designer, type: "design", title: "Tienes un diseño para empezar", detail: r.title, href: "#/operativa/solicitudes" }); }
        }
      }
      return r;
    });
  }
  function setDRLocked(id, locked) {
    mutateDR(id, (r) => { r.locked = locked; if (locked && r.status === "pending") r.status = "in_design"; return pushLog(r, locked ? "locked" : "unlocked", { label: r.title }); });
  }
  function setDRStatus(id, status) {
    mutateDR(id, (r) => { const from = r.status; r.status = status; return pushLog(r, "status", { before: (DR_STATUS[from] || {}).label || from, after: (DR_STATUS[status] || {}).label || status }); });
  }
  /* Cancelación con registro: guarda el estado previo; cancelar y reactivar quedan en el log. */
  function cancelDR(id, reason) {
    mutateDR(id, (r) => {
      if (r.status === "cancelled") return r;
      r.prevStatus = r.status;
      r.status = "cancelled";
      r.cancelledAt = Date.now(); r.cancelledBy = currentUserName(); r.cancelReason = (reason || "").trim();
      return pushLog(r, "cancelled", { label: r.title, after: (reason || "").trim() || "Sin motivo indicado" });
    });
  }
  function reactivateDR(id) {
    mutateDR(id, (r) => {
      if (r.status !== "cancelled") return r;
      /* Restaura el estado previo; si no existe, lo deriva del historial real. */
      let next = r.prevStatus;
      if (!next || next === "cancelled") {
        const lastRev = (r.reviews || [])[(r.reviews || []).length - 1];
        if (lastRev && lastRev.verdict === "approved") next = "approved";
        else if (lastRev && lastRev.verdict === "feedback") next = "feedback";
        else if ((r.deliveries || []).length) next = "in_review";
        else if (r.designer) next = "in_design";
        else next = "pending";
      }
      r.status = next;
      delete r.prevStatus;
      r.reactivatedAt = Date.now();
      return pushLog(r, "reactivated", { label: r.title, after: `Vuelve a «${(DR_STATUS[next] || {}).label || next}»` });
    });
  }
  function addDRDelivery(id, delivery) {
    mutateDR(id, (r) => {
      const d = { id: uuid(), ts: Date.now(), by: currentUserName(), note: (delivery.note || "").trim(), links: delivery.links || [], files: delivery.files || [] };
      r.deliveries = [...(r.deliveries || []), d];
      r.status = "in_review";
      if (r.requester) notify({ to: r.requester, type: "design", title: "Entrega lista para tu revisión", detail: r.title, href: "#/operativa/solicitudes" });
      return pushLog(r, "delivery", { label: d.note || `Entrega v${r.deliveries.length}`, version: r.deliveries.length });
    });
  }
  function addDRReview(id, verdict, comment) {
    mutateDR(id, (r) => {
      const rev = { id: uuid(), ts: Date.now(), by: currentUserName(), verdict, comment: (comment || "").trim() };
      r.reviews = [...(r.reviews || []), rev];
      if (verdict === "approved") { r.status = "approved"; pushLog(r, "approved", { label: comment || "Entrega aprobada" }); if (r.designer) notify({ to: r.designer, type: "design", title: "Tu entrega fue aprobada ✓", detail: r.title, href: "#/operativa/solicitudes" }); }
      else if (verdict === "feedback") { r.status = "feedback"; pushLog(r, "feedback", { label: comment || "Feedback enviado" }); if (r.designer) notify({ to: r.designer, type: "design", title: "Recibiste feedback en una entrega", detail: (comment || r.title || "").slice(0, 160), href: "#/operativa/solicitudes" }); }
      else pushLog(r, "comment", { label: comment || "Comentario" });
      return r;
    });
  }
  function removeDesignRequest(id) { ls.del(DR_PREFIX + id); window.dispatchEvent(new CustomEvent(DR_EVT)); }

  function seedDesignRequests() {
    if (ls.get("dr-seed:v1") === "1") return;
    ls.set("dr-seed:v1", "1");
    const DAY = 86400000, now = Date.now();
    const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const mk = (o) => ({ id: uuid(), refs: [], deliveries: [], reviews: [], requester: "Camila", ...o });
    const r1 = mk({
      title: "Banner principal — Lanzamiento Primavera", description: "Pieza hero para la home y display. Debe destacar el 30% de descuento y el CTA de matrícula.",
      priority: "high", type: "Banner / Display", deadline: iso(2026, 6, 16), designer: "Ana", status: "in_review", locked: true,
      createdAt: now - 6 * DAY,
      log: [
        { id: uuid(), kind: "created", ts: now - 6 * DAY, user: "Camila", label: "Banner principal — Lanzamiento Primavera" },
        { id: uuid(), kind: "locked", ts: now - 6 * DAY + 3600e3, user: "Camila", label: "Banner principal" },
        { id: uuid(), kind: "assigned", ts: now - 5 * DAY, user: "Camila", after: "Ana" },
        { id: uuid(), kind: "status", ts: now - 5 * DAY, user: "Ana", before: "Pendiente", after: "En diseño" },
        { id: uuid(), kind: "delivery", ts: now - 1 * DAY, user: "Ana", label: "v1 — 3 tamaños (1920, 1080, 320)", version: 1 },
      ],
      deliveries: [{ id: uuid(), ts: now - 1 * DAY, by: "Ana", note: "v1 — 3 tamaños (1920, 1080, 320)", links: ["https://drive.example/banner-v1"], files: ["banner_1920.png", "banner_1080.png"] }],
    });
    const r2 = mk({
      title: "Carrusel para redes — Reinscritos", description: "5 slides para Instagram. Tono cercano, foco en beneficios de reinscripción.",
      priority: "med", type: "Pieza para redes", deadline: iso(2026, 6, 20), designer: "Lucía", status: "feedback", locked: true,
      createdAt: now - 8 * DAY,
      log: [
        { id: uuid(), kind: "created", ts: now - 8 * DAY, user: "Camila", label: "Carrusel para redes — Reinscritos" },
        { id: uuid(), kind: "locked", ts: now - 8 * DAY + 1800e3, user: "Camila", label: "Carrusel" },
        { id: uuid(), kind: "status", ts: now - 7 * DAY, user: "Lucía", before: "Pendiente", after: "En diseño" },
        { id: uuid(), kind: "delivery", ts: now - 3 * DAY, user: "Lucía", label: "v1 — 5 slides", version: 1 },
        { id: uuid(), kind: "feedback", ts: now - 2 * DAY, user: "Diego", label: "Ajustar contraste del slide 3 y unificar tipografía." },
      ],
      deliveries: [{ id: uuid(), ts: now - 3 * DAY, by: "Lucía", note: "v1 — 5 slides", links: [], files: ["carrusel_v1.pdf"] }],
      reviews: [{ id: uuid(), ts: now - 2 * DAY, by: "Diego", verdict: "feedback", comment: "Ajustar contraste del slide 3 y unificar tipografía." }],
    });
    const r3 = mk({
      title: "Mailing de bienvenida", description: "Plantilla responsive para el flujo de onboarding de nuevos alumnos.",
      priority: "med", type: "Email / Mailing", deadline: iso(2026, 6, 24), designer: "Ana", status: "approved", locked: true,
      createdAt: now - 12 * DAY,
      log: [
        { id: uuid(), kind: "created", ts: now - 12 * DAY, user: "Camila", label: "Mailing de bienvenida" },
        { id: uuid(), kind: "locked", ts: now - 12 * DAY + 3600e3, user: "Camila", label: "Mailing" },
        { id: uuid(), kind: "delivery", ts: now - 5 * DAY, user: "Ana", label: "v1 — HTML responsive", version: 1 },
        { id: uuid(), kind: "approved", ts: now - 4 * DAY, user: "Camila", label: "Aprobado, listo para producción." },
      ],
      deliveries: [{ id: uuid(), ts: now - 5 * DAY, by: "Ana", note: "v1 — HTML responsive", links: ["https://drive.example/mailing"], files: ["bienvenida.html"] }],
      reviews: [{ id: uuid(), ts: now - 4 * DAY, by: "Camila", verdict: "approved", comment: "Aprobado, listo para producción." }],
    });
    const r4 = mk({
      title: "Landing de recupero", description: "Página de aterrizaje para la campaña de recupero de alumnos desertores.",
      priority: "high", type: "Landing / Web", deadline: iso(2026, 6, 18), designer: "", status: "pending", locked: false,
      createdAt: now - 1 * DAY,
      log: [{ id: uuid(), kind: "created", ts: now - 1 * DAY, user: "Camila", label: "Landing de recupero" }],
    });
    writeDesignRequests([r4, r1, r2, r3]);
  }

  /* ---------------- Campaign data export / import (.json) ---------------- */
  function exportCampaignData(slug, p) {
    const camp = campaigns.find((c) => c.slug === slug) || {};
    return {
      format: "campaign-brief", version: 1,
      exportedAt: Date.now(), exportedBy: currentUserName(),
      period: p,
      campaign: { slug, title: camp.title || slug, description: camp.description || "", icon: camp.icon || "Megaphone", accent: camp.accent || "brand" },
      configured: isCampaignConfigured(slug, p),
      meta: readConfigMeta(slug, p),
      brief: loadBriefSnapshot(slug, p),
      summary: parse(ls.get(`brief-summary:${slug}:${p}`), null),
      tasks: readOperativeTasks(slug, p),
      pendings: readGeneralPendings().filter((i) => i.campaignSlug === slug && (!i.period || i.period === p)),
    };
  }
  function importCampaignData(data) {
    if (!data || typeof data !== "object" || data.format !== "campaign-brief" || !data.campaign || !data.campaign.slug || !data.period) {
      return { ok: false, error: "Archivo no válido. Se esperaba un .json exportado desde un brief de campaña." };
    }
    const p = String(data.period);
    const slug = String(data.campaign.slug);
    if (!readAvailable().includes(p)) addPeriod(p);
    const existing = campaigns.find((c) => c.slug === slug);
    if (!existing) {
      const c = { slug, title: (data.campaign.title || slug).trim(), description: (data.campaign.description || "").trim(), icon: data.campaign.icon || "Megaphone", accent: data.campaign.accent || "brand", custom: true };
      const custom = readCustomCampaigns(); custom.push(c);
      ls.set(CUSTOM_CAMPAIGNS_KEY, JSON.stringify(custom));
      rebuildCampaigns(); notifyCampaigns();
    } else if (data.campaign.title) {
      updateCampaign(slug, { title: data.campaign.title, description: data.campaign.description });
    }
    if (data.brief && typeof data.brief === "object") ls.set(BRIEF_KEY(slug, p), JSON.stringify(data.brief));
    if (data.summary && typeof data.summary === "object") ls.set(`brief-summary:${slug}:${p}`, JSON.stringify(data.summary));
    if (Array.isArray(data.tasks)) ls.set(CHECK_KEY(slug, p), JSON.stringify(data.tasks));
    if (data.meta && typeof data.meta === "object") ls.set(META_KEY(slug, p), JSON.stringify(data.meta));
    if (data.configured) ls.set(CONFIG_KEY(slug, p), "1");
    if (Array.isArray(data.pendings) && data.pendings.length) {
      const cur = readGeneralPendings();
      const ids = new Set(cur.map((i) => i.id));
      const incoming = data.pendings.filter((i) => i && i.id && !ids.has(i.id)).map((i) => ({ ...i, campaignSlug: slug }));
      if (incoming.length) ls.set(GP_KEY, JSON.stringify([...incoming, ...cur]));
    }
    emit();
    return { ok: true, slug, period: p, title: (data.campaign.title || slug), existed: !!existing };
  }

  /* ---------------- Argumentario (global bank) + Speech (per campaign-period) ----------------
     Argumento: { id, titulo, keywords[], contenido }. Speeches reference argument IDs only,
     so editing a central argument updates every campaign; deleting one drops it cleanly. */
  const ARGS_KEY = "argumentario:v1";
  const ARGS_EVT = "argumentario-change";
  function readArgs() { const v = parse(ls.get(ARGS_KEY), null); return Array.isArray(v) ? v : []; }
  function writeArgs(list) { ls.set(ARGS_KEY, JSON.stringify(list || [])); window.dispatchEvent(new CustomEvent(ARGS_EVT)); }
  function subscribeArgs(cb) {
    const h = () => cb();
    window.addEventListener(ARGS_EVT, h); window.addEventListener("storage", h);
    return () => { window.removeEventListener(ARGS_EVT, h); window.removeEventListener("storage", h); };
  }
  function useArgs() {
    useSyncExternalStore(subscribeArgs, () => ls.get(ARGS_KEY) || "", () => "");
    return readArgs();
  }
  function addArg(a) {
    const item = { id: uuid(), titulo: "", keywords: [], contenido: "", ...(a || {}), updatedAt: Date.now() };
    writeArgs([item, ...readArgs()]);
    return item.id;
  }
  function updateArg(id, patch) { writeArgs(readArgs().map((x) => x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)); }
  function removeArg(id) { writeArgs(readArgs().filter((x) => x.id !== id)); }

  const SPEECH_KEY = (slug, p) => `speech:${slug}:${p}`;
  function readSpeech(slug, p) { return { text: "", argumentarioEnabled: false, enabledArgIds: [], ...parse(ls.get(SPEECH_KEY(slug, p)), {}) }; }
  function writeSpeech(slug, p, patch) { ls.set(SPEECH_KEY(slug, p), JSON.stringify({ ...readSpeech(slug, p), ...patch, updatedAt: Date.now() })); emit(); }
  function useSpeech(slug, p) {
    useSyncExternalStore(subscribe, () => ls.get(SPEECH_KEY(slug, p)) || "", () => "");
    return readSpeech(slug, p);
  }

  /* ---------------- Export ---------------- */
  /* ===== Tema claro/oscuro (BUG-DC02) ===== */
  const THEME_KEY = "app-theme";
  const THEME_EVT = "app-theme-change";
  function prefersDark() { try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch (e) { return false; } }
  function readTheme() { return ls.get(THEME_KEY) || "auto"; } // light | dark | auto
  function applyTheme(t) {
    try {
      const dark = t === "dark" || (t === "auto" && prefersDark());
      if (document && document.documentElement) document.documentElement.classList.toggle("dark", !!dark);
    } catch (e) {}
  }
  function setTheme(t) { ls.set(THEME_KEY, t); applyTheme(t); try { window.dispatchEvent(new CustomEvent(THEME_EVT)); } catch (e) {} }
  function useTheme() {
    useSyncExternalStore(
      (cb) => { const h = () => cb(); window.addEventListener(THEME_EVT, h); window.addEventListener("storage", h); return () => { window.removeEventListener(THEME_EVT, h); window.removeEventListener("storage", h); }; },
      () => ls.get(THEME_KEY) || "auto", () => "auto"
    );
    return readTheme();
  }
  // Reaccionar a cambios del sistema cuando el modo es "auto".
  try {
    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mq && mq.addEventListener) mq.addEventListener("change", () => { if (readTheme() === "auto") applyTheme("auto"); });
  } catch (e) {}

  window.Store = {
    DEFAULT_PERIODS, TEMPLATES,
    formatPeriodLabel, formatPeriodShort,
    listAvailablePeriods, useAvailablePeriods, addPeriod, removePeriod,
    campaigns: campaigns, useCampaigns, createCampaign, updateCampaign, removeCampaign,
    useCurrentPeriod, writeCurrentPeriod, useSectionPeriodActive, useSelectedPeriods, writeSelectedPeriods,
    useArgs, readArgs, addArg, updateArg, removeArg,
    readSpeech, writeSpeech, useSpeech,
    isCampaignConfigured, markCampaignConfigured, unmarkCampaignConfigured,
    getConfiguredPeriods, getPreviousConfiguredPeriod,
    duplicateCampaignConfig, createBlankCampaignConfig, useConfigured,
    duplicateConfigWithOverrides, readConfigMeta, writeConfigMeta, useConfigMeta, shiftISO,
    activeBriefParams, resolveParamISO, rematerializeTaskDeadlines, rematerializeComms,
    notify, readNotifs, useNotifs, markNotifsSeen, notifyMentions,
    readBugReports, removeBugReport, clearBugReports, useBugReports, setBugStatus, applyResolvedBugs,
    unseenResolvedBugs, markChangelogSeen,
    effectiveTemplate, writeTemplateOverride, resetTemplateOverride, useTemplates, hasTemplateOverride,
    getCampaignStatus, useCampaignStatus, setApproval, touchCampaign,
    readCampaignLinks, writeCampaignLinks, useCampaignLinks,
    buildFromTemplate, readOperativeTasks, writeOperativeTasks,
    useOperativeChecklist, useOperativeProgress,
    // Changelog + current user
    currentUserName, readChangelog, logChange, clearChangelog, useChangelog, UPDATE_LABELS,
    readGeneralPendings, useGeneralPendings, addGeneralPending, removeGeneralPending,
    readTheme, setTheme, useTheme, applyTheme,
    defaultParams, defaultKeyDates, loadBriefSnapshot, saveBriefSnapshot, readComms,
    readCommExecutions, isCommExecuted, setCommExecuted, useCommExecutions,
    readGlobalParams, writeGlobalParams, useGlobalParams, hasGlobalParams,
    readBriefVersions, useBriefVersions,
    exportCampaignData, importCampaignData,
    // Design requests
    DR_STATUS, DR_STATUS_ORDER, DR_TYPES, DR_PRIORITY, DR_LOG_KINDS,
    readDRTypes, writeDRTypes, useDRTypes,
    useDesignRequests, readDesignRequests, getDesignRequest,
    addDesignRequest, updateDesignRequest, removeDesignRequest,
    setDRLocked, setDRStatus, addDRDelivery, addDRReview, cancelDR, reactivateDR, nextDRNum,
    // Members + RBAC
    PERMISSIONS, PERMISSION_KEYS, MODULE_DEFS, setRoleModule, canModule, useModuleGate, readRoleOrder,
    useMembers, readMembers, addMember, updateMember, removeMember,
    useRoles, rolesList, readRoles, setRolePermission, updateRoleMeta, addRole, removeRole, resetRoles,
    useCurrentRole, can, useCan,
    useSession, readSession, login, logout, useLoginSettings, readLoginSettings, writeLoginSettings,
    sessionClaveInfo, verifySessionClave,
    usePendingOrigins, readPendingOrigins, writePendingOrigins,
    seedDemo, uuid,
  };
})();
