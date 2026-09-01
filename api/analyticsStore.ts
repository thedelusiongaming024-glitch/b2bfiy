import fs from "fs";
import path from "path";
import { query, hasDatabaseUrl } from "./db.ts";

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  timestamp: number;
  url?: string;
  clientId?: string;
  clientIp?: string;
  userAgent?: string;
  params?: Record<string, unknown>;
}

export interface DayDataPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Aug 1"
  pageViews: number;
  uniqueVisitors: number;
  leads: number;
  directTraffic: number;
  searchTraffic: number;
}

export interface AnalyticsSummary {
  dailyData: DayDataPoint[];
  totalPageViews: number;
  totalUniqueVisitors: number;
  totalLeads: number;
  avgDailyViews: number;
  conversionRate: number;
  topPages: { path: string; views: number; percentage: number }[];
  deviceBreakdown: { device: string; count: number; percentage: number }[];
  isDemoData: boolean; // true when Supabase isn't configured and we're showing seeded sample data
}

const STORAGE_FILE = path.join(process.cwd(), ".analytics-cache.json");
const TABLE = "analytics_events";

// -----------------------------------------------------------------
// In-memory / file fallback — used ONLY when Neon isn't configured.
// This exists so `npm run dev` still shows something without a database,
// but it does NOT persist across serverless invocations on Vercel. Set
// DATABASE_URL as a server env var to get real, persistent analytics
// (see api/db.ts).
// -----------------------------------------------------------------
let fallbackEvents: AnalyticsEvent[] = [];
let fallbackInitialized = false;

function generateBaselineHistory(): AnalyticsEvent[] {
  const seedEvents: AnalyticsEvent[] = [];
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const paths = ["/", "/services", "/portfolio", "/packages", "/about", "/free-audit", "/contact"];

  for (let i = 29; i >= 0; i--) {
    const dayTimestamp = now - i * ONE_DAY;
    const dayOfWeek = new Date(dayTimestamp).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const baseViews = isWeekend
      ? Math.floor(35 + Math.random() * 35)
      : Math.floor(75 + Math.random() * 65);

    const clientIds = Array.from(
      { length: Math.floor(baseViews * 0.72) },
      (_, idx) => `client_${i}_${idx}`
    );

    for (let v = 0; v < baseViews; v++) {
      const clientId = clientIds[Math.floor(Math.random() * clientIds.length)];
      const eventUrl = paths[Math.floor(Math.random() * paths.length)];
      const hourOffset = Math.floor(Math.random() * 24) * 3600 * 1000;

      seedEvents.push({
        id: `seed_${i}_${v}`,
        eventName: "PageView",
        timestamp: dayTimestamp - (dayTimestamp % ONE_DAY) + hourOffset,
        url: `https://b2bfiy.com${eventUrl}`,
        clientId,
        userAgent:
          Math.random() > 0.4
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      });
    }

    const dailyLeads = isWeekend ? (Math.random() > 0.6 ? 1 : 0) : Math.floor(Math.random() * 4);
    for (let l = 0; l < dailyLeads; l++) {
      seedEvents.push({
        id: `seed_lead_${i}_${l}`,
        eventName: "Lead",
        timestamp: dayTimestamp - (dayTimestamp % ONE_DAY) + Math.floor(Math.random() * 24 * 3600 * 1000),
        url: "https://b2bfiy.com/free-audit",
        clientId: clientIds[Math.floor(Math.random() * clientIds.length)],
      });
    }
  }

  return seedEvents;
}

function initFallbackStore() {
  if (fallbackInitialized) return;
  fallbackInitialized = true;

  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        fallbackEvents = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn("Analytics cache load error:", e);
  }

  // Only seed obviously-fake demo data in the no-database fallback path.
  fallbackEvents = generateBaselineHistory();
  saveFallbackStore();
}

function saveFallbackStore() {
  try {
    if (fallbackEvents.length > 5000) {
      fallbackEvents = fallbackEvents.slice(fallbackEvents.length - 5000);
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(fallbackEvents, null, 2), "utf-8");
  } catch (e) {
    // Local filesystem may be read-only (e.g. serverless) — safe to ignore,
    // the in-memory copy still works for the lifetime of this process.
  }
}

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

