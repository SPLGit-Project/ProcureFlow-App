alter table public.suppliers
add column if not exists contacts jsonb not null default '[]'::jsonb;
