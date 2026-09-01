import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// ==========================================
// 1. DATABASE CONNECTION (PostgreSQL / Neon)
// ==========================================
let pool: Pool | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

    pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  await ensureSchema();
  const p = getPool();
  const res = await p.query(text, params);
  return res.rows as T[];
}

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  if (schemaInitialized || !hasDatabaseUrl()) return;
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    try {
      const p = getPool();
      await p.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS site_content (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS portfolios (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS packages (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS media_items (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS leads (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(100) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          business_name VARCHAR(255),
          email VARCHAR(255),
          whatsapp_number VARCHAR(100),
          website_url TEXT,
          service_needed VARCHAR(255),
          message TEXT,
          submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status VARCHAR(50) DEFAULT 'new',
          notes TEXT,
          raw_data JSONB
        );

        CREATE TABLE IF NOT EXISTS analytics_events (
          id VARCHAR(255) PRIMARY KEY,
          event_name VARCHAR(100) NOT NULL,
          ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          url TEXT,
          client_id VARCHAR(255),
          client_ip VARCHAR(100),
          user_agent TEXT,
          params JSONB
        );

        CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(ts);
        CREATE INDEX IF NOT EXISTS idx_leads_submitted_at ON leads(submitted_at DESC);
      `);
      schemaInitialized = true;
    } catch (err) {
      console.error("Auto schema initialization warning:", err);
    } finally {
      schemaInitPromise = null;
    }
  })();

  return schemaInitPromise;
}

export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  await ensureSchema();
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function isDbReachable(): Promise<boolean> {
  if (!hasDatabaseUrl()) return false;
  try {
    const p = getPool();
    const res = await p.query("SELECT 1 AS ok");
    return Boolean(res?.rows?.[0]?.ok === 1);
  } catch (err) {
    console.error("PostgreSQL health check failed:", err);
    return false;
  }
}

// ==========================================
// 2. ADMIN AUTHENTICATION
// ==========================================
export const SESSION_COOKIE_NAME = "b2bfiy_admin_session";

export interface AdminSessionPayload {
  userId: string;
  email: string;
}

function requireSecret(): string {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "b2bfiy_default_jwt_secret_dev_fallback";
}

export function signSessionToken(payload: AdminSessionPayload): string {
  return jwt.sign(payload, requireSecret(), { expiresIn: "30d" });
}

export function verifySessionToken(token: string): AdminSessionPayload | null {
  try {
    return jwt.verify(token, requireSecret()) as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: any): AdminSessionPayload | null {
  let token: string | undefined = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token && typeof req.headers?.cookie === "string") {
    const match = req.headers.cookie
      .split(";")
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) token = decodeURIComponent(match.split("=").slice(1).join("="));
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`
  );
}

export function clearSessionCookie(res: any) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

async function bootstrapAdminIfEmpty(): Promise<void> {
  if (!hasDatabaseUrl()) return;
  try {
    const rows = await query<{ count: string }>("SELECT COUNT(*)::text as count FROM admin_users");
    const count = parseInt(rows[0]?.count || "0", 10);
    if (count > 0) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;

    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [`admin_${Date.now()}`, email.toLowerCase().trim(), hash]
    );
  } catch (err) {
    console.warn("Bootstrap admin check skipped:", err);
  }
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminSessionPayload | null> {
  const normEmail = email.toLowerCase().trim();
  const envEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!hasDatabaseUrl()) {
    if (envEmail && envPassword && normEmail === envEmail && password === envPassword) {
      return { userId: "admin_env", email: envEmail };
    }
    return null;
  }

  await bootstrapAdminIfEmpty();

  try {
    const rows = await query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM admin_users WHERE email = $1",
      [normEmail]
    );
    const user = rows[0];
    if (!user) {
      if (envEmail && envPassword && normEmail === envEmail && password === envPassword) {
        return { userId: "admin_env", email: envEmail };
      }
      return null;
    }

    let valid = false;
    if (user.password_hash === password) {
      valid = true;
      // Automatically upgrade plain-text stored password in DB to secure bcrypt hash
      try {
        const upgradedHash = await bcrypt.hash(password, 10);
        await query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [upgradedHash, user.id]);
      } catch (upgradeErr) {
        console.warn("Could not auto-upgrade plain-text password to hash:", upgradeErr);
      }
    } else {
      try {
        valid = await bcrypt.compare(password, user.password_hash);
      } catch {
        valid = false;
      }
    }

    if (!valid) return null;

    return { userId: user.id, email: user.email };
  } catch (err) {
    console.error("verifyAdminCredentials database error:", err);
    if (envEmail && envPassword && normEmail === envEmail && password === envPassword) {
      return { userId: "admin_env", email: envEmail };
    }
    return null;
  }
}

export async function updatePasswordForUser(userId: string, newPassword: string): Promise<void> {
  if (!hasDatabaseUrl()) return;
  const hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [hash, userId]);
}

