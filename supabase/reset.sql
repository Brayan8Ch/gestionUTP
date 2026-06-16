-- =====================================================================
-- REINICIO DE DATOS (Fase 1) — ejecutar en Supabase → SQL Editor
--
-- Vacía TODO el estado compartido de la app para empezar de cero:
-- sin campañas configuradas, sin tareas, sin pendientes, sin miembros.
-- Las tablas, la seguridad y el realtime quedan intactos (no hace falta
-- volver a correr schema.sql). Las cuentas de Authentication NO se tocan.
--
-- ⚠️ IRREVERSIBLE: borra los datos de trabajo actuales. Úsalo solo para
-- el arranque limpio o para descartar datos de prueba.
-- =====================================================================

begin;

-- 1) Vaciar el estado compartido.
truncate table public.app_state;

-- 2) Centinela: marca la base como inicializada. Evita que un navegador
--    con datos viejos en localStorage los "migre" de vuelta a la nube
--    (esa migración automática solo aplica a bases totalmente vírgenes).
insert into public.app_state (key, value)
values ('app:initialized', extract(epoch from now())::text);

commit;

-- 3) OPCIONAL — descomenta si también quieres borrar el historial de
--    auditoría acumulado durante las pruebas:
-- truncate table public.app_state_audit;
