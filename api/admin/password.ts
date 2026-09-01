import { getSessionFromRequest, updatePasswordForUser } from "../adminAuth.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const newPassword = body?.newPassword || "";

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    await updatePasswordForUser(session.userId, newPassword);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Admin password update error:", err);
    res.status(500).json({ error: err?.message || "Failed to update password." });
  }
}