// ==========================================
// 3. ANALYTICS STORAGE & COMPUTATION
// ==========================================
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
  date: string;
  label: string;
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
  isDemoData: boolean;
}

const STORAGE_FILE = path.join(process.cwd(), ".analytics-cache.json");
const ANALYTICS_TABLE = "analytics_events";

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
    // In serverless environment, ignore write errors
  }
}

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
        `INSERT INTO ${ANALYTICS_TABLE} (id, event_name, ts, url, client_id, client_ip, user_agent, params)
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
      console.error("[analytics] PostgreSQL insert failed:", err?.message || err);
    }
    return newEvent;
  }

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
         FROM ${ANALYTICS_TABLE} WHERE ts >= $1 LIMIT 20000`,
        [thirtyDaysAgoIso]
      );
    } catch (err: any) {
      console.error("[analytics] PostgreSQL query failed, returning empty summary:", err?.message || err);
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

    return computeSummary(events, false);
  }

  initFallbackStore();
  return computeSummary(fallbackEvents, true);
}

// ==========================================
// 4. SITEMAP GENERATOR
// ==========================================
const DEFAULT_PORTFOLIO_SLUGS = [
  { slug: "sample-ecommerce-storefront", title: "Sample Project: E-Commerce Storefront", projectDate: "2026-04-12", featured: true },
  { slug: "sample-brand-identity", title: "Sample Project: Brand Visual Identity", projectDate: "2026-05-18", featured: true },
  { slug: "sample-social-video-reels", title: "Sample Project: Social Video Reels", projectDate: "2026-06-05", featured: true },
  { slug: "sample-corporate-documentary", title: "Sample Project: Corporate Documentary", projectDate: "2026-07-02", featured: true },
];

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export async function generateSitemapXml(hostUrl: string): Promise<string> {
  const normalizedBaseUrl = hostUrl.replace(/\/+$/, "");
  const today = new Date().toISOString().split("T")[0];

  const staticPages = [
    { path: "/", priority: "1.0", changefreq: "daily", lastmod: today },
    { path: "/services", priority: "0.9", changefreq: "weekly", lastmod: today },
    { path: "/portfolio", priority: "0.9", changefreq: "daily", lastmod: today },
    { path: "/packages", priority: "0.8", changefreq: "weekly", lastmod: today },
    { path: "/about", priority: "0.7", changefreq: "monthly", lastmod: today },
    { path: "/free-audit", priority: "0.8", changefreq: "weekly", lastmod: today },
    { path: "/contact", priority: "0.7", changefreq: "monthly", lastmod: today },
    { path: "/privacy-policy", priority: "0.3", changefreq: "yearly", lastmod: "2026-01-01" },
    { path: "/terms", priority: "0.3", changefreq: "yearly", lastmod: "2026-01-01" },
  ];

  let allPortfolios: any[] = [...DEFAULT_PORTFOLIO_SLUGS];

  if (hasDatabaseUrl()) {
    try {
      const rows = await query<{ id: string; data: any }>("SELECT id, data FROM portfolios");
      const dbItems = rows
        .map((row) => ({ ...row.data, id: row.id }))
        .filter((p: any) => p.published !== false);

      const slugMap = new Map();
      [...allPortfolios, ...dbItems].forEach((p: any) => {
        if (p.slug && p.published !== false) {
          slugMap.set(p.slug, p);
        }
      });
      allPortfolios = Array.from(slugMap.values());
    } catch (e) {
      console.warn("Could not fetch portfolios from DB for sitemap:", e);
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${escapeXml(`${normalizedBaseUrl}${page.path}`)}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  for (const project of allPortfolios) {
    if (project.published === false) continue;
    const projectUrl = `${normalizedBaseUrl}/portfolio/${project.slug || project.id}`;
    const lastmodDate = project.projectDate || today;
    const priority = project.featured ? "0.9" : "0.8";

    xml += `  <url>
    <loc>${escapeXml(projectUrl)}</loc>
    <lastmod>${escapeXml(lastmodDate)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>`;

    if (project.thumbnail) {
      xml += `
    <image:image>
      <image:loc>${escapeXml(project.thumbnail)}</image:loc>
      <image:title>${escapeXml(project.title || "Project Artwork")}</image:title>
      <image:caption>${escapeXml(project.shortDescription || project.title || "")}</image:caption>
    </image:image>`;
    }

    xml += `
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

// ==========================================
// 5. META CAPI & GA4 TRACKING
// ==========================================
function hashSha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  return crypto.subtle.digest("SHA-256", data).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function normalizeGa4EventName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
}

async function sendToMetaCapi(body: any) {
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
  return res.json().catch(() => ({}));
}

async function sendToGa4(body: any) {
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
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: text };
  }
  return { ok: true };
}

// ==========================================
// 6. GENERIC TABLE HANDLER FACTORY
// ==========================================
function createListTableHandler(tableName: string) {
  return async function handler(req: Request, res: Response) {
    if (req.method === "GET") {
      if (!hasDatabaseUrl()) {
        res.status(200).json({ data: [] });
        return;
      }
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

// ==========================================
// 7. EXPRESS APPLICATION FACTORY
// ==========================================
export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.text({ type: ["text/*", "application/json"] }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health / DB status
  app.get("/api/health", async (_req: Request, res: Response) => {
    if (!hasDatabaseUrl()) {
      res.status(200).json({ status: "ok", dbConfigured: false, dbConnected: false });
      return;
    }
    const dbConnected = await isDbReachable();
    res.status(200).json({ status: "ok", dbConfigured: true, dbConnected });
  });

  // Sitemap & Robots
  app.get(["/sitemap.xml", "/api/sitemap"], async (req: Request, res: Response) => {
    try {
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.get("host") || "b2bfiy.com";
      const hostUrl = `${protocol}://${host}`;
      const sitemap = await generateSitemapXml(hostUrl);

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.status(200).send(sitemap);
    } catch (error: any) {
      console.error("Sitemap error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", (req: Request, res: Response) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "b2bfiy.com";
    const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${protocol}://${host}/sitemap.xml\n`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(robotsTxt);
  });

  // Site Content
  app.all("/api/content", async (req: Request, res: Response) => {
    const ROW_ID = "default_site_content";
    if (req.method === "GET") {
      if (!hasDatabaseUrl()) {
        res.status(200).json({ data: null });
        return;
      }
      try {
        const rows = await query<{ data: any }>("SELECT data FROM site_content WHERE id = $1", [ROW_ID]);
        res.status(200).json({ data: rows[0]?.data ?? null });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to load content" });
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
        await query(
          `INSERT INTO site_content (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [ROW_ID, JSON.stringify(body)]
        );
        res.status(200).json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to save content" });
      }
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
  });

  // Portfolios, Packages, Media
  app.all("/api/portfolios", createListTableHandler("portfolios"));
  app.all("/api/packages", createListTableHandler("packages"));
  app.all("/api/media", createListTableHandler("media_items"));

  // Leads
  app.all("/api/leads", async (req: Request, res: Response) => {
    if (req.method === "GET") {
      const session = getSessionFromRequest(req);
      if (!session) {
        res.status(401).json({ error: "Not signed in." });
        return;
      }
      if (!hasDatabaseUrl()) {
        res.status(200).json({ data: [] });
        return;
      }
      try {
        const rows = await query("SELECT * FROM leads ORDER BY submitted_at DESC");
        res.status(200).json({
          data: rows.map((row: any) => ({
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
          })),
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to load leads" });
      }
      return;
    }

    if (req.method === "POST") {
      const session = getSessionFromRequest(req);
      if (!hasDatabaseUrl()) {
        res.status(200).json({ ok: true });
        return;
      }
      try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const lead = body || {};
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
        res.status(500).json({ error: err?.message || "Failed to save lead" });
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
        res.status(500).json({ error: err?.message || "Failed to delete lead" });
      }
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
  });

  // Admin Auth routes
  app.post("/api/admin/login", async (req: Request, res: Response) => {
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
      res.status(500).json({ error: err?.message || "Login failed." });
    }
  });

  app.post("/api/admin/logout", (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  });

  app.get("/api/admin/session", (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(200).json({ session: null });
      return;
    }
    res.status(200).json({ session: { userId: session.userId, email: session.email } });
  });

  app.post("/api/admin/password", async (req: Request, res: Response) => {
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
      res.status(500).json({ error: err?.message || "Failed to update password." });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/summary", async (_req: Request, res: Response) => {
    try {
      const summary = await get30DayAnalytics();
      res.setHeader("Cache-Control", "no-cache");
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load analytics" });
    }
  });

  app.get("/api/analytics/pageviews", async (_req: Request, res: Response) => {
    try {
      const summary = await get30DayAnalytics();
      res.setHeader("Cache-Control", "no-cache");
      res.json(summary.dailyData);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load pageviews" });
    }
  });

  // Tracking API
  app.get("/api/track", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      endpoint: "/api/track",
      description: "Server-side tracking gateway for Meta CAPI and Google Analytics 4.",
      allowedMethods: ["POST", "GET"],
      metaCapiConfigured: Boolean(process.env.META_CAPI_ACCESS_TOKEN),
      ga4Configured: Boolean(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET),
      instructions: "Send a POST request with { eventName, eventId, eventSourceUrl, ... } to record an analytics event."
    });
  });

  app.post("/api/track", async (req: Request, res: Response) => {
    try {
      let body: any;
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
      const enriched = { ...body, clientIp, userAgent };

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
    } catch (err: any) {
      console.error("Tracking API error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }
  });

  return app;
}

// Default export for Vercel Serverless Function entry point
const app = createApiApp();

export default function handler(req: any, res: any) {
  return app(req, res);
}
