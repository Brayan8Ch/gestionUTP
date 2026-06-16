# CLAUDE.md — Campañas · Workspace UTP

Guía para trabajar en este proyecto. Léela antes de tocar código.
App ERP del equipo de Retención UTP: campañas, briefs, pendientes operativos,
solicitudes de diseño, equipo y resumen ejecutivo. Piloto en Supabase free + Netlify.

- Producción: https://campanas-utp.netlify.app
- Sin framework de bundling por módulos: **IIFEs que publican en `window`**,
  concatenadas en un bundle por `build.mjs` (esbuild). No hay imports ES entre
  módulos de `app/`; la comunicación es vía `window.Store`, `window.<Componente>`.
- El **orden de carga importa** y vive en DOS manifests que deben coincidir:
  `build.mjs` (const SCRIPTS) e `index.html` (manifest de arranque).
  Si agregas/mueves un archivo, actualiza AMBOS.

## Estructura de carpetas (app/)

```
app/
├── config.js            # claves Supabase (se edita sin rebuild; va suelto a dist)
├── sync.js              # RemoteSync: replica el estado a Supabase con realtime
├── bugreport.js         # reporte de fallos (DOM puro, sin React; suelto a dist)
├── core/                # cimientos — cargar SIEMPRE primero
│   ├── templates.js     # plantillas de campañas builtin
│   ├── store.js         # ★ TODA la persistencia y lógica de dominio (ver API abajo)
│   ├── ui.jsx           # kit de UI: Button, Input, Checkbox, Popover, LucideIcon, toast, cn…
│   └── main.jsx         # router por hash (#/…) y arranque (__boot)
├── shell/               # marco común de la app
│   ├── menu.jsx         # Inicio/dashboard (métricas por rol, WhatsNewPopup "Mientras no estabas")
│   ├── navbar.jsx       # barra lateral + móvil
│   ├── login.jsx        # selector de miembro + clave
│   ├── profile.jsx      # Avatar, ProfileModal (onboarding/edición de perfil)
│   ├── notifications.jsx# campana de avisos (NotifBell)
│   ├── search.jsx       # búsqueda global Ctrl+K
│   ├── period-filter.jsx# selector multi-periodo
│   └── confirm-delete.jsx # window.ConfirmDelete (modal de confirmación destructiva)
├── campanas/            # ciclo de vida de una campaña
│   ├── home.jsx         # grilla de campañas por periodo
│   ├── setup.jsx        # habilitar campaña en un periodo (duplicar/desde cero)
│   ├── create.jsx       # crear campaña custom
│   ├── brief.jsx        # secciones del brief (params, fechas clave, comms, hitos)
│   ├── brief2.jsx       # página del brief (modo Lector/Edición, prompt configurar)
│   ├── brief-pdf.js     # exportar brief a PDF
│   ├── comms.jsx        # cronograma de comunicaciones
│   ├── speech.jsx       # argumentario/speech por campaña
│   ├── updates.jsx      # historial de cambios del brief
│   ├── gantt.jsx        # gantt de fechas clave
│   └── cronograma-campanas.jsx # vista cronograma multi-campaña
├── operativa/           # trabajo del día a día
│   ├── checklist.jsx    # ★ Centro de operaciones (tabla, filtros, selección masiva,
│   │                    #   QuickAdd, TaskTrackingModal, vistas guardadas, OriginSwitch)
│   ├── mis-pendientes.jsx # vista personal (prioridades, tabla, DesignItem para diseños)
│   ├── day-planner.jsx  # organizador del día (drag de pendientes a horario)
│   ├── design-requests.jsx # Solicitudes de diseño (tarjetas #Nro, timeline, perspectivas)
│   └── resumen.jsx      # resumen ejecutivo
└── configuracion/
    ├── members.jsx      # Equipo: miembros, roles, permisos por rol, módulos por rol
    ├── fechas.jsx       # fechas parámetro del periodo (+ crear/eliminar periodo)
    ├── ayuda.jsx        # documentación
    └── bug-reports-page.jsx # #/configuracion/fallos: lista, marcar resueltos, exportar
```

## Comandos

