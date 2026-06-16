/* ============================================================================
   Smoke EXHAUSTIVO de pantallas — navega por TODAS las rutas de la app con
   datos sembrados y falla si alguna no renderiza o lanza un error de runtime.

   Red de seguridad contra "pantallas blancas": el bug execTick (variable usada
   antes de declararse) tumbaba el cronograma de comms; este smoke lo detecta
   porque la pantalla queda vacía o lanza error.

   Sigue el patrón probado de smoke-prod.mjs: UNA sola instancia jsdom, se
   navega cambiando window.location.hash, y se espera el render entre rutas.
   Carga el bundle DEV compilado para ver errores reales (no minificados).
   ============================================================================ */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, {
  url: "https://x.test/#/", runScripts: "outside-only", pretendToBeVisual: true,
});
const { window } = dom;
global.window = window; global.document = window.document;
const mem = new Map();
window.localStorage = { getItem: (k) => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear(), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

const errors = [];
window.addEventListener("error", (e) => errors.push(e.error ? (e.error.message) : e.message));
window.console.error = (...a) => {
  const s = a.map(String).join(" ");
  if (/not wrapped in act|useLayoutEffect does nothing/.test(s)) return;
  errors.push("console.error: " + s.slice(0, 240));
};

const run = (p) => window.eval(readFileSync(join(ROOT, p), "utf8"));
run("node_modules/react/umd/react.development.js");
run("node_modules/react-dom/umd/react-dom.development.js");
window.lucide = { icons: {} };

run("dist/app/bugreport.js");
run("dist/app/sync.js");
run("dist/app/app.bundle.js");

const ROUTES = [
  "#/",
  "#/campanas/brief",
  "#/campanas/speech",
  "#/campanas/argumentario",
  "#/campanas/cronograma-comms",
  "#/campanas/cronograma-campanas",
  "#/operativa/centro",
  "#/operativa/pendiente",
  "#/operativa/solicitudes",
  "#/operativa/resumen",
  "#/configuracion/equipo",
  "#/configuracion/fechas",
  "#/configuracion/ayuda",
  "#/configuracion/fallos",
  "#/brief/__SLUG__?p=2025-3",
];

let step = 0, pass = 0, fail = 0;
const failures = [];

setTimeout(() => {
  const S = window.Store;
  const mid = S.addMember({ name: "Smoke Tester", accessRole: "admin" });
  S.login(mid, "");
  const slug = S.campaigns[0] ? S.campaigns[0].slug : "cobranza";
  const period = "2025-3";
  S.markCampaignConfigured(slug, period);
  S.saveBriefSnapshot(slug, period, {
    params: [{ id: "start", label: "Inicio", date: "2025-09-01" }, { id: "close", label: "Cierre", date: "2025-10-15" }],
    keyDates: [], canva: "", dropbox: "",
    comms: [{ id: "c1", type: "Test comm", channels: ["Mail", "SMS"], start: "2025-09-01", end: "2025-09-30", days: [1, 3, 5], objective: "x", owner: "Smoke Tester", status: "todo" }],
  });
  S.writeOperativeTasks(slug, period, [{ id: `${slug}-${period}-aaa`, title: "Tarea smoke", owner: "Smoke Tester", status: "todo", done: false }]);

  const next = () => {
    if (step >= ROUTES.length) {
      console.log(`\nSmoke de pantallas: ${pass} OK · ${fail} fallidas (${ROUTES.length} rutas)`);
      if (fail) {
        console.error("\n✘ PANTALLAS QUE NO MONTAN:");
        failures.forEach((f) => console.error(`   ${f.hash}\n     ${f.reason}`));
        process.exit(1);
      }
      console.log("✓ Todas las pantallas montan sin crashear.");
      process.exit(0);
    }
    const hash = ROUTES[step++].replace("__SLUG__", slug);
    errors.length = 0;
    window.location.hash = hash;
    setTimeout(() => {
      const len = window.document.getElementById("root").innerHTML.length;
      if (errors.length) { fail++; failures.push({ hash, reason: "error runtime: " + errors.slice(0, 2).join(" | ") }); process.stdout.write(`  x ${hash}\n`); }
      else if (len < 200) { fail++; failures.push({ hash, reason: `pantalla casi vacia (${len} chars)` }); process.stdout.write(`  x ${hash}\n`); }
      else { pass++; process.stdout.write(`  ok ${hash}  (${len} chars)\n`); }
      next();
    }, 350);
  };
  setTimeout(next, 400);
}, 1200);
