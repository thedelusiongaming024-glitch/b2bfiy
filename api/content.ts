import { query } from "./db.ts";
import { getSessionFromRequest } from "./adminAuth.ts";

const ROW_ID = "default_site_content";

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    try {
      const rows = await query<{ data: any }>("SELECT data FROM site_content WHERE id = $1", [ROW_ID]);
      res.status(200).json({ data: rows[0]?.data ?? null });
    } catch (err: any) {
      console.error("Fetch site_content failed:", err);
      res.status(500).json({ error: err?.message || "Failed to load site content." });
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
      // NOTE: `pg` does not auto-serialize JS objects for jsonb columns —
      // JSON.stringify explicitly, or the driver will send `[object Object]`.
      await query(
        `INSERT INTO site_content (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [ROW_ID, JSON.stringify(body)]
      );
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error("Save site_content failed:", err);
      res.status(500).json({ error: err?.message || "Failed to save site content." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
