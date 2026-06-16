/* =====================================================================
   Build de producción — genera la carpeta `dist/` lista para desplegar.

   Qué hace:
   1. Compila todos los .jsx a JavaScript plano (esbuild) y los concatena
      con los .js en el MISMO orden de arranque, en un solo bundle
      minificado: dist/app/app.bundle.js
   2. Genera dist/index.html con React en modo PRODUCCIÓN y sin Babel
      (el navegador ya no compila nada → carga 3-5× más rápida).
   3. Copia config.js, sync.js, supabase/ y README a dist/.

   Uso:    npm install   (solo la primera vez)
           npm run build
   Luego despliega la carpeta `dist/` (arrástrala a Netlify).
   ===================================================================== */
import { build, transformSync } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

/* Mismo orden que el manifest de arranque de index.html. */
const SCRIPTS = [
  "app/core/templates.js", "app/core/store.js", "app/campanas/brief-pdf.js",
  "app/core/ui.jsx", "app/shell/profile.jsx", "app/shell/notifications.jsx", "app/shell/search.jsx", "app/shell/period-filter.jsx", "app/shell/confirm-delete.jsx",
  "app/campanas/setup.jsx", "app/campanas/create.jsx", "app/shell/menu.jsx", "app/shell/navbar.jsx", "app/shell/login.jsx",
  "app/configuracion/members.jsx", "app/configuracion/fechas.jsx", "app/campanas/gantt.jsx", "app/campanas/cronograma-campanas.jsx",
  "app/campanas/home.jsx", "app/campanas/brief.jsx", "app/campanas/comms.jsx", "app/campanas/updates.jsx", "app/campanas/brief2.jsx",
  "app/campanas/speech.jsx", "app/operativa/checklist.jsx", "app/operativa/design-requests.jsx", "app/operativa/day-planner.jsx",
  "app/operativa/mis-pendientes.jsx", "app/operativa/resumen.jsx", "app/configuracion/ayuda.jsx", "app/configuracion/bug-reports-page.jsx", "app/core/main.jsx",
];

console.log("→ Compilando", SCRIPTS.length, "módulos…");
/* Sello de build en hora de Perú (UTC-5, sin horario de verano). El VID de
   cache-busting se deriva del instante UTC para que siga siendo creciente. */
const NOW = new Date();
const PE = new Date(NOW.getTime() - 5 * 60 * 60 * 1000); // UTC-5
const pad = (n) => String(n).padStart(2, "0");
const BUILD = `${PE.getUTCFullYear()}-${pad(PE.getUTCMonth() + 1)}-${pad(PE.getUTCDate())} ${pad(PE.getUTCHours())}:${pad(PE.getUTCMinutes())} (hora Perú)`;
let bundle = `window.APP_BUILD=${JSON.stringify(BUILD)};\n`;
for (const rel of SCRIPTS) {
  const code = readFileSync(join(root, rel), "utf8");
  const out = rel.endsWith(".jsx")
    ? transformSync(code, { loader: "jsx", jsx: "transform" }).code
    : code;
  bundle += `\n/* ===== ${rel} ===== */\n` + out + "\n";
}
const min = transformSync(bundle, { minify: true, target: "es2019" }).code;

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "app"), { recursive: true });
writeFileSync(join(dist, "app/app.bundle.js"), min);
console.log(`→ Bundle: ${(min.length / 1024).toFixed(0)} KB (antes: ${(bundle.length / 1024).toFixed(0)} KB sin minificar)`);

/* config.js y sync.js van sueltos (config se edita sin rebuild). */
cpSync(join(root, "app/config.js"), join(dist, "app/config.js"));
cpSync(join(root, "app/sync.js"), join(dist, "app/sync.js"));
cpSync(join(root, "app/bugreport.js"), join(dist, "app/bugreport.js"));
cpSync(join(root, "supabase"), join(dist, "supabase"), { recursive: true });
if (existsSync(join(root, "README-PRODUCCION.md"))) cpSync(join(root, "README-PRODUCCION.md"), join(dist, "README-PRODUCCION.md"));

/* index.html de producción: React production, sin Babel, bundle único. */
let html = readFileSync(join(root, "index.html"), "utf8");
html = html.replace(/<script src="https:\/\/unpkg\.com\/react@18\.3\.1\/umd\/react\.development\.js"[^>]*><\/script>/,
  '<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>');
html = html.replace(/<script src="https:\/\/unpkg\.com\/react-dom@18\.3\.1\/umd\/react-dom\.development\.js"[^>]*><\/script>/,
  '<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>');
html = html.replace(/\s*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^>]*><\/script>/, "");
html = html.replace(/RemoteSync\.boot\(\[[\s\S]*?\]\);/,
  'RemoteSync.boot(["app/app.bundle.js"]);');
if (!html.includes("app.bundle.js")) { console.error("✘ No se pudo reescribir el manifest de arranque"); process.exit(1); }

/* Cache-busting: cada build estampa ?v=<id> en los scripts propios, así el
   navegador JAMÁS puede servir una versión vieja del código tras un deploy. */
const VID = NOW.toISOString().replace(/[^0-9]/g, "").slice(0, 12);
html = html
  .replace('src="app/config.js"', `src="app/config.js?v=${VID}"`)
  .replace('src="app/bugreport.js"', `src="app/bugreport.js?v=${VID}"`)
  .replace('src="app/sync.js"', `src="app/sync.js?v=${VID}"`)
  .replace('RemoteSync.boot(["app/app.bundle.js"]);', `RemoteSync.boot(["app/app.bundle.js?v=${VID}"]);`);
writeFileSync(join(dist, "index.html"), html);

/* Netlify: el index nunca se cachea (siempre trae las URLs versionadas frescas);
   los assets versionados pueden cachearse al máximo sin riesgo. */
writeFileSync(join(dist, "_headers"),
`/index.html
  Cache-Control: no-cache, must-revalidate
/
  Cache-Control: no-cache, must-revalidate
/app/*
  Cache-Control: public, max-age=31536000
`);

console.log("✔ dist/ lista. Despliega esa carpeta (con config.js ya configurado).");
