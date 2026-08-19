CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  admin_pin TEXT NOT NULL DEFAULT '9898',
  till_number TEXT NOT NULL DEFAULT '3367738',
  paybill_number TEXT NOT NULL DEFAULT '4211224',
  gateway_enabled BOOLEAN NOT NULL DEFAULT false,
  commission_per_ten NUMERIC NOT NULL DEFAULT 1.5,
  withdraw_threshold NUMERIC NOT NULL DEFAULT 10,
  float_balance NUMERIC NOT NULL DEFAULT 850,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (id) VALUES (1);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  purchases INT NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id TEXT NOT NULL,
  offer_title TEXT NOT NULL,
  service TEXT NOT NULL,
  price NUMERIC NOT NULL,
  commission NUMERIC NOT NULL DEFAULT 0,
  payment_phone TEXT NOT NULL,
  receiving_phone TEXT NOT NULL,
  for_self BOOLEAN NOT NULL DEFAULT true,
  gateway_enabled BOOLEAN NOT NULL DEFAULT false,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  checkout_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE INDEX sales_created_at_idx ON public.sales (created_at DESC);

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;