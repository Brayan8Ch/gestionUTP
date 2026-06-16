/* Reproducción del arranque de dist/ en un navegador simulado */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, {
  url: "https://app-piloto.netlify.app/#/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
global.window = window; global.document = window.document;

// localStorage simulado
const mem = new Map();
window.localStorage = { getItem:k=>mem.has(k)?mem.get(k):null, setItem:(k,v)=>mem.set(k,String(v)), removeItem:k=>mem.delete(k), key:i=>[...mem.keys()][i]??null, get length(){return mem.size;} };

const run = (path, label) => {
  try { window.eval(readFileSync(path, "utf8")); console.log("OK  ", label); }
  catch (e) { console.error("💥 FALLO en", label, "→", e.message, "\n", (e.stack||"").split("\n").slice(0,4).join("\n")); process.exit(1); }
};

// React/ReactDOM UMD de producción (los mismos que el CDN)
run(join(ROOT, "node_modules/react/umd/react.production.min.js"), "react");
run(join(ROOT, "node_modules/react-dom/umd/react-dom.production.min.js"), "react-dom");
// lucide ausente a propósito (probar resiliencia) → stub mínimo
window.lucide = { icons: {} };
// config del usuario PERO vacío para forzar MODO LOCAL (sin red): el crash de UI se reproduce igual
window.APP_CONFIG = { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", APP_TITLE: "Campañas · UTP" };
run(join(ROOT, "dist/app/bugreport.js"), "bugreport");
run(join(ROOT, "dist/app/sync.js"), "sync");
// el boot en modo local carga los scripts vía <script> dinámico; aquí lo hacemos directo:
run(join(ROOT, "dist/app/app.bundle.js"), "app.bundle (ejecución completa)");

// dar tiempo a efectos/render
setTimeout(() => {
  const root = window.document.getElementById("root");
  const html = root ? root.innerHTML : "";
  console.log("root renderizado:", html.length, "caracteres");
  if (html.length < 50) { console.error("💥 PANTALLA EN BLANCO REPRODUCIDA — root vacío"); process.exit(1); }
  console.log("✅ La app montó contenido. Muestra:", html.slice(0, 120).replace(/\s+/g," "));
  process.exit(0);
}, 1500);
