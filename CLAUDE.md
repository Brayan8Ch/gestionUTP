# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

App ERP del equipo de Retención UTP: campañas, briefs, pendientes operativos,
solicitudes de diseño, equipo y resumen ejecutivo. Piloto en Supabase free + Netlify.

- Producción: https://campanas-utp.netlify.app
- **Sin framework de bundling por módulos**: IIFEs que publican en `window`,
  concatenadas en un bundle por `build.mjs` (esbuild). No hay imports ES entre
  módulos de `app/`; la comunicación es vía `window.Store`, `window.<Componente>`.
- **El orden de carga importa** y vive en DOS manifests que deben coincidir:
  `build.mjs` (const SCRIPTS) e `index.html` (manifest de `RemoteSync.boot([])`).
  Si agregás/movés un archivo, actualizá AMBOS.

## Comandos

```bash
npm install                  # solo la primera vez (borrar node_modules antes de empaquetar)
npm run build                # compila a dist/app/app.bundle.js

# Validación antes de empaquetar (OBLIGATORIO):
npm run verify               # build + lint-gate + tests + smoke-boot + smoke-prod + smoke-screens

# Individuales para depurar:
npm run lint                 # ESLint crudo
npm run lint:gate            # falla solo ante errores NUEVOS vs tests/eslint-baseline.json
npm run lint:baseline        # regenera baseline (solo tras corregir deuda conocida)
node tests/run-tests.mjs     # lógica del store
node tests/smoke-boot.mjs    # la app monta (jsdom)
node tests/smoke-prod.mjs    # rutas clave en modo producción con datos vacíos
node tests/smoke-screens.mjs # monta las ~15 pantallas con datos — detecta pantallas blancas
```

**Dev local**: la app requiere un servidor HTTP (módulos bloqueados con `file://`).
Usá `python3 -m http.server` o cualquier static server desde la raíz del proyecto.

**Validar sintaxis** tras cada edición:
```bash
# .jsx
node -e "require('@babel/core').transformSync(require('fs').readFileSync('app/<carpeta>/X.jsx','utf8'),{presets:['@babel/preset-react'],filename:'X.jsx'})"
# .js
node --check app/<carpeta>/X.js
```

## Arquitectura

### Modos de ejecución

La app tiene dos modos según `app/config.js`:

| Variable | Valor | Modo |
|---|---|---|
| `SUPABASE_URL` vacía | — | Local: todo en `localStorage`, datos demo al iniciar |
| `SUPABASE_URL` presente | `https://...` | Producción: login Supabase Auth, estado compartido en Postgres |

La detección en runtime es `window.RemoteSync?.enabled` o `window.APP_CONFIG?.SUPABASE_URL`.
El store usa esto para decidir si carga campañas demo o arranca vacío.

### Capa de sincronización (`sync.js`)

`RemoteSync` es el núcleo de producción. Antes de montar React:
1. Exige login Supabase (email + contraseña).
2. Descarga `app_state` de Postgres e hidrata `localStorage`.
3. Parchea `Storage.prototype.setItem/removeItem` globalmente: toda escritura a `localStorage` se replica a Supabase con debounce.
4. Se suscribe a Realtime para refrescar `localStorage` cuando otro usuario cambia algo y dispara los eventos internos del store.
5. Carga los scripts de `app/` dinámicamente (con Babel standalone para `.jsx`) recién cuando los datos están listos.

Claves que NO se sincronizan (son por dispositivo/usuario):
- `session:v1`, `current-role:v1`, `current-period:v1`
- `sidebar-collapsed:v1`, `brief-reader-mode:v1`, `exec-timer:v1`
- `module-usage:v1`, `notif-read:v1`, `backup-last:v1`
- Cualquier clave que empiece con `sb-` (tokens internos de Supabase)

### Store (`core/store.js`)

`window.Store` expone TODA la persistencia y lógica de dominio. Se comunica con la UI mediante `useSyncExternalStore` + `CustomEvent` en `window`. Al escribir en el store, siempre se dispara el evento correspondiente para refrescar los hooks activos.

