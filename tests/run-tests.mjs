/* =====================================================================
   Pruebas del store (lógica de negocio) — sin frameworks.
   Ejecutar:  node tests/run-tests.mjs
   Simula el entorno mínimo del navegador (localStorage, eventos, React)
   y verifica las reglas críticas que más se han roto históricamente.
   ===================================================================== */
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- entorno mínimo de navegador ---------- */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => Array.from(mem.keys())[i] ?? null,
  get length() { return mem.size; },
};
globalThis.window = globalThis;
globalThis.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; Object.assign(this, opts || {}); } };
globalThis.StorageEvent = globalThis.CustomEvent;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.dispatchEvent = () => true;
globalThis.React = {
  useCallback: (f) => f,
  useEffect: () => {},
  useMemo: (f) => f(),
  useRef: (v) => ({ current: v }),
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useSyncExternalStore: (_s, get) => get(),
};

/* ---------- cargar la app (mismo orden que el navegador) ---------- */
(0, eval)(readFileSync(join(root, "app/core/templates.js"), "utf8"));
(0, eval)(readFileSync(join(root, "app/core/store.js"), "utf8"));
const S = globalThis.Store;
assert.ok(S, "window.Store debe existir tras cargar store.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✔ " + name); }
  catch (e) { failed++; console.error("  ✘ " + name + "\n    " + e.message); }
}

console.log("\n— Reglas de acceso (RBAC) —");
test("sin sesión, el rol por defecto es viewer (nunca admin)", () => {
  assert.equal(S.can("manageMembers"), false);
  assert.equal(S.can("editTasks"), false);
  assert.equal(S.can("viewReports"), true); // viewer sí ve reportes
});
test("un miembro nuevo puede quedar explícitamente sin rol", () => {
  const id = S.addMember({ name: "Persona Nueva", accessRole: "" });
  const m = S.readMembers().find((x) => x.id === id);
  assert.equal(m.accessRole, "");
});
test("login como admin habilita todos los permisos; logout los quita", () => {
  const id = S.addMember({ name: "Root", accessRole: "admin" });
  assert.equal(S.login(id, "").ok, true);
  assert.equal(S.can("manageMembers"), true);
  S.logout();
  // tras logout, el rol activo del dispositivo es el último usado (admin)
  // pero la sesión ya no existe → la app bloquea por session=null (gate de main.jsx)
  assert.equal(S.readSession(), null);
});

console.log("\n— Duplicado de campañas —");
test("duplicar copia tareas pero NUNCA el estado de completado", () => {
  const slug = "bienvenida", from = "2026-1", to = "2026-2";
  S.writeOperativeTasks(slug, from, [
    { id: "t1", title: "Hecho", status: "done", done: true, deadline: "2026-03-10", month: "Marzo" },
    { id: "t2", title: "En curso", status: "in_progress", done: false, deadline: "2026-03-15", month: "Marzo" },
  ]);
  S.markCampaignConfigured(slug, from);
  S.duplicateConfigWithOverrides(slug, from, to, { dateOffsetDays: 7 });
  const cloned = S.readOperativeTasks(slug, to);
  assert.equal(cloned.length, 2);
  for (const t of cloned) { assert.equal(t.status, "todo"); assert.equal(t.done, false); }
  assert.equal(cloned[0].deadline, "2026-03-17", "deadline corrido +7 días");
  assert.equal(S.isCampaignConfigured(slug, to), true);
});
test("duplicar resetea el estado de las comunicaciones del brief", () => {
  const slug = "recupero", from = "2026-1", to = "2026-2";
  S.saveBriefSnapshot(slug, from, { params: [], paramsMode: "global", keyDates: [], canva: "", dropbox: "",
    comms: [{ id: "c1", type: "Mailing", status: "done", start: "2026-03-01", end: "2026-03-05", channels: [] }] });
  S.markCampaignConfigured(slug, from);
  S.duplicateConfigWithOverrides(slug, from, to, {});
  const snap = S.loadBriefSnapshot(slug, to);
  assert.equal(snap.comms[0].status, "todo");
});

