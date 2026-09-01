// Server-side event tracking endpoint (Vercel serverless function).
//
// This runs on the server, never in the browser, so the secrets below are
// safe: they are read from Vercel Environment Variables and are never sent
// to the client.
//
// Required env vars (set in Vercel Project Settings -> Environment Variables):
//   META_CAPI_ACCESS_TOKEN   - Meta Events Manager -> Conversions API token
//   GA4_MEASUREMENT_ID       - e.g. "G-XXXXXXXXXX"
//   GA4_API_SECRET           - GA4 Admin -> Data Streams -> Measurement Protocol API secrets
//
// The client (see src/lib/serverTracking.ts) POSTs a small event payload
// here. This function fans the event out to Meta and GA4 server-to-server.
// Google Ads is intentionally NOT called directly: link your Google Ads
// account to this GA4 property (Google Ads -> Linked accounts -> Google
// Analytics) and enable "Import conversions" from GA4 events/conversions.
// Once linked, every event this endpoint sends to GA4 is available to
// import as a Google Ads conversion with no extra credentials or code.

import { recordAnalyticsEvent } from "./analyticsStore.ts";

export const config = {
  runtime: "nodejs",
};

interface TrackRequestBody {
  eventName: string; // e.g. "PageView", "Lead", "Contact"
  eventId: string; // shared id used for Meta Pixel <-> CAPI dedup
  eventSourceUrl?: string;
  pixelId?: string; // Meta Pixel ID (public, comes from site content)
  clientId?: string; // GA4 client_id (random id persisted in localStorage)
  userAgent?: string;
  clientIp?: string;
  userData?: {
    email?: string;
    phone?: string;
  };
  params?: Record<string, unknown>; // extra GA4 event params
}

function hashSha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  // Node 18+ / Vercel's nodejs runtime exposes the Web Crypto API globally.
  return crypto.subtle.digest("SHA-256", data).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

async function sendToMetaCapi(body: TrackRequestBody) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken || !body.pixelId) return { skipped: "meta_capi_not_configured" };

  const userData: Record<string, unknown> = {
    client_ip_address: body.clientIp,
    client_user_agent: body.userAgent,
  };
  if (body.userData?.email) userData.em = [await hashSha256(body.userData.email)];
  if (body.userData?.phone) userData.ph = [await hashSha256(body.userData.phone)];

  const payload = {
    data: [
      {
        event_name: body.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId,
        event_source_url: body.eventSourceUrl,
        action_source: "website",
        user_data: userData,
      },
    ],
  };

  const url = `https://graph.facebook.com/v20.0/${body.pixelId}/events?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Meta CAPI error:", json);
  }
  return json;
}

async function sendToGa4(body: TrackRequestBody) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return { skipped: "ga4_not_configured" };

  const clientId = body.clientId || `${Date.now()}.${Math.round(Math.random() * 1e9)}`;

  const payload = {
    client_id: clientId,
    events: [
      {
        name: normalizeGa4EventName(body.eventName),
        params: {
          ...body.params,
          page_location: body.eventSourceUrl,
        },
      },
    ],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // GA4's Measurement Protocol returns 204 with no body on success.
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("GA4 Measurement Protocol error:", res.status, text);
    return { error: text };
  }
  return { ok: true };
}

// GA4 event names may only contain letters, numbers, and underscores.
function normalizeGa4EventName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body: TrackRequestBody;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  if (!body?.eventName || !body?.eventId) {
    res.status(400).json({ error: "eventName and eventId are required" });
    return;
  }

  const forwardedFor = (req.headers["x-forwarded-for"] as string) || "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  const userAgent = (req.headers["user-agent"] as string) || "";

  const enriched: TrackRequestBody = { ...body, clientIp, userAgent };

  // Record into local analytics store for real-time reporting & charts
  try {
    await recordAnalyticsEvent({
      eventName: enriched.eventName,
      url: enriched.eventSourceUrl,
      clientId: enriched.clientId,
      clientIp: enriched.clientIp,
      userAgent: enriched.userAgent,
      params: enriched.params,
    });
  } catch (e) {
    console.error("Error recording local analytics event:", e);
  }

  const [metaResult, ga4Result] = await Promise.allSettled([
    sendToMetaCapi(enriched),
    sendToGa4(enriched),
  ]);

  res.status(200).json({
    meta: metaResult.status === "fulfilled" ? metaResult.value : { error: String(metaResult.reason) },
    ga4: ga4Result.status === "fulfilled" ? ga4Result.value : { error: String(ga4Result.reason) },
  });
}
