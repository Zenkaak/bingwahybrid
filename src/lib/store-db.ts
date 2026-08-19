import { Pool, type PoolClient } from "pg";

type GatewaySettings = {
  enabled: boolean;
  till: string;
};

type DashboardData = {
  balance: number;
  salesCount: number;
  revenue: number;
  totalCommissions: number;
  withdrawableCommissions: number;
  pendingCommissions: number;
  sales: Array<{
    id: number;
    offerTitle: string;
    amount: number;
    paymentPhone: string;
    receivingPhone: string;
    status: string;
    commission: number;
    createdAt: string;
  }>;
  customers: Array<{
    phone: string;
    salesCount: number;
    totalSpend: number;
    lastSeen: string;
  }>;
};

const globalForStore = globalThis as typeof globalThis & {
  bingwaPool?: Pool;
  bingwaSchema?: Promise<void>;
};

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Persistent store data is unavailable.");
  }
  globalForStore.bingwaPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  return globalForStore.bingwaPool;
}

async function ensureSchema() {
  if (!globalForStore.bingwaSchema) {
    globalForStore.bingwaSchema = (async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS store_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS store_customers (
          phone TEXT PRIMARY KEY,
          sales_count INTEGER NOT NULL DEFAULT 0,
          total_spend_cents INTEGER NOT NULL DEFAULT 0,
          first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS store_sales (
          id BIGSERIAL PRIMARY KEY,
          offer_id TEXT NOT NULL,
          offer_title TEXT NOT NULL,
          service TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          payment_phone TEXT NOT NULL,
          receiving_phone TEXT NOT NULL,
          payment_mode TEXT NOT NULL DEFAULT 'mpesa',
          status TEXT NOT NULL DEFAULT 'confirmed',
          commission_cents INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS store_withdrawals (
          id BIGSERIAL PRIMARY KEY,
          amount_cents INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'requested',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO store_settings (key, value)
        VALUES ('gateway_enabled', 'false'), ('gateway_till', '3367738'), ('float_balance_cents', '85000')
        ON CONFLICT (key) DO NOTHING;
      `);
    })().catch((error) => {
      globalForStore.bingwaSchema = undefined;
      throw error;
    });
  }
  await globalForStore.bingwaSchema;
}

async function withClient<T>(callback: (client: PoolClient) => Promise<T>) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function getGatewaySettings(): Promise<GatewaySettings> {
  await ensureSchema();
  const result = await getPool().query<{ key: string; value: string }>(
    "SELECT key, value FROM store_settings WHERE key = ANY($1::text[])",
    [["gateway_enabled", "gateway_till"]],
  );
  const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  return {
    enabled: values.gateway_enabled === "true",
    till: /^\d{5,10}$/.test(values.gateway_till ?? "") ? values.gateway_till : "3367738",
  };
}

export async function updateGatewaySettings(settings: GatewaySettings) {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO store_settings (key, value) VALUES ('gateway_enabled', $1), ('gateway_till', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(settings.enabled), settings.till],
  );
  return settings;
}

export async function addFloat(amount: number) {
  await ensureSchema();
  const result = await getPool().query<{ value: string }>(
    `INSERT INTO store_settings (key, value)
     VALUES ('float_balance_cents', $1)
     ON CONFLICT (key) DO UPDATE SET value = store_settings.value::bigint + EXCLUDED.value::bigint
     RETURNING value`,
    [String(Math.round(amount * 100))],
  );
  return Number(result.rows[0]?.value ?? 0) / 100;
}

export async function recordConfirmedSale(input: {
  offerId: string;
  offerTitle: string;
  service: string;
  amount: number;
  paymentPhone: string;
  receivingPhone: string;
  paymentMode: "mpesa" | "float";
}) {
  const amountCents = Math.round(input.amount * 100);
  const commissionCents = Math.round(input.amount * 15);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO store_customers (phone, sales_count, total_spend_cents)
         VALUES ($1, 1, $2)
         ON CONFLICT (phone) DO UPDATE SET
           sales_count = store_customers.sales_count + 1,
           total_spend_cents = store_customers.total_spend_cents + EXCLUDED.total_spend_cents,
           last_seen = NOW()`,
        [input.receivingPhone, amountCents],
      );
      const sale = await client.query<{ id: number }>(
        `INSERT INTO store_sales
          (offer_id, offer_title, service, amount_cents, payment_phone, receiving_phone, payment_mode, commission_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.offerId,
          input.offerTitle,
          input.service,
          amountCents,
          input.paymentPhone,
          input.receivingPhone,
          input.paymentMode,
          commissionCents,
        ],
      );
      await client.query("COMMIT");
      return { id: sale.rows[0]?.id ?? null, commission: commissionCents / 100 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  await ensureSchema();
  const pool = getPool();
  const [summary, commission, withdrawn, float, sales, customers] = await Promise.all([
    pool.query<{ count: string; revenue: string }>(
      "SELECT COUNT(*)::text AS count, COALESCE(SUM(amount_cents), 0)::text AS revenue FROM store_sales WHERE status = 'confirmed'",
    ),
    pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(commission_cents), 0)::text AS total FROM store_sales WHERE status = 'confirmed'",
    ),
    pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM store_withdrawals WHERE status = 'requested'",
    ),
    pool.query<{ value: string }>(
      "SELECT value FROM store_settings WHERE key = 'float_balance_cents'",
    ),
    pool.query(
      `SELECT id, offer_title, amount_cents, payment_phone, receiving_phone, status,
              commission_cents, created_at
       FROM store_sales ORDER BY created_at DESC LIMIT 50`,
    ),
    pool.query(
      `SELECT phone, sales_count, total_spend_cents, last_seen
       FROM store_customers ORDER BY last_seen DESC LIMIT 50`,
    ),
  ]);
  const totalCommissionCents = Number(commission.rows[0]?.total ?? 0);
  const withdrawnCents = Number(withdrawn.rows[0]?.total ?? 0);
  const availableCents = Math.max(0, totalCommissionCents - withdrawnCents);
  const withdrawableCents = Math.floor(availableCents / 1000) * 1000;
  return {
    balance: Number(float.rows[0]?.value ?? 85000) / 100,
    salesCount: Number(summary.rows[0]?.count ?? 0),
    revenue: Number(summary.rows[0]?.revenue ?? 0) / 100,
    totalCommissions: totalCommissionCents / 100,
    withdrawableCommissions: withdrawableCents / 100,
    pendingCommissions: (availableCents - withdrawableCents) / 100,
    sales: sales.rows.map((row) => ({
      id: Number(row.id),
      offerTitle: row.offer_title,
      amount: Number(row.amount_cents) / 100,
      paymentPhone: row.payment_phone,
      receivingPhone: row.receiving_phone,
      status: row.status,
      commission: Number(row.commission_cents) / 100,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    customers: customers.rows.map((row) => ({
      phone: row.phone,
      salesCount: Number(row.sales_count),
      totalSpend: Number(row.total_spend_cents) / 100,
      lastSeen: new Date(row.last_seen).toISOString(),
    })),
  };
}

export async function requestCommissionWithdrawal() {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const totals = await client.query<{ earned: string; withdrawn: string }>(
        `SELECT
          (SELECT COALESCE(SUM(commission_cents), 0) FROM store_sales WHERE status = 'confirmed')::text AS earned,
          (SELECT COALESCE(SUM(amount_cents), 0) FROM store_withdrawals WHERE status = 'requested')::text AS withdrawn`,
      );
      const available = Math.max(
        0,
        Number(totals.rows[0]?.earned ?? 0) - Number(totals.rows[0]?.withdrawn ?? 0),
      );
      const amount = Math.floor(available / 1000) * 1000;
      if (!amount) {
        await client.query("ROLLBACK");
        return { amount: 0 };
      }
      await client.query("INSERT INTO store_withdrawals (amount_cents) VALUES ($1)", [amount]);
      await client.query("COMMIT");
      return { amount: amount / 100 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
