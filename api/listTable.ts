// Shared logic for the three "list" tables that all share the same
// (id TEXT PRIMARY KEY, data JSONB) shape: portfolios, packages, media_items.
// GET is public; PUT replaces the whole list (upsert + delete-missing) and
// requires an admin session, mirroring the old Supabase RLS behavior.

import { query, withTransaction } from "./db.ts";
import { getSessionFromRequest } from "./adminAuth.ts";

export function createListTableHandler(tableName: string) {
  return async function handler(req: any, res: any) {
    if (req.method === "GET") {
      try {
        const rows = await query<{ id: string; data: any }>(`SELECT id, data FROM ${tableName}`);
        res.status(200).json({ data: rows.map((r) => ({ ...r.data, id: r.id })) });
      } catch (err: any) {
        console.error(`Fetch ${tableName} failed:`, err);
        res.status(500).json({ error: err?.message || `Failed to load ${tableName}.` });
      }
      return;
    }

    if (req.method === "PUT") {
      const session = getSessionFromRequest(req);
      if (!session) {
        res.status(401).json({ error: "Not signed in." });
        return;
      }

      try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const items: any[] = Array.isArray(body) ? body : [];

        await withTransaction(async (run) => {
          for (const item of items) {
            await run(
              `INSERT INTO ${tableName} (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
               ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
              [item.id, JSON.stringify(item)]
            );
          }

          const activeIds = items.map((i) => i.id);
          if (activeIds.length > 0) {
            await run(`DELETE FROM ${tableName} WHERE id != ALL($1::text[])`, [activeIds]);
          } else {
            await run(`DELETE FROM ${tableName}`);
          }
        });

        res.status(200).json({ ok: true });
      } catch (err: any) {
        console.error(`Save ${tableName} failed:`, err);
        res.status(500).json({ error: err?.message || `Failed to save ${tableName}.` });
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  };
}
