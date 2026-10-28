-- Additive PostgreSQL schema for Bingwa Hybrid store records.
-- Inspect existing Vercel PostgreSQL tables before applying in production.
BEGIN;
CREATE TABLE IF NOT EXISTS app_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
 admin_pin text NOT NULL DEFAULT '9898',
 till_number text NOT NULL DEFAULT '3367738',
 paybill_number text NOT NULL DEFAULT '4211224',
 gateway_enabled boolean NOT NULL DEFAULT false,
 commission_per_ten numeric NOT NULL DEFAULT 1.5,
 withdraw_threshold numeric NOT NULL DEFAULT 10,
 float_balance numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 activated boolean NOT NULL DEFAULT false,
 activated_at timestamptz,
 business_name text NOT NULL DEFAULT 'BLACK HOLE BINGWA SERVICES',
 support_phone text NOT NULL DEFAULT '0769252572'
);
INSERT INTO app_settings(id) VALUES (1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS deals (
 id text PRIMARY KEY, group_key text NOT NULL, title text NOT NULL, price numeric NOT NULL,
 validity text NOT NULL, note text, sort_order integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers (
 phone text PRIMARY KEY, purchases integer NOT NULL DEFAULT 0, total_spent numeric NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sales (
 id bigserial PRIMARY KEY, offer_id text NOT NULL, offer_title text NOT NULL, service text NOT NULL,
 price numeric NOT NULL, commission numeric NOT NULL DEFAULT 0, payment_phone text NOT NULL,
 receiving_phone text NOT NULL, for_self boolean NOT NULL DEFAULT true,
 gateway_enabled boolean NOT NULL DEFAULT false, destination text NOT NULL,
 status text NOT NULL DEFAULT 'pending', checkout_request_id text, mpesa_receipt text,
 result_desc text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS sales_checkout_request_id_idx ON sales(checkout_request_id);
CREATE TABLE IF NOT EXISTS withdrawals (
 id bigserial PRIMARY KEY, amount numeric NOT NULL, phone text,
 status text NOT NULL DEFAULT 'requested', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS paybill_number text NOT NULL DEFAULT '4211224';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS gateway_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS commission_per_ten numeric NOT NULL DEFAULT 1.5;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS withdraw_threshold numeric NOT NULL DEFAULT 10;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS float_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS admin_pin text NOT NULL DEFAULT '9898';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS till_number text NOT NULL DEFAULT '3367738';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS business_name text NOT NULL DEFAULT 'BLACK HOLE BINGWA SERVICES';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS support_phone text NOT NULL DEFAULT '0769252572';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS activated boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS mpesa_receipt text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS result_desc text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
INSERT INTO deals(id,group_key,title,price,validity,note,sort_order) VALUES
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
ON CONFLICT(id) DO NOTHING;
COMMIT;