```bash
npm install                  # primera vez (luego BORRAR node_modules antes de empaquetar)
npm run build                # compila a dist/app/app.bundle.js (sello hora Perú + ?v= cache-busting)

# ───── VALIDACIÓN ESTRICTA (build crítico) ─────
npm run verify               # ★ TODO: build + lint-gate + pruebas + 2 humos + smoke-screens. CORRER ANTES DE EMPAQUETAR.

# componentes individuales (si se quiere depurar uno):
npm run lint                 # ESLint crudo (muestra todos los errores/warnings)
npm run lint:gate            # falla solo ante errores NUEVOS vs tests/eslint-baseline.json
npm run lint:baseline        # regenera el baseline (SOLO tras corregir deuda real conocida)
node tests/run-tests.mjs     # batería de lógica del store (todas deben pasar)
node tests/smoke-boot.mjs    # la app monta (jsdom)
node tests/smoke-prod.mjs    # rutas clave montan en modo PRODUCCIÓN con datos en cero
node tests/smoke-screens.mjs # ★ monta las 15 pantallas con datos y detecta pantallas blancas
```

**Por qué el lint-gate:** atrapa la clase de bug que da pantalla blanca — variable usada
antes de declararse (temporal dead zone, p.ej. una var en deps de useMemo declarada después),
hook condicional, clave duplicada, variable inexistente. El build con esbuild NO detecta esto.
El gate compara contra un baseline de deuda conocida (patrones IIFE que funcionan) y falla SOLO
ante errores nuevos. **El smoke-screens** es la red final: monta cada ruta y si alguna queda en
blanco o lanza error, falla. Entre los dos, un pantallazo blanco no vuelve a llegar a producción.

Validar sintaxis tras cada edición:
- `.jsx`: `node -e "require('@babel/core').transformSync(require('fs').readFileSync('app/<carpeta>/X.jsx','utf8'),{presets:['@babel/preset-react'],filename:'X.jsx'})"`
- `.js`: `node --check app/<carpeta>/X.js`

## Reglas duras

1. **Nunca editar `dist/`** ni el bundle: se regeneran con `npm run build`.
2. **Producción nace vacía**: catálogo/brief/fechas/resumen sin datos demo.
   `smoke-prod.mjs` lo vigila. No reintroducir contenido precargado.
3. **Fechas SIEMPRE en hora Perú** al mostrar: `toLocaleString("es-PE", { timeZone: "America/Lima", … })`.
   Internamente se guarda ISO/UTC. El sello de build se muestra en hora Perú.
4. **Identidad**: la sesión guarda `memberId`; nombre y rol se DERIVAN del miembro
   vivo (`currentRoleKey()` dentro del store). Nunca cachear nombre/rol aparte.
   Renombrar a alguien dispara `migrateOwnerName` (reasigna tareas, diseños, metas).
5. **Permisos**: `S.useCan("permKey")` para acciones; `S.useModuleGate()` para
   navegación. El admin siempre tiene todo. Roles de sistema: admin, editor,
   disenador, viewer (se inyectan a datos viejos vía `normalizeRoles`).
6. **Confirmaciones destructivas**: usar `window.ConfirmDelete` (props: title,
   message, confirmLabel, onClose, onConfirm).
7. **Notificaciones**: `notify` ya deduplica avisos idénticos en <8s; no salteárselo.
8. **Al terminar (OBLIGATORIO en build crítico)**: correr `npm run verify` y que pase
   COMPLETO (exit 0) ANTES de empaquetar el zip. Si el lint-gate marca un error nuevo o
   el smoke-screens reporta una pantalla en blanco, NO empaquetar: corregir primero.
   El zip solo se genera sobre código que pasó `verify`.

## API de window.Store (core/store.js) — agrupada

- **Periodos**: formatPeriodLabel/Short, listAvailablePeriods, useAvailablePeriods,
  addPeriod, removePeriod, useCurrentPeriod, useSelectedPeriods, writeSelectedPeriods
- **Campañas**: campaigns (array vivo), useCampaigns, createCampaign, updateCampaign,
  removeCampaign, getCampaignStatus, useCampaignStatus, setApproval, touchCampaign,
  readCampaignLinks/writeCampaignLinks/useCampaignLinks, effectiveTemplate,
  writeTemplateOverride, resetTemplateOverride, useTemplates, buildFromTemplate
