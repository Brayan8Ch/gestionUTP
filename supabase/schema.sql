-- =====================================================================
-- Esquema de producción (Fase 1) — ejecutar en Supabase → SQL Editor
-- Crea la tabla de estado compartido, activa seguridad por filas (RLS)
-- y habilita Realtime para sincronización en vivo entre usuarios.
-- =====================================================================

create table if not exists public.app_state (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references auth.users (id)
);

comment on table public.app_state is
  'Estado compartido de la app Campañas (clave→valor JSON). Fase 1 de migración: espejo del modelo localStorage. Fase 2: normalizar según docs/Arquitectura Backend.md';

-- Seguridad: SOLO usuarios autenticados pueden leer/escribir.
-- La clave "anon" del navegador no puede tocar nada sin sesión válida.
alter table public.app_state enable row level security;

drop policy if exists "authenticated_select" on public.app_state;
drop policy if exists "authenticated_insert" on public.app_state;
drop policy if exists "authenticated_update" on public.app_state;
drop policy if exists "authenticated_delete" on public.app_state;

create policy "authenticated_select" on public.app_state
  for select to authenticated using (true);

create policy "authenticated_insert" on public.app_state
  for insert to authenticated with check (true);

create policy "authenticated_update" on public.app_state
  for update to authenticated using (true) with check (true);

create policy "authenticated_delete" on public.app_state
  for delete to authenticated using (true);

-- Mantener updated_at/updated_by al día automáticamente.
create or replace function public.app_state_touch()
returns trigger language plpgsql security definer as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch
  before insert or update on public.app_state
  for each row execute function public.app_state_touch();

-- Realtime: emitir cambios a los clientes conectados.
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- Trazabilidad mínima (auditoría append-only de la Fase 1).
-- Registra quién cambió qué clave y cuándo, con el valor anterior.
-- =====================================================================
create table if not exists public.app_state_audit (
  id          bigserial primary key,
  key         text not null,
  action      text not null,           -- INSERT | UPDATE | DELETE
  old_value   text,
  new_value   text,
  user_id     uuid,
  created_at  timestamptz not null default now()
);

alter table public.app_state_audit enable row level security;

drop policy if exists "authenticated_read_audit" on public.app_state_audit;
create policy "authenticated_read_audit" on public.app_state_audit
  for select to authenticated using (true);
-- (sin políticas de escritura: solo el trigger inserta)

create or replace function public.app_state_audit_fn()
returns trigger language plpgsql security definer as $$
begin
  insert into public.app_state_audit (key, action, old_value, new_value, user_id)
  values (
    coalesce(new.key, old.key),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then old.value end,
    case when tg_op in ('INSERT','UPDATE') then new.value end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

drop trigger if exists app_state_audit_trg on public.app_state;
create trigger app_state_audit_trg
  after insert or update or delete on public.app_state
  for each row execute function public.app_state_audit_fn();

create index if not exists app_state_audit_key_idx
  on public.app_state_audit (key, created_at desc);
