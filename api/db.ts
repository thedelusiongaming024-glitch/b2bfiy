// Server-only Neon Postgres client.
//
// This file must never be imported from src/ (browser code) — it reads
// DATABASE_URL, which is a full database credential and must stay a
// server-side secret (set in Vercel Project Settings -> Environment
// Variables, WITHOUT a VITE_ prefix so it never gets bundled into client JS).
//
// Unlike Supabase, Neon is "just Postgres" — there is no built-in REST layer,
// Row Level Security policies enforced for a public anon key, or client-side
// SDK that's safe to use from the browser. That means ALL database access now
// happens through our own API routes (api/content.ts, api/portfolios.ts,
// api/leads.ts, etc.), which run only on the server and enforce access rules
// in code (see api/adminAuth.ts) instead of in SQL policies.

import { Pool } from "pg";

let pool: Pool | null = null;

function getConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

// Fast, synchronous check for whether a Neon connection string is present.
// Use this to branch behavior (e.g. "show demo data" vs "query the db")
// without paying for a network round trip.
export function hasDatabaseUrl(): boolean {
  return !!getConnectionString();
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy your Neon connection string (Neon Dashboard -> " +
          "Connection Details -> pooled connection, 'psql' format) into DATABASE_URL as a " +
          "server environment variable."
      );
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });

    pool.on("error", (err) => {
      // Prevents an idle client error from crashing the whole process.
      console.error("[neon] Unexpected pool error:", err);
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

// Runs `queries` inside a single transaction on one client, rolling back on
// any error. Use this whenever multiple statements need to succeed or fail
// together (e.g. replacing an entire portfolios list).
export async function withTransaction<T>(fn: (run: (text: string, params?: any[]) => Promise<any>) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const run = (text: string, params: any[] = []) => client.query(text, params);
    const result = await fn(run);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function isDbReachable(): Promise<boolean> {
  if (!hasDatabaseUrl()) return false;
  try {
    await query("SELECT 1");
    return true;
  } catch (err) {
    console.error("[neon] Connection check failed:", err);
    return false;
  }
}
