/* =====================================================================
   Humo PRODUCCIÓN — arranca el bundle como si hubiera config de Supabase
   (catálogo de campañas vacío, fechas parámetro vacías) y navega por las
   páginas clave verificando que nada reviente con listas en cero.
   Ejecutar:  node tests/smoke-prod.mjs   (requiere npm install previo)
   ===================================================================== */
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
window.localStorage = { getItem:(k)=>mem.has(k)?mem.get(k):null, setItem:(k,v)=>mem.set(k,String(v)), removeItem:(k)=>mem.delete(k), key:(i)=>[...mem.keys()][i]??null, get length(){return mem.size;} };

const errors = [];
window.addEventListener("error", (e) => errors.push(e.message || String(e.error)));

const run = (p) => window.eval(readFileSync(join(ROOT, p), "utf8"));
run("node_modules/react/umd/react.production.min.js");
run("node_modules/react-dom/umd/react-dom.production.min.js");
window.lucide = { icons: {} };
/* Config "de producción" (URL presente → PROD true). El boot de RemoteSync
   NO se invoca: evaluamos el bundle directo, como hace boot tras el login. */
window.APP_CONFIG = { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_ANON_KEY: "sb_test", APP_TITLE: "t" };
run("dist/app/bugreport.js");
run("dist/app/sync.js");
run("dist/app/app.bundle.js");

const ROUTES = ["#/", "#/campanas/brief", "#/campanas/cronograma-comms", "#/campanas/cronograma-campanas", "#/configuracion/fechas", "#/operativa/centro", "#/campanas/speechs", "#/configuracion/equipo"];
let step = 0;

setTimeout(() => {
  const S = window.Store;
  if (S.campaigns.length !== 0) { console.error("✘ PROD debería arrancar SIN campañas precargadas, hay:", S.campaigns.length); process.exit(1); }
  const period = S.listAvailablePeriods()[0];
  if (S.readGlobalParams(period).length !== 0) { console.error("✘ PROD debería arrancar SIN fechas parámetro precargadas"); process.exit(1); }
  console.log("OK   catálogo y fechas arrancan vacíos en producción");
  const id = S.addMember({ name: "Piloto Test", accessRole: "admin" });
  S.login(id, "");
  const next = () => {
    if (step >= ROUTES.length) {
      if (errors.length) { console.error("✘ errores capturados:", errors); process.exit(1); }
      console.log("✅ Humo PRODUCCIÓN: " + ROUTES.length + " rutas montaron sin errores con datos en cero");
      process.exit(0);
    }
    const r = ROUTES[step++];
    window.location.hash = r;
    setTimeout(() => {
      const len = window.document.getElementById("root").innerHTML.length;
      if (errors.length) { console.error("✘ error en", r, "→", errors); process.exit(1); }
      if (len < 50) { console.error("✘ pantalla vacía en", r); process.exit(1); }
      console.log("OK  ", r, "·", len, "chars");
      next();
    }, 350);
  };
  setTimeout(next, 400);
}, 1200);
