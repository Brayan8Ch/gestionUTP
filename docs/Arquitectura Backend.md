# Arquitectura Backend — ERP de Retención UTP

> Especificación técnica lista para implementar. El prototipo actual persiste en
> `localStorage` con el mismo modelo conceptual; migrar es mapear estas tablas 1:1.

## 1. Stack recomendado

| Capa | Recomendación | Justificación |
|---|---|---|
| Base de datos | **PostgreSQL 16** | Relacional, JSONB para snapshots de brief, índices parciales, `row_level_security` |
| API | **Node.js + NestJS** (o Laravel 11) | Capas explícitas (controller → service → repository), DTOs tipados, guards de autorización |
| Auth | Sesiones con cookie `HttpOnly` + `SameSite=Lax`, o OIDC corporativo (Azure AD de UTP) | CSRF mitigado por diseño; mínimo privilegio por rol |
| Jobs | BullMQ / colas Redis | Reportes, resúmenes ejecutivos programados, recordatorios |
| Caché | Redis (lecturas de dashboards) | Los dashboards agregan muchas filas; TTL corto (30–60 s) |

## 2. Modelo de datos (normalizado)

```
users(id PK, name, cargo, status, auth_provider_id, created_at)
roles(id PK, key UNIQUE, label, description, is_system)
permissions(id PK, key UNIQUE, label, grupo)
role_permissions(role_id FK, permission_id FK, PK(role_id, permission_id))
user_roles(user_id FK, role_id FK)

periods(id PK, code UNIQUE p.ej. '2026-1', starts_on, ends_on)
campaigns(id PK, slug UNIQUE, title, description, icon, accent, is_builtin, deleted_at)

campaign_periods(id PK, campaign_id FK, period_id FK,
                 status ENUM(draft|pending|approved),
                 responsable_id FK users, supervisor_id FK users,
                 approved_by FK users, approved_at,
                 sched_start, sched_end, plan_lead_days,
                 canva_url, dropbox_url,
                 UNIQUE(campaign_id, period_id))

global_params(id PK, period_id FK, param_key, label, date)        -- fechas base del periodo
briefs(id PK, campaign_period_id FK UNIQUE, snapshot JSONB, updated_at)
brief_versions(id PK, brief_id FK, version_no, state JSONB, created_by FK, created_at)
key_dates(id PK, brief_id FK, label, param_key, offset_days, duration_days)

comms(id PK, campaign_period_id FK, type, objective, owner_id FK,
      start_date, end_date, days SMALLINT[], status)
comm_channels(comm_id FK, channel, days SMALLINT[] NULL)          -- días por canal

tasks(id PK, campaign_period_id FK NULL, title, owner_id FK,
      status ENUM(todo|in_progress|blocked|done), priority, deadline, month,
      created_at, updated_at)                                      -- NULL = pendiente general
task_updates(id PK, task_id FK, type ENUM(progress|block|risk|change|done|comment),
             text, user_id FK, created_at)

design_requests(id PK, title, description, type, priority, deadline,
                requester_id FK, designer_id FK, status, locked, created_at)
dr_deliveries(id PK, request_id FK, url, note, delivered_by FK, created_at)
dr_log(id PK, request_id FK, kind, detail JSONB, user_id FK, created_at)

audit_log(id BIGSERIAL PK, entity_type, entity_id, action,
          before JSONB, after JSONB, user_id FK, ip INET, created_at)
```

**Índices clave:** `tasks(campaign_period_id, status)`, `tasks(owner_id) WHERE status != 'done'`,
`tasks(deadline) WHERE status != 'done'` (parcial → alertas de atraso baratas),
`audit_log(entity_type, entity_id, created_at DESC)`, `comms(campaign_period_id)`.

## 3. Trazabilidad (pilar nº 1)

- **`audit_log` append-only** poblado por triggers `AFTER INSERT/UPDATE/DELETE` en cada
  tabla de negocio: guarda `before`/`after` como JSONB diff. Responde "¿quién hizo qué,
  cuándo y por qué?" en una consulta indexada.
- `brief_versions` conserva snapshots completos (equivale al "Comparar versión anterior" actual).
- Logs por entidad (`task_updates`, `dr_log`) se mantienen como hoy: timeline visible en UI.
- Particionar `audit_log` por mes cuando supere ~10 M filas.

## 4. API `/api/v1` — convenciones

- REST predecible: `GET/POST /campaign-periods/:id/tasks`, `PATCH /tasks/:id`, etc.
- **Paginación en toda lista**: `?cursor=&limit=` (cursor-based, estable bajo inserciones).
- Respuestas tipadas y uniformes: `{ data, meta }` | errores `{ error: { code, message, fields? } }`.
- Versionado por prefijo de ruta; cambios incompatibles → `/v2` con periodo de convivencia.
- Endpoints agregados para dashboards (`GET /v1/periods/:code/summary`) calculados en
  servidor + caché Redis, no N llamadas desde el cliente.

## 5. Seguridad

- **Autorización por rol en cada endpoint** (guard `@RequirePermission('editTasks')`),
  espejo exacto de los 11 permisos del RBAC actual del frontend.
- Validación/sanitización en DTOs (class-validator / zod); salida escapada → sin XSS.
- CSRF: cookies `SameSite` + token doble para mutaciones desde navegador.
- Secretos en variables de entorno / vault; jamás en el repo.
- Rate limiting en login; bloqueo progresivo; hash de claves con argon2id.
- `security_log` separado (logins, cambios de permisos, exportaciones).

## 6. Escalabilidad y mantenimiento

- Migraciones versionadas (Prisma Migrate / TypeORM migrations) en CI.
- Jobs en segundo plano: generación nocturna del **resumen ejecutivo**, recordatorios de
  deadlines (automatización del seguimiento diario), reportes PDF.
- Módulos nuevos = nuevo par tabla + módulo NestJS; nada existente se reescribe.
- Documentación OpenAPI generada del código; convenciones en `CONTRIBUTING.md`.