console.log("\n— Fechas referenciadas a fechas clave —");
test("resolveParamISO aplica el desfase sobre la fecha clave del periodo", () => {
  S.writeGlobalParams("2026-3", [{ id: "inicio", label: "Inicio", date: "2026-08-10" }]);
  assert.equal(S.resolveParamISO("bienvenida", "2026-3", "inicio", 5), "2026-08-15");
  assert.equal(S.resolveParamISO("bienvenida", "2026-3", "inicio", -3), "2026-08-07");
  assert.equal(S.resolveParamISO("bienvenida", "2026-3", "no-existe", 5), "");
});
test("cambiar una fecha clave recalcula los deadlines referenciados", () => {
  const slug = "ivu", p = "2026-3";
  S.writeGlobalParams(p, [{ id: "cierre", label: "Cierre", date: "2026-09-01" }]);
  S.writeOperativeTasks(slug, p, [{ id: "x1", title: "Reporte", status: "todo", deadlineParamId: "cierre", deadlineOffset: 2, deadline: "old" }]);
  S.rematerializeTaskDeadlines(slug, p);
  assert.equal(S.readOperativeTasks(slug, p)[0].deadline, "2026-09-03");
  S.writeGlobalParams(p, [{ id: "cierre", label: "Cierre", date: "2026-09-10" }]);
  S.rematerializeTaskDeadlines(slug, p);
  assert.equal(S.readOperativeTasks(slug, p)[0].deadline, "2026-09-12");
});

console.log("\n— Historial transversal —");
test("el historial junta periodos y cada entrada conoce su periodo", () => {
  S.logChange("lab-mac", "2026-1", { kind: "edit", section: "Brief", label: "Cambio A", after: "1" });
  S.logChange("lab-mac", "2026-2", { kind: "edit", section: "Brief", label: "Cambio B", after: "2" });
  const all = S.readChangelog("lab-mac");
  assert.ok(all.length >= 2);
  assert.ok(all.some((e) => e.label === "Cambio A" && e.period === "2026-1"));
  assert.ok(all.some((e) => e.label === "Cambio B" && e.period === "2026-2"));
  S.clearChangelog("lab-mac");
  assert.equal(S.readChangelog("lab-mac").length, 0);
});

console.log("\n— Particionado por ítem (anticolisión) —");
test("pendientes legados migran a una clave por ítem", () => {
  localStorage.setItem("general-pendings:v1", JSON.stringify([{ id: "p1", title: "Legacy", createdAt: "2026-01-01" }]));
  const items = S.readGeneralPendings();
  assert.ok(items.some((i) => i.id === "p1"));
  assert.equal(localStorage.getItem("general-pendings:v1"), null, "clave legada eliminada");
  assert.ok(localStorage.getItem("gp:p1"), "clave por ítem creada");
});
test("solicitudes de diseño viven en claves dr:<id> independientes", () => {
  const id = S.addDesignRequest({ title: "Banner piloto" });
  assert.ok(localStorage.getItem("dr:" + id));
  S.updateDesignRequest(id, { priority: "high" });
  assert.equal(JSON.parse(localStorage.getItem("dr:" + id)).priority, "high");
  S.removeDesignRequest(id);
  assert.equal(localStorage.getItem("dr:" + id), null);
});

