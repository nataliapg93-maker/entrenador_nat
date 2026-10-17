-- Natalia Fit AI — esquema inicial
-- Pegar entero en Supabase: SQL Editor -> New query -> Run

-- ---------------------------------------------------------------
-- 1. PERFIL Y OBJETIVOS DIARIOS
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  target_kcal    numeric not null default 1537,
  target_protein numeric not null default 141,
  target_carbs   numeric not null default 147,
  target_fat     numeric not null default 43,
  timezone       text    not null default 'Europe/Madrid',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. COMIDAS
-- ---------------------------------------------------------------
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  eaten_at   timestamptz not null default now(),
  meal_type  text not null default 'comida'
             check (meal_type in ('desayuno','comida','cena','snack')),
  name       text not null,
  notes      text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  kcal       numeric not null default 0 check (kcal    >= 0),
  protein    numeric not null default 0 check (protein >= 0),
  carbs      numeric not null default 0 check (carbs   >= 0),
  fat        numeric not null default 0 check (fat     >= 0),
  photo_path text,
  source     text not null default 'foto' check (source in ('foto','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meals_user_eaten_idx on public.meals (user_id, eaten_at desc);

-- ---------------------------------------------------------------
-- 3. INGREDIENTES DE CADA COMIDA
-- ---------------------------------------------------------------
create table if not exists public.meal_ingredients (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals (id) on delete cascade,
  position   int  not null default 0,
  name       text not null,
  grams      numeric not null default 0 check (grams   >= 0),
  kcal       numeric not null default 0 check (kcal    >= 0),
  protein    numeric not null default 0 check (protein >= 0),
  carbs      numeric not null default 0 check (carbs   >= 0),
  fat        numeric not null default 0 check (fat     >= 0),
  confidence numeric check (confidence >= 0 and confidence <= 1),
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists meal_ingredients_meal_idx on public.meal_ingredients (meal_id, position);

-- ---------------------------------------------------------------
-- 4. PESO CORPORAL
-- ---------------------------------------------------------------
create table if not exists public.weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  kg          numeric not null check (kg > 0 and kg < 400),
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

create index if not exists weights_user_date_idx on public.weights (user_id, measured_on desc);

-- ---------------------------------------------------------------
-- 5. updated_at AUTOMATICO
-- ---------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists meals_touch on public.meals;
create trigger meals_touch before update on public.meals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 6. CREAR PERFIL AL REGISTRARSE
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 7. TOTALES POR DIA — esto sustituye al contador que sumaba todo
-- ---------------------------------------------------------------
create or replace view public.daily_totals
with (security_invoker = on) as
select
  m.user_id,
  (m.eaten_at at time zone coalesce(p.timezone, 'Europe/Madrid'))::date as day,
  count(*)                      as meal_count,
  round(sum(m.kcal))::int       as kcal,
  round(sum(m.protein))::int    as protein,
  round(sum(m.carbs))::int      as carbs,
  round(sum(m.fat))::int        as fat
from public.meals m
left join public.profiles p on p.id = m.user_id
group by m.user_id, 2;

-- ---------------------------------------------------------------
-- 8. SEGURIDAD POR FILA
-- ---------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.meals            enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.weights          enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists meals_own on public.meals;
create policy meals_own on public.meals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists weights_own on public.weights;
create policy weights_own on public.weights
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Los ingredientes heredan el dueno de su comida
drop policy if exists meal_ingredients_own on public.meal_ingredients;
create policy meal_ingredients_own on public.meal_ingredients
  for all to authenticated
  using (
    exists (select 1 from public.meals m
            where m.id = meal_ingredients.meal_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.meals m
            where m.id = meal_ingredients.meal_id and m.user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 9. FOTOS DE COMIDA — bucket privado
--    Ruta obligatoria: <user_id>/<lo-que-sea>.jpg
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists meal_photos_own on storage.objects;
create policy meal_photos_own on storage.objects
  for all to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
