-- Seed BLACK HOLE BINGWA SERVICES offers without overwriting unrelated deals.
-- Re-running this migration updates only the known deal IDs below.
BEGIN;

CREATE TABLE IF NOT EXISTS deals (
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

INSERT INTO deals (id, group_key, title, price, validity, note, sort_order, active)
VALUES
  ('bd55', 'bingwa', '1.5GB', 55, 'Till midnight', 'Buy once per day per line', 1, true),
  ('bd20', 'bingwa', '300MB + WhatsApp', 20, '24 hours', 'Buy once per day per line', 2, true),
  ('bd19', 'bingwa', '1GB', 19, '1 hour', 'Buy once per day per line', 3, true),
  ('bd49', 'bingwa', '1.5GB', 49, '3 hours', 'Buy once per day per line', 4, true),
  ('bd99', 'bingwa', '1.8GB', 99, '24 hours', 'Buy once per day per line', 5, true),
  ('bd500', 'bingwa', '13GB + YouTube', 500, '7 days', 'Buy once per day per line', 6, true),
  ('rp100', 'repeatable', '2GB', 100, '3 days', 'Repeatable deal', 1, true),
  ('rp50', 'repeatable', '1GB', 50, '24 hours', 'Repeatable deal', 2, true),
  ('mn21', 'minutes', '45 minutes', 21, '3 hours', 'Purchase multiple times', 1, true),
  ('mn51', 'minutes', '50 minutes', 51, 'Till midnight', 'Purchase multiple times', 2, true),
  ('mn100', 'minutes', '120 minutes', 100, '2 days', 'Purchase multiple times', 3, true),
  ('sm5', 'sms', '20 SMS', 5, 'Daily', NULL, 1, true),
  ('sm10', 'sms', '200 SMS', 10, 'Daily', NULL, 2, true),
  ('sm30', 'sms', '1000 SMS', 30, 'Weekly', NULL, 3, true)
ON CONFLICT (id) DO UPDATE SET
  group_key = EXCLUDED.group_key,
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  validity = EXCLUDED.validity,
  note = EXCLUDED.note,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = now();

COMMIT;