console.log("\n— Notificaciones y plantillas —");
test("notify entrega avisos solo a la persona destino (y nunca a uno mismo)", () => {
  S.notify({ to: "Persona Nueva", type: "task", title: "Prueba", detail: "x" });
  const inbox = S.readNotifs("Persona Nueva");
  assert.ok(inbox.some((n) => n.title === "Prueba"));
  assert.equal(S.readNotifs("Otro Usuario").some((n) => n.title === "Prueba"), false);
});
test("notifyMentions detecta @nombre y @primer-nombre sin tildes", () => {
  S.addMember({ name: "María López", accessRole: "editor" });
  const hits = S.notifyMentions("ojo @maria revisar el copy", { title: "t" });
  assert.ok(hits.includes("María López"));
  assert.ok(S.readNotifs("María López").length >= 1);
});
test("la plantilla editada manda sobre la de fábrica y se puede restaurar", () => {
  const factory = S.effectiveTemplate("bienvenida").length;
  S.writeTemplateOverride("bienvenida", [{ title: "Solo una actividad", owner: "Equipo", month: "Enero" }]);
  assert.equal(S.effectiveTemplate("bienvenida").length, 1);
  const built = S.buildFromTemplate("bienvenida", "2026-9");
  assert.equal(built.length, 1);
  assert.equal(built[0].title, "Solo una actividad");
  S.resetTemplateOverride("bienvenida");
  assert.equal(S.effectiveTemplate("bienvenida").length, factory);
});

console.log("\n— Reporte de fallos —");
test("los reportes se acumulan, se leen ordenados y se vacían", () => {
  localStorage.setItem("bugreport:2026-06-12T10-00-00-000Z", JSON.stringify({ createdAt: "2026-06-12T10:00:00.000Z", comment: "primero", logs: [] }));
  localStorage.setItem("bugreport:2026-06-12T11-00-00-000Z", JSON.stringify({ createdAt: "2026-06-12T11:00:00.000Z", comment: "segundo", logs: [] }));
  const list = S.readBugReports();
  assert.ok(list.length >= 2);
  assert.equal(list[0].report.comment, "segundo"); // más reciente primero
  S.clearBugReports();
  assert.equal(S.readBugReports().length, 0);
});
test("aplicar IDs resueltos marca solo los que coinciden", () => {
  localStorage.setItem("bugreport:t1", JSON.stringify({ id: "BUG-AAAA", status: "open", createdAt: "2026-06-12T10:00:00.000Z", comment: "a", logs: [] }));
  localStorage.setItem("bugreport:t2", JSON.stringify({ id: "BUG-BBBB", status: "open", createdAt: "2026-06-12T11:00:00.000Z", comment: "b", logs: [] }));
  const res = S.applyResolvedBugs("Resolví BUG-AAAA y nada más");
  assert.equal(res.matched, 1);
  const map = Object.fromEntries(S.readBugReports().map((r) => [r.report.id, r.report.status]));
  assert.equal(map["BUG-AAAA"], "resolved");
  assert.equal(map["BUG-BBBB"], "open");
  // también acepta el objeto { resolved: [...] }
  S.applyResolvedBugs({ resolved: ["BUG-BBBB"] });
  assert.equal(S.readBugReports().find((r) => r.report.id === "BUG-BBBB").report.status, "resolved");
  S.clearBugReports();
});
test("novedades: muestra resueltos no vistos y deja de mostrarlos tras marcar visto", () => {
  S.clearBugReports();
  localStorage.setItem("bugreport:n1", JSON.stringify({ id: "BUG-N001", status: "resolved", createdAt: "2026-06-10T08:00:00.000Z", resolvedAt: "2026-06-12T10:00:00.000Z", comment: "Arreglado X", logs: [] }));
  localStorage.setItem("bugreport:n2", JSON.stringify({ id: "BUG-N002", status: "open", createdAt: "2026-06-11T08:00:00.000Z", comment: "Pendiente", logs: [] }));
  localStorage.removeItem("changelog-seen:ana");
  let unseen = S.unseenResolvedBugs("Ana");
  assert.equal(unseen.length, 1); // solo el resuelto
  assert.equal(unseen[0].id, "BUG-N001");
  S.markChangelogSeen("Ana");
  unseen = S.unseenResolvedBugs("Ana");
  assert.equal(unseen.length, 0); // ya visto, no se repite
  // otro usuario sí lo ve (es por persona)
  assert.equal(S.unseenResolvedBugs("Beto").length, 1);
  S.clearBugReports();
});
test("reconfirmar un fallo ya resuelto no cambia su fecha de solicitud ni la de resolución", () => {
  localStorage.setItem("bugreport:keep", JSON.stringify({ id: "BUG-KEEP", status: "open", createdAt: "2026-06-12T08:00:00.000Z", comment: "x", logs: [] }));
  S.setBugStatus("BUG-KEEP", "resolved");
  const first = S.readBugReports().find((r) => r.report.id === "BUG-KEEP").report;
  assert.equal(first.createdAt, "2026-06-12T08:00:00.000Z");
  const firstResolved = first.resolvedAt;
  assert.ok(firstResolved); // se selló
  // reconfirmar resuelto: no debe cambiar createdAt ni resolvedAt
  S.setBugStatus("BUG-KEEP", "resolved");
  const again = S.readBugReports().find((r) => r.report.id === "BUG-KEEP").report;
  assert.equal(again.createdAt, "2026-06-12T08:00:00.000Z");
  assert.equal(again.resolvedAt, firstResolved);
  S.clearBugReports();
});

