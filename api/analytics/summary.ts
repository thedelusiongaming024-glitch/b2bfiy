import { get30DayAnalytics } from "../analyticsStore";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const summary = await get30DayAnalytics();
    res.setHeader("Cache-Control", "no-cache");
    res.status(200).json(summary);
  } catch (err: any) {
    console.error("Analytics summary API error:", err);
    res.status(500).json({ error: err?.message || "Failed to load analytics" });
  }
}