Hooks activos para suscribirse a cambios: prefijo `use` (ej. `useCampaigns`, `useGeneralPendings`).
Lecturas directas sin suscripción: prefijo `read` (ej. `readMembers`).

### CSS / diseño

- **Tailwind vía CDN** con config extendida en `index.html` (custom tokens de color, sombras, easing).
- Tokens de color en `oklch()`, definidos como variables CSS `--c-*` en `:root` y `html.dark`.
- Clases de material **Liquid Glass**: `glass`, `glass-panel`, `glass-tile`, `glass-tile-active`.
- Modo oscuro: clase `dark` en `<html>`, controlada por `app-theme` en `localStorage` (`"dark"` / `"light"` / `"auto"`). Se aplica ANTES de pintar para evitar flash (inline script en `index.html`).
- El kit de UI vive en `core/ui.jsx`: `Button`, `Input`, `Checkbox`, `Popover`, `LucideIcon`, `toast`, `cn`.

## Estructura de carpetas (app/)

```
app/
├── config.js            # claves Supabase (se edita sin rebuild; va suelto a dist)
├── sync.js              # RemoteSync: login, hidratación, interceptor, realtime
├── bugreport.js         # widget de reporte de fallos (DOM puro, sin React)
├── core/
│   ├── templates.js     # plantillas de campañas builtin (CHECKLIST_TEMPLATES)
│   ├── store.js         # ★ TODA la persistencia y lógica de dominio
│   ├── ui.jsx           # kit de UI compartido
│   └── main.jsx         # router por hash (#/…) + arranque (__boot)
├── shell/               # marco común (navbar, login, search, notificaciones…)
├── campanas/            # ciclo de vida de una campaña (brief, comms, gantt…)
├── operativa/           # trabajo diario (checklist, pendientes, solicitudes…)
└── configuracion/       # equipo, fechas, ayuda, fallos
```

## Reglas duras

1. **Nunca editar `dist/`**: se regenera con `npm run build`.
2. **Producción arranca vacía**: sin datos demo. `smoke-prod.mjs` lo vigila.
3. **Fechas siempre en hora Perú** al mostrar: `toLocaleString("es-PE", { timeZone: "America/Lima" })`. Internamente se guarda ISO/UTC.
4. **Identidad**: la sesión guarda `memberId`; nombre y rol se DERIVAN del miembro vivo (`currentRoleKey()`). Nunca cachear nombre/rol aparte. Renombrar dispara `migrateOwnerName`.
5. **Permisos**: `S.useCan("permKey")` para acciones; `S.useModuleGate()` para navegación. El admin siempre tiene todo.
6. **Confirmaciones destructivas**: usar `window.ConfirmDelete` (props: `title`, `message`, `confirmLabel`, `onClose`, `onConfirm`).
7. **Notificaciones**: `notify` deduplica avisos idénticos en <8s; no saltárselo.
8. **Al terminar**: `npm run verify` debe salir con exit 0 antes de empaquetar. Si el lint-gate o smoke-screens falla, corregir primero.

## API de window.Store — agrupada

