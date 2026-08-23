CREATE TABLE IF NOT EXISTS public.deals (
  id text PRIMARY KEY,
  group_key text NOT NULL,
  title text NOT NULL,
  price numeric NOT NULL,
  validity text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS mpesa_receipt text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS result_desc text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS business_name text NOT NULL DEFAULT 'BLACK HOLE BINGWA SERVICES';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS support_phone text NOT NULL DEFAULT '0769252572';

INSERT INTO public.deals (id, group_key, title, price, validity, note, sort_order) VALUES
  ('bd55','bingwa','1.5GB',55,'Till midnight',NULL,1),
  ('bd20','bingwa','300MB + WhatsApp',20,'24 hours',NULL,2),
  ('bd19','bingwa','1GB',19,'1 hour','Available 11pm - 4pm',3),
  ('bd49','bingwa','1.5GB',49,'3 hours',NULL,4),
  ('bd99','bingwa','1.8GB',99,'24 hours',NULL,5),
  ('bd500','bingwa','13GB + YouTube',500,'7 days',NULL,6),
  ('rp100','repeatable','2GB',100,'3 days',NULL,1),
  ('rp50','repeatable','1GB',50,'24 hours',NULL,2),
  ('mn21','minutes','45 minutes',21,'3 hours',NULL,1),
  ('mn51','minutes','50 minutes',51,'Till midnight',NULL,2),
  ('mn100','minutes','120 minutes',100,'2 days',NULL,3),
  ('sm5','sms','20 SMS',5,'Daily',NULL,1),
  ('sm10','sms','200 SMS',10,'Daily',NULL,2),
  ('sm30','sms','1000 SMS',30,'Weekly',NULL,3)
ON CONFLICT (id) DO NOTHING;

UPDATE public.app_settings SET business_name = 'BLACK HOLE BINGWA SERVICES', support_phone = '0769252572' WHERE id = 1;