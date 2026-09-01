import { query } from "./db.ts";
import { getSessionFromRequest } from "./adminAuth.ts";

function rowToLead(row: any) {
  return {
    id: row.id,
    type: row.type,
    fullName: row.full_name,
    businessName: row.business_name || "",
    email: row.email || "",
    whatsappNumber: row.whatsapp_number || "",
    websiteUrl: row.website_url || "",
    serviceNeeded: row.service_needed || "",
    message: row.message || "",
    submittedAt: row.submitted_at,
    status: row.status,
    notes: row.notes || "",
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    try {
      const rows = await query("SELECT * FROM leads ORDER BY submitted_at DESC");
      res.status(200).json({ data: rows.map(rowToLead) });
    } catch (err: any) {
      console.error("Fetch leads failed:", err);
      res.status(500).json({ error: err?.message || "Failed to load leads." });
    }
    return;
  }

  if (req.method === "POST") {
    // Signed-in admins can upsert (used to edit status/notes on an existing
    // lead). Anonymous visitors can only insert a brand-new lead — this
    // mirrors the old "public insert, admin-only update" Supabase RLS split.
    const session = getSessionFromRequest(req);

    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const lead = body || {};

      if (!lead.id || !lead.type || !lead.fullName || !lead.submittedAt || !lead.status) {
        res.status(400).json({ error: "Missing required lead fields." });
        return;
      }

      const values = [
        lead.id,
        lead.type,
        lead.fullName,
        lead.businessName || null,
        lead.email || null,
        lead.whatsappNumber || null,
        lead.websiteUrl || null,
        lead.serviceNeeded || null,
        lead.message || null,
        lead.submittedAt,
        lead.status,
        lead.notes || null,
        JSON.stringify(lead),
      ];

      const conflictClause = session
        ? `ON CONFLICT (id) DO UPDATE SET
             type = EXCLUDED.type, full_name = EXCLUDED.full_name, business_name = EXCLUDED.business_name,
             email = EXCLUDED.email, whatsapp_number = EXCLUDED.whatsapp_number, website_url = EXCLUDED.website_url,
             service_needed = EXCLUDED.service_needed, message = EXCLUDED.message, submitted_at = EXCLUDED.submitted_at,
             status = EXCLUDED.status, notes = EXCLUDED.notes, raw_data = EXCLUDED.raw_data`
        : `ON CONFLICT (id) DO NOTHING`;

      await query(
        `INSERT INTO leads (id, type, full_name, business_name, email, whatsapp_number, website_url, service_needed, message, submitted_at, status, notes, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ${conflictClause}`,
        values
      );

      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error("Save lead failed:", err);
      res.status(500).json({ error: err?.message || "Failed to save lead." });
    }
    return;
  }

  if (req.method === "DELETE") {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    try {
      const id = req.query?.id;
      if (!id) {
        res.status(400).json({ error: "Missing lead id." });
        return;
      }
      await query("DELETE FROM leads WHERE id = $1", [id]);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error("Delete lead failed:", err);
      res.status(500).json({ error: err?.message || "Failed to delete lead." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
