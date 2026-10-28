import type { VercelRequest, VercelResponse } from "@vercel/node";
import pg from "pg";

const { Client } = pg;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Read-only schema inspection endpoint. Never return row data or connection details.
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expected = process.env.SCHEMA_INSPECT_TOKEN;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || supplied.length !== expected.length) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  let matches = 0;
  for (let i = 0; i < expected.length; i++) matches |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (matches !== 0) return res.status(404).json({ ok: false, error: "Not found" });

  const connectionString =
    process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    return res.status(503).json({ ok: false, error: "PostgreSQL connection is not configured" });
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         AND table_name IN ('app_settings', 'deals', 'customers', 'sales', 'withdrawals')
       ORDER BY table_schema, table_name, ordinal_position`,
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, columns: result.rows });
  } catch {
    // Do not leak connection strings, database hosts, or provider error details.
    return res.status(503).json({ ok: false, error: "Schema inspection failed" });
  } finally {
    await client.end().catch(() => undefined);
  }
}
