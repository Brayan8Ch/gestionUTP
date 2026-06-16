#!/usr/bin/env node
/* ============================================================================
   Gate de análisis estático (ESLint) para build crítico.

   Corre ESLint sobre app/ y compara los ERRORES contra un baseline de errores
   ya conocidos (tests/eslint-baseline.json). Falla SOLO si aparece un error
   NUEVO — esto atrapa regresiones como "variable usada antes de declararse"
   (el bug execTick que dio pantalla blanca) sin obligar a refactorizar los
   patrones heredados que hoy funcionan.

   - Errores nuevos       → FALLA (exit 1). No se debe empaquetar.
   - Errores del baseline → se toleran (deuda conocida).
   - Si se ARREGLA deuda  → avisa que se puede regenerar el baseline.

   Regenerar baseline (tras corregir deuda real):
       node tests/eslint-gate.mjs --update
   ============================================================================ */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASELINE_PATH = join(__dirname, "eslint-baseline.json");
const UPDATE = process.argv.includes("--update");

function norm(msg) { return String(msg).replace(/\d+/g, "#"); }

function runEslint() {
  let raw;
  try {
    raw = execSync('npx eslint "app/**/*.{js,jsx}" -f json', { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    // ESLint sale con código !=0 cuando hay errores; el JSON viene igual en stdout.
    raw = e.stdout ? e.stdout.toString() : "";
  }
  if (!raw.trim()) { console.error("✘ ESLint no produjo salida. ¿Está instalado? (npm install)"); process.exit(2); }
  return JSON.parse(raw);
}

function collectErrors(data) {
  const map = {};
  const detail = {};
  for (const f of data) {
    const path = f.filePath.split("/campanas/").pop();
    for (const m of f.messages || []) {
      if (m.severity !== 2) continue;
      const key = `${path}|${m.ruleId}|${norm(m.message)}`;
      map[key] = (map[key] || 0) + 1;
      (detail[key] = detail[key] || []).push(`${path}:${m.line}:${m.column}  ${m.message}`);
    }
  }
  return { map, detail };
}

const data = runEslint();
const { map: current, detail } = collectErrors(data);

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(`✓ Baseline actualizado: ${total} errores conocidos registrados.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};

// Errores NUEVOS: claves presentes ahora que no estaban (o aumentaron en conteo).
const newErrors = [];
for (const [key, count] of Object.entries(current)) {
  const allowed = baseline[key] || 0;
  if (count > allowed) {
    // tomar las instancias que exceden el baseline
    const extra = count - allowed;
    newErrors.push(...detail[key].slice(0, extra));
  }
}

// Errores del baseline que ya NO aparecen (deuda arreglada): solo informativo.
const fixed = [];
for (const [key, count] of Object.entries(baseline)) {
  const now = current[key] || 0;
  if (now < count) fixed.push(`${key.split("|")[0]}  (${key.split("|")[1]})  ×${count - now}`);
}

const totalCurrent = Object.values(current).reduce((a, b) => a + b, 0);
const totalBaseline = Object.values(baseline).reduce((a, b) => a + b, 0);

console.log(`Análisis estático (ESLint): ${totalCurrent} errores · baseline conocido: ${totalBaseline}`);

if (fixed.length) {
  console.log(`\n✓ Se corrigieron ${fixed.length} tipo(s) de deuda del baseline:`);
  fixed.slice(0, 10).forEach((f) => console.log("   - " + f));
  console.log("   → Cuando termines, regenera el baseline: node tests/eslint-gate.mjs --update");
}

if (newErrors.length) {
  console.error(`\n✘ ${newErrors.length} ERROR(es) NUEVO(s) — no presentes en el baseline:`);
  newErrors.forEach((e) => console.error("   ✘ " + e));
  console.error("\nEstos errores son regresiones (p. ej. variable usada antes de declararse,");
  console.error("hook condicional, clave duplicada). Corrígelos antes de empaquetar.");
  console.error("Si por excepción son aceptables, regenera el baseline con --update.");
  process.exit(1);
}

console.log("\n✓ Sin errores nuevos respecto al baseline. Gate de análisis estático superado.");
process.exit(0);
