import { verifyAdminCredentials, signSessionToken, setSessionCookie } from "../adminAuth.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const email = (body?.email || "").trim();
    const password = body?.password || "";

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const session = await verifyAdminCredentials(email, password);
    if (!session) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signSessionToken(session);
    setSessionCookie(res, token);
    res.status(200).json({ userId: session.userId, email: session.email });
  } catch (err: any) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: err?.message || "Login failed." });
  }
}
