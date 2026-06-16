-- =====================================================================
-- LIMPIEZA OPERATIVA (selectiva) — ejecutar en Supabase → SQL Editor
--
-- Borra TODOS los datos operativos (campañas configuradas, briefs,
-- tareas, pendientes, solicitudes, historiales, notificaciones,
-- fechas de periodo) pero CONSERVA:
--   · Miembros del equipo, perfiles, fotos y correos vinculados
--   · Roles y permisos personalizados
--   · Plantillas de checklist editadas
--   · Catálogo de campañas (creadas/editadas/ocultas)
--
-- Úsala cuando quieres arrancar la operación en cero sin recrear al
-- equipo. ⚠️ Irreversible: exporta un respaldo antes si tienes dudas.
-- IMPORTANTE: despliega la versión más reciente de la app ANTES de
-- correr esto (la versión nueva purga los espejos locales sola).
-- =====================================================================

begin;

delete from public.app_state
where key not in (
  'app:initialized',
  'members:v1',
  'roles:v1',
  'role-order:v1',
  'login-settings:v1',
  'custom-campaigns:v1',
  'campaign-overrides:v1',
  'removed-campaigns:v1',
  'checklist-templates:v1'
);

-- Asegurar el centinela (bloquea re-migraciones de navegadores con datos viejos)
insert into public.app_state (key, value)
values ('app:initialized', extract(epoch from now())::text)
on conflict (key) do nothing;

commit;

-- Verificación: estas deben ser las únicas claves restantes (más el centinela)
select key from public.app_state order by key;
