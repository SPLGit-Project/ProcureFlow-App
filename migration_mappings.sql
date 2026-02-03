-- Create a table to store migration memory
create table if not exists public.migration_mappings (
    id uuid not null default uuid_generate_v4() primary key,
    excel_variant text not null, -- The raw text from the Excel file (e.g. "PART-123")
    item_id uuid not null references public.items(id) on delete cascade,
    site_id uuid references public.sites(id) on delete cascade, -- Optional: Scope to a site
    confidence_score float default 1.0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Ensure unique mapping per variant (per site constraint optional, keeping simple for now)
    constraint migration_mappings_unique_variant unique (excel_variant)
);

-- RLS Policies
alter table public.migration_mappings enable row level security;

create policy "Enable read access for all users" on public.migration_mappings
    for select using (true);

create policy "Enable insert access for all users" on public.migration_mappings
    for insert with check (true);

create policy "Enable update access for all users" on public.migration_mappings
    for update using (true);
