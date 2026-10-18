ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS rules text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rules_accepted_at timestamptz;