- **Configuración por campaña×periodo**: isCampaignConfigured, markCampaignConfigured,
  unmarkCampaignConfigured, getConfiguredPeriods, getPreviousConfiguredPeriod,
  duplicateCampaignConfig, duplicateConfigWithOverrides, createBlankCampaignConfig,
  useConfigured, readConfigMeta/writeConfigMeta/useConfigMeta
- **Brief**: defaultParams, defaultKeyDates, loadBriefSnapshot, saveBriefSnapshot,
  readComms, readGlobalParams/writeGlobalParams/useGlobalParams/hasGlobalParams,
  activeBriefParams, resolveParamISO, shiftISO, rematerializeTaskDeadlines,
  rematerializeComms, readBriefVersions, useBriefVersions,
  exportCampaignData, importCampaignData, readChangelog/logChange/useChangelog
- **Speech/Argumentario**: useArgs, readArgs, addArg, updateArg, removeArg,
  readSpeech, writeSpeech, useSpeech
- **Tareas operativas (por campaña×periodo)**: readOperativeTasks, writeOperativeTasks,
  useOperativeChecklist, useOperativeProgress
- **Pendientes generales**: readGeneralPendings, useGeneralPendings (hook con
  .add/.update/.remove), addGeneralPending, removeGeneralPending,
  usePendingOrigins/readPendingOrigins/writePendingOrigins (categorías: Comité de
  retención, Daily, Gerencia, Ad hoc…)
- **Solicitudes de diseño**: DR_STATUS, DR_STATUS_ORDER, DR_PRIORITY, DR_LOG_KINDS,
  readDRTypes/writeDRTypes/useDRTypes, useDesignRequests, readDesignRequests,
  getDesignRequest, addDesignRequest, updateDesignRequest, removeDesignRequest,
  setDRLocked, setDRStatus, addDRDelivery, addDRReview, cancelDR, reactivateDR, nextDRNum
- **Notificaciones**: notify, readNotifs, useNotifs, markNotifsSeen, notifyMentions
- **Reporte de fallos**: readBugReports, useBugReports, removeBugReport,
  clearBugReports, setBugStatus (idempotente; sella resolvedAt una vez),
  applyResolvedBugs (acepta IDs sueltos o {resolved:[…]}),
  unseenResolvedBugs/markChangelogSeen (popup "Mientras no estabas", por usuario)
- **Miembros y roles**: useMembers, readMembers, addMember,
  updateMember (si cambia name → migrateOwnerName en cascada), removeMember,
  useRoles, rolesList, readRoles, readRoleOrder, setRolePermission, updateRoleMeta,
  addRole, removeRole, resetRoles, PERMISSIONS, PERMISSION_KEYS, MODULE_DEFS,
  setRoleModule, canModule, useModuleGate, can, useCan, useCurrentRole
- **Sesión**: useSession, readSession, login(memberId, clave), logout,
  useLoginSettings, sessionClaveInfo, verifySessionClave, currentUserName
- **Utilidades**: uuid, seedDemo, UPDATE_LABELS, DEFAULT_PERIODS, TEMPLATES

## Ciclo de bugs (con Renato)

1. Llega un bloque `reporte-fallos-bloque-*.json` (kind bug-report-batch).
2. Diagnosticar cada `BUG-XXXX` por su comment + hash + logs (errores JS primero).
3. Cambios quirúrgicos → validar sintaxis → build + pruebas + humos.
4. Empaquetar `/mnt/user-data/outputs/campanas-piloto.zip`
   (carpetas `1-DESPLEGAR-ESTA-CARPETA` = dist y `2-codigo-fuente-NO-desplegar`).
5. Generar `resueltos-<fecha>-loteN.json` con {resolved:[…], detalle:{…}} para
   subir en "Marcar resueltos". Lo no terminado va en pendientes_a_afinar.

## Trampas conocidas

- `useSyncExternalStore`: el snapshot debe codificar TODO lo que importa (id+estado),
  no solo cantidades — si no, la UI no se refresca (caso BUG-4447).
- Los componentes grandes (CommandCenterBody, MisPendientes) son funciones LARGAS:
  al insertar JSX verifica en QUÉ función caes; una variable de la página no existe
  dentro del subcomponente (caso pantalla blanca BUG-E37E/7734).
- El brief abre en **modo Lector** por defecto: inputs bloqueados a propósito.
- `readRoles` normaliza siempre (permisos completos + módulos); roles de sistema
  nuevos se inyectan sin pisar los guardados.
