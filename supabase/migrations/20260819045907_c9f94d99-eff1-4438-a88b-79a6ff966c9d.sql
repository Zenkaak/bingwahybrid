ALTER TABLE public.app_settings
  ADD COLUMN activated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN activated_at TIMESTAMPTZ;