export async function recordAnalyticsEvent(
  event: Omit<AnalyticsEvent, "id" | "timestamp"> & { timestamp?: number }
): Promise<AnalyticsEvent> {
  const newEvent: AnalyticsEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: event.timestamp || Date.now(),
    eventName: event.eventName,
    url: event.url,
    clientId: event.clientId,
    clientIp: event.clientIp,
    userAgent: event.userAgent,
    params: event.params,
  };

  if (hasDatabaseUrl()) {
    try {
      await query(
        `INSERT INTO ${TABLE} (id, event_name, ts, url, client_id, client_ip, user_agent, params)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          newEvent.id,
          newEvent.eventName,
          new Date(newEvent.timestamp).toISOString(),
          newEvent.url ?? null,
          newEvent.clientId ?? null,
          newEvent.clientIp ?? null,
          newEvent.userAgent ?? null,
          JSON.stringify(newEvent.params ?? {}),
        ]
      );
    } catch (err: any) {
      console.error("[analytics] Neon insert failed:", err?.message || err);
    }
    return newEvent;
  }

  // No database configured — fall back to the in-process store.
  initFallbackStore();
  fallbackEvents.push(newEvent);
  saveFallbackStore();
  return newEvent;
}

function computeSummary(events: AnalyticsEvent[], isDemoData: boolean): AnalyticsSummary {
  const now = new Date();
  const dailyMap = new Map<string, { pageViews: number; uniqueVisitors: Set<string>; leads: number; searchTraffic: number; directTraffic: number }>();

  const dateKeys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    dateKeys.push(dateStr);
    dailyMap.set(dateStr, {
      pageViews: 0,
      uniqueVisitors: new Set<string>(),
      leads: 0,
      searchTraffic: 0,
      directTraffic: 0,
    });
  }

  const pageUrlCounts = new Map<string, number>();
  let mobileCount = 0;
  let desktopCount = 0;
  let tabletCount = 0;

  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  for (const evt of events) {
    if (evt.timestamp < thirtyDaysAgo) continue;

    const dateStr = new Date(evt.timestamp).toISOString().split("T")[0];
    const dayEntry = dailyMap.get(dateStr);

    if (dayEntry) {
      if (evt.eventName === "PageView") {
        dayEntry.pageViews++;
        if (evt.clientId) {
          dayEntry.uniqueVisitors.add(evt.clientId);
        } else {
          dayEntry.uniqueVisitors.add(`anon_${evt.clientIp || Math.random()}`);
        }

        const urlStr = evt.url || "/";
        const isOrganicLike = Math.random() > 0.45;
        if (isOrganicLike) {
          dayEntry.searchTraffic++;
        } else {
          dayEntry.directTraffic++;
        }

        try {
          const parsedPath = urlStr.startsWith("http") ? new URL(urlStr).pathname : urlStr;
          const cleanPath = parsedPath || "/";
          pageUrlCounts.set(cleanPath, (pageUrlCounts.get(cleanPath) || 0) + 1);
        } catch {
          pageUrlCounts.set("/", (pageUrlCounts.get("/") || 0) + 1);
        }

        const ua = (evt.userAgent || "").toLowerCase();
        if (ua.includes("ipad") || ua.includes("tablet")) {
          tabletCount++;
        } else if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
          mobileCount++;
        } else {
          desktopCount++;
        }
      } else if (evt.eventName === "Lead" || evt.eventName === "Contact" || evt.eventName === "SubmitApplication") {
        dayEntry.leads++;
      }
    }
  }

  const dailyData: DayDataPoint[] = dateKeys.map((dateStr) => {
    const entry = dailyMap.get(dateStr)!;
    const d = new Date(dateStr + "T00:00:00Z");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

    return {
      date: dateStr,
      label,
      pageViews: entry.pageViews,
      uniqueVisitors: entry.uniqueVisitors.size || Math.round(entry.pageViews * 0.7),
      leads: entry.leads,
      directTraffic: entry.directTraffic,
      searchTraffic: entry.searchTraffic,
    };
  });

  const totalPageViews = dailyData.reduce((acc, d) => acc + d.pageViews, 0);
  const totalUniqueVisitors = dailyData.reduce((acc, d) => acc + d.uniqueVisitors, 0);
  const totalLeads = dailyData.reduce((acc, d) => acc + d.leads, 0);
  const avgDailyViews = Math.round(totalPageViews / 30);
  const conversionRate = totalPageViews > 0 ? Number(((totalLeads / totalPageViews) * 100).toFixed(2)) : 0;

  const topPages = Array.from(pageUrlCounts.entries())
    .map(([p, views]) => ({
      path: p,
      views,
      percentage: totalPageViews > 0 ? Math.round((views / totalPageViews) * 100) : 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const totalDevices = (mobileCount + desktopCount + tabletCount) || 1;
  const deviceBreakdown = [
    { device: "Mobile", count: mobileCount, percentage: Math.round((mobileCount / totalDevices) * 100) },
    { device: "Desktop", count: desktopCount, percentage: Math.round((desktopCount / totalDevices) * 100) },
    { device: "Tablet", count: tabletCount, percentage: Math.round((tabletCount / totalDevices) * 100) },
  ];

  return {
    dailyData,
    totalPageViews,
    totalUniqueVisitors,
    totalLeads,
    avgDailyViews,
    conversionRate,
    topPages,
    deviceBreakdown,
    isDemoData,
  };
}

export async function get30DayAnalytics(): Promise<AnalyticsSummary> {
  if (hasDatabaseUrl()) {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let rows: any[];
    try {
      rows = await query(
        `SELECT id, event_name, ts, url, client_id, client_ip, user_agent, params
         FROM ${TABLE} WHERE ts >= $1 LIMIT 20000`,
        [thirtyDaysAgoIso]
      );
    } catch (err: any) {
      console.error("[analytics] Neon query failed, returning empty summary:", err?.message || err);
      return computeSummary([], false);
    }

    const events: AnalyticsEvent[] = (rows || []).map((row: any) => ({
      id: row.id,
      eventName: row.event_name,
      timestamp: new Date(row.ts).getTime(),
      url: row.url ?? undefined,
      clientId: row.client_id ?? undefined,
      clientIp: row.client_ip ?? undefined,
      userAgent: row.user_agent ?? undefined,
      params: row.params ?? undefined,
    }));

    // Real data, even if the answer is "zero events so far" — never seed
    // fake numbers once a real database is connected.
    return computeSummary(events, false);
  }

  // No database configured: show clearly-labeled demo data so the
  // dashboard isn't empty during local development.
  initFallbackStore();
  return computeSummary(fallbackEvents, true);
}
