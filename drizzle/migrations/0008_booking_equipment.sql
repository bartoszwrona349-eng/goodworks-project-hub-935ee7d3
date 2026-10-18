ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS equipment_other text;