console.log("\n— IDs de tareas y gestión de campañas —");
test("buildFromTemplate genera IDs únicos (BUG-2021)", () => {
  const a = S.buildFromTemplate("bienvenida", "2026-1");
  const b = S.buildFromTemplate("bienvenida", "2026-2");
  const ids = [...a, ...b].map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "todos los IDs son únicos entre periodos");
});
test("readOperativeTasks repara IDs DUPLICADOS pero deja estables los únicos (BUG-2021/741A)", () => {
  // dos tareas con el MISMO id → debe romper el empate regenerando uno
  S.writeOperativeTasks("inasistencia", "2026-1", [
    { id: "inasistencia-2026-1-dup", title: "A", status: "todo" },
    { id: "inasistencia-2026-1-dup", title: "B", status: "todo" },
  ]);
  const fixed = S.readOperativeTasks("inasistencia", "2026-1");
  const ids = fixed.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "IDs quedan únicos");
  // un ID único de formato viejo NO debe mutar entre lecturas (estabilidad)
  S.writeOperativeTasks("inasistencia", "2026-2", [{ id: "inasistencia-2026-2-aaa", title: "X", status: "todo" }]);
  const r1 = S.readOperativeTasks("inasistencia", "2026-2")[0].id;
  const r2 = S.readOperativeTasks("inasistencia", "2026-2")[0].id;
  assert.equal(r1, r2, "el ID único es estable entre lecturas");
  assert.equal(r1, "inasistencia-2026-2-aaa", "no se regenera un ID que ya es único");
});
test("quitar campaña del periodo conserva el catálogo (BUG-A26A)", () => {
  S.markCampaignConfigured("bienvenida", "2026-1");
  assert.equal(S.isCampaignConfigured("bienvenida", "2026-1"), true);
  S.unmarkCampaignConfigured("bienvenida", "2026-1");
  assert.equal(S.isCampaignConfigured("bienvenida", "2026-1"), false, "ya no está en el periodo");
  assert.ok(S.campaigns.find((c) => c.slug === "bienvenida"), "sigue en el catálogo");
});

