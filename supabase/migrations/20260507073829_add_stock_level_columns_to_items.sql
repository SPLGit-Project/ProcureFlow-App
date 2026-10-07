ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS min_level integer,
  ADD COLUMN IF NOT EXISTS max_level integer;;