- **Periodos**: `formatPeriodLabel/Short`, `listAvailablePeriods`, `useAvailablePeriods`, `addPeriod`, `removePeriod`, `useCurrentPeriod`, `useSelectedPeriods`, `writeSelectedPeriods`
- **Campañas**: `campaigns`, `useCampaigns`, `createCampaign`, `updateCampaign`, `removeCampaign`, `getCampaignStatus`, `useCampaignStatus`, `setApproval`, `touchCampaign`, `readCampaignLinks/writeCampaignLinks/useCampaignLinks`, `effectiveTemplate`, `writeTemplateOverride`, `resetTemplateOverride`, `useTemplates`, `buildFromTemplate`
- **Config campaña×periodo**: `isCampaignConfigured`, `markCampaignConfigured`, `unmarkCampaignConfigured`, `duplicateCampaignConfig`, `duplicateConfigWithOverrides`, `createBlankCampaignConfig`, `useConfigured`, `readConfigMeta/writeConfigMeta/useConfigMeta`
- **Brief**: `defaultParams`, `defaultKeyDates`, `loadBriefSnapshot`, `saveBriefSnapshot`, `readComms`, `readGlobalParams/writeGlobalParams/useGlobalParams`, `activeBriefParams`, `resolveParamISO`, `shiftISO`, `rematerializeTaskDeadlines`, `rematerializeComms`, `readBriefVersions`, `useBriefVersions`, `exportCampaignData`, `importCampaignData`, `readChangelog/logChange/useChangelog`
- **Speech**: `useArgs`, `readArgs`, `addArg`, `updateArg`, `removeArg`, `readSpeech`, `writeSpeech`, `useSpeech`
- **Tareas operativas**: `readOperativeTasks`, `writeOperativeTasks`, `useOperativeChecklist`, `useOperativeProgress`
- **Pendientes generales**: `readGeneralPendings`, `useGeneralPendings` (hook con `.add/.update/.remove`), `addGeneralPending`, `removeGeneralPending`, `usePendingOrigins/readPendingOrigins/writePendingOrigins`
- **Solicitudes de diseño**: `DR_STATUS`, `DR_STATUS_ORDER`, `DR_PRIORITY`, `DR_LOG_KINDS`, `readDRTypes/writeDRTypes/useDRTypes`, `useDesignRequests`, `readDesignRequests`, `getDesignRequest`, `addDesignRequest`, `updateDesignRequest`, `removeDesignRequest`, `setDRLocked`, `setDRStatus`, `addDRDelivery`, `addDRReview`, `cancelDR`, `reactivateDR`, `nextDRNum`
- **Notificaciones**: `notify`, `readNotifs`, `useNotifs`, `markNotifsSeen`, `notifyMentions`
- **Reporte de fallos**: `readBugReports`, `useBugReports`, `removeBugReport`, `clearBugReports`, `setBugStatus`, `applyResolvedBugs`, `unseenResolvedBugs/markChangelogSeen`
- **Miembros y roles**: `useMembers`, `readMembers`, `addMember`, `updateMember`, `removeMember`, `useRoles`, `rolesList`, `readRoles`, `readRoleOrder`, `setRolePermission`, `updateRoleMeta`, `addRole`, `removeRole`, `resetRoles`, `PERMISSIONS`, `PERMISSION_KEYS`, `MODULE_DEFS`, `setRoleModule`, `canModule`, `useModuleGate`, `can`, `useCan`, `useCurrentRole`
- **Sesión**: `useSession`, `readSession`, `login(memberId, clave)`, `logout`, `useLoginSettings`, `sessionClaveInfo`, `verifySessionClave`, `currentUserName`
- **Utilidades**: `uuid`, `seedDemo`, `UPDATE_LABELS`, `DEFAULT_PERIODS`, `TEMPLATES`

## Ciclo de bugs (con Renato)

1. Llega un bloque `reporte-fallos-bloque-*.json` (kind `bug-report-batch`).
2. Diagnosticar cada `BUG-XXXX` por su `comment` + `hash` + `logs` (errores JS primero).
3. Cambios quirúrgicos → validar sintaxis → build + pruebas + humos.
4. Empaquetar zip con `1-DESPLEGAR-ESTA-CARPETA` (dist) y `2-codigo-fuente-NO-desplegar`.
5. Generar `resueltos-<fecha>-loteN.json` con `{resolved:[…], detalle:{…}}`.

## Trampas conocidas

- `useSyncExternalStore`: el snapshot debe codificar TODO lo que importa (id+estado), no solo cantidades — si no, la UI no se refresca (BUG-4447).
- Componentes grandes (`CommandCenterBody`, `MisPendientes`) son funciones LARGAS: al insertar JSX verificá en qué función caés; una variable de la página no existe dentro del subcomponente (BUG-E37E/7734).
- El brief abre en **modo Lector** por defecto: inputs bloqueados a propósito.
- `readRoles` normaliza siempre (permisos completos + módulos); roles de sistema nuevos se inyectan sin pisar los guardados.
- `sync.js` parchea `Storage.prototype` globalmente: cualquier `localStorage.setItem` (incluso de terceros) pasa por el interceptor.