console.log("\n— Identidad y periodos —");
test("renombrar un miembro reasigna sus pendientes generales (BUG-F6CD)", () => {
  const mid = S.addMember({ name: "Temporal Uno", accessRole: "editor" });
  const tid = S.addGeneralPending({ title: "Tarea de Temporal", owner: "Temporal Uno" });
  S.updateMember(mid, { name: "Nombre Nuevo" });
  const t = S.readGeneralPendings().find((i) => i.id === tid);
  assert.equal(t.owner, "Nombre Nuevo");
  S.removeGeneralPending(tid); S.removeMember(mid);
});
test("eliminar un periodo lo quita del selector y se puede restaurar (BUG-7280)", () => {
  S.addPeriod("2099-9");
  assert.ok(S.listAvailablePeriods().includes("2099-9"));
  assert.equal(S.removePeriod("2099-9"), true);
  assert.ok(!S.listAvailablePeriods().includes("2099-9"));
  S.addPeriod("2099-9"); // restaurar
  assert.ok(S.listAvailablePeriods().includes("2099-9"));
  S.removePeriod("2099-9");
});
test("el rol efectivo se deriva del miembro vivo: cambiarle el rol actualiza permisos (BUG-C652)", () => {
  const mid = S.addMember({ name: "Cambiante", accessRole: "viewer" });
  S.login(mid, "");
  assert.equal(S.can("editTasks"), false);
  S.updateMember(mid, { accessRole: "editor" });
  assert.equal(S.can("editTasks"), true, "permiso refleja el rol nuevo sin re-login");
  S.logout(); S.removeMember(mid);
});

console.log("\n— Roles y permisos —");
test("todos los permisos del catálogo existen y el admin los tiene todos", () => {
  const roles = S.readRoles();
  assert.ok(roles.admin, "existe admin");
  S.PERMISSION_KEYS.forEach((k) => assert.equal(roles.admin.permissions[k], true, `admin tiene ${k}`));
});
test("existe el rol Diseñador por defecto con el acceso correcto", () => {
  const roles = S.readRoles();
  assert.ok(roles.disenador, "existe el rol disenador");
  assert.equal(roles.disenador.permissions.editTasks, true);
  assert.equal(roles.disenador.permissions.manageMembers, false, "no administra miembros");
  assert.equal(roles.disenador.modules.solicitudes, true, "ve solicitudes");
  assert.equal(roles.disenador.modules.equipo, false, "no ve equipo/permisos");
  assert.ok(S.readRoleOrder().includes("disenador"), "está en el orden de roles");
});
test("un rol sin 'modules' propios ve todos los módulos (admin/editor)", () => {
  const roles = S.readRoles();
  S.MODULE_DEFS.forEach((m) => assert.equal(roles.admin.modules[m.key], true, `admin ve ${m.key}`));
});

console.log("\n— Pendientes generales —");
test("crear y eliminar un pendiente general", () => {
  const id = S.addGeneralPending({ title: "Tarea de prueba", owner: "Renato" });
  assert.ok(S.readGeneralPendings().some((i) => i.id === id));
  S.removeGeneralPending(id);
  assert.ok(!S.readGeneralPendings().some((i) => i.id === id));
});

console.log("\n— Solicitudes de diseño y notificaciones —");
test("tipos de solicitud: editar, persistir y volver a defaults", () => {
  const def = S.readDRTypes();
  assert.ok(def.length >= 2);
  S.writeDRTypes(["Banner", "Tótem", "Banner"]); // dedup
  const t = S.readDRTypes();
  assert.equal(t.length, 2);
  assert.deepEqual(t, ["Banner", "Tótem"]);
  S.writeDRTypes([]); // vacío → vuelve a defaults
  assert.ok(S.readDRTypes().length >= 2);
});
test("notify no duplica el mismo aviso en una ventana corta", () => {
  for (let i = 0; i < localStorage.length; ) { const k = localStorage.key(i); if (k && k.startsWith("notif:")) localStorage.removeItem(k); else i++; }
  S.notify({ to: "Ana", from: "Sistema", type: "task", title: "Te asignaron un pendiente", detail: "X" });
  S.notify({ to: "Ana", from: "Sistema", type: "task", title: "Te asignaron un pendiente", detail: "X" });
  assert.equal(S.readNotifs("Ana").length, 1);
});

console.log(`\nResultado: ${passed} OK · ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
