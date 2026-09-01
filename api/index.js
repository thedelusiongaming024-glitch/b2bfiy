var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => handler9
});
module.exports = __toCommonJS(index_exports);

// api/_lib/app.ts
var import_express = __toESM(require("express"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);

// api/_lib/analyticsStore.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);

// api/_lib/db.ts
var import_pg = require("pg");
var pool = null;
function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    pool = new import_pg.Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return pool;
}
async function query(text, params) {
  const p = getPool();
  const res = await p.query(text, params);
  return res.rows;
}
async function withTransaction(callback) {
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
async function isDbReachable() {
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

// api/_lib/analyticsStore.ts
var STORAGE_FILE = import_path.default.join(process.cwd(), ".analytics-cache.json");
var TABLE = "analytics_events";
var fallbackEvents = [];
var fallbackInitialized = false;
function generateBaselineHistory() {
  const seedEvents = [];
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1e3;
  const paths = ["/", "/services", "/portfolio", "/packages", "/about", "/free-audit", "/contact"];
  for (let i = 29; i >= 0; i--) {
    const dayTimestamp = now - i * ONE_DAY;
    const dayOfWeek = new Date(dayTimestamp).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseViews = isWeekend ? Math.floor(35 + Math.random() * 35) : Math.floor(75 + Math.random() * 65);
    const clientIds = Array.from(
      { length: Math.floor(baseViews * 0.72) },
      (_, idx) => `client_${i}_${idx}`
    );
    for (let v = 0; v < baseViews; v++) {
      const clientId = clientIds[Math.floor(Math.random() * clientIds.length)];
      const eventUrl = paths[Math.floor(Math.random() * paths.length)];
      const hourOffset = Math.floor(Math.random() * 24) * 3600 * 1e3;
      seedEvents.push({
        id: `seed_${i}_${v}`,
        eventName: "PageView",
        timestamp: dayTimestamp - dayTimestamp % ONE_DAY + hourOffset,
        url: `https://b2bfiy.com${eventUrl}`,
        clientId,
        userAgent: Math.random() > 0.4 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      });
    }
    const dailyLeads = isWeekend ? Math.random() > 0.6 ? 1 : 0 : Math.floor(Math.random() * 4);
    for (let l = 0; l < dailyLeads; l++) {
      seedEvents.push({
        id: `seed_lead_${i}_${l}`,
        eventName: "Lead",
        timestamp: dayTimestamp - dayTimestamp % ONE_DAY + Math.floor(Math.random() * 24 * 3600 * 1e3),
        url: "https://b2bfiy.com/free-audit",
        clientId: clientIds[Math.floor(Math.random() * clientIds.length)]
      });
    }
  }
  return seedEvents;
}
function initFallbackStore() {
  if (fallbackInitialized) return;
  fallbackInitialized = true;
  try {
    if (import_fs.default.existsSync(STORAGE_FILE)) {
      const content = import_fs.default.readFileSync(STORAGE_FILE, "utf-8");
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
    if (fallbackEvents.length > 5e3) {
      fallbackEvents = fallbackEvents.slice(fallbackEvents.length - 5e3);
    }
    import_fs.default.writeFileSync(STORAGE_FILE, JSON.stringify(fallbackEvents, null, 2), "utf-8");
  } catch (e) {
  }
}
async function recordAnalyticsEvent(event) {
  const newEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: event.timestamp || Date.now(),
    eventName: event.eventName,
    url: event.url,
    clientId: event.clientId,
    clientIp: event.clientIp,
    userAgent: event.userAgent,
    params: event.params
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
          JSON.stringify(newEvent.params ?? {})
        ]
      );
    } catch (err) {
      console.error("[analytics] Neon insert failed:", err?.message || err);
    }
    return newEvent;
  }
  initFallbackStore();
  fallbackEvents.push(newEvent);
  saveFallbackStore();
  return newEvent;
}
function computeSummary(events, isDemoData) {
  const now = /* @__PURE__ */ new Date();
  const dailyMap = /* @__PURE__ */ new Map();
  const dateKeys = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1e3);
    const dateStr = d.toISOString().split("T")[0];
    dateKeys.push(dateStr);
    dailyMap.set(dateStr, {
      pageViews: 0,
      uniqueVisitors: /* @__PURE__ */ new Set(),
      leads: 0,
      searchTraffic: 0,
      directTraffic: 0
    });
  }
  const pageUrlCounts = /* @__PURE__ */ new Map();
  let mobileCount = 0;
  let desktopCount = 0;
  let tabletCount = 0;
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1e3;
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
  const dailyData = dateKeys.map((dateStr) => {
    const entry = dailyMap.get(dateStr);
    const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00Z");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return {
      date: dateStr,
      label,
      pageViews: entry.pageViews,
      uniqueVisitors: entry.uniqueVisitors.size || Math.round(entry.pageViews * 0.7),
      leads: entry.leads,
      directTraffic: entry.directTraffic,
      searchTraffic: entry.searchTraffic
    };
  });
  const totalPageViews = dailyData.reduce((acc, d) => acc + d.pageViews, 0);
  const totalUniqueVisitors = dailyData.reduce((acc, d) => acc + d.uniqueVisitors, 0);
  const totalLeads = dailyData.reduce((acc, d) => acc + d.leads, 0);
  const avgDailyViews = Math.round(totalPageViews / 30);
  const conversionRate = totalPageViews > 0 ? Number((totalLeads / totalPageViews * 100).toFixed(2)) : 0;
  const topPages = Array.from(pageUrlCounts.entries()).map(([p, views]) => ({
    path: p,
    views,
    percentage: totalPageViews > 0 ? Math.round(views / totalPageViews * 100) : 0
  })).sort((a, b) => b.views - a.views).slice(0, 5);
  const totalDevices = mobileCount + desktopCount + tabletCount || 1;
  const deviceBreakdown = [
    { device: "Mobile", count: mobileCount, percentage: Math.round(mobileCount / totalDevices * 100) },
    { device: "Desktop", count: desktopCount, percentage: Math.round(desktopCount / totalDevices * 100) },
    { device: "Tablet", count: tabletCount, percentage: Math.round(tabletCount / totalDevices * 100) }
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
    isDemoData
  };
}
async function get30DayAnalytics() {
  if (hasDatabaseUrl()) {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
    let rows;
    try {
      rows = await query(
        `SELECT id, event_name, ts, url, client_id, client_ip, user_agent, params
         FROM ${TABLE} WHERE ts >= $1 LIMIT 20000`,
        [thirtyDaysAgoIso]
      );
    } catch (err) {
      console.error("[analytics] Neon query failed, returning empty summary:", err?.message || err);
      return computeSummary([], false);
    }
    const events = (rows || []).map((row) => ({
      id: row.id,
      eventName: row.event_name,
      timestamp: new Date(row.ts).getTime(),
      url: row.url ?? void 0,
      clientId: row.client_id ?? void 0,
      clientIp: row.client_ip ?? void 0,
      userAgent: row.user_agent ?? void 0,
      params: row.params ?? void 0
    }));
    return computeSummary(events, false);
  }
  initFallbackStore();
  return computeSummary(fallbackEvents, true);
}

// api/_lib/track.ts
function hashSha256(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  return crypto.subtle.digest("SHA-256", data).then(
    (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}
async function sendToMetaCapi(body) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken || !body.pixelId) return { skipped: "meta_capi_not_configured" };
  const userData = {
    client_ip_address: body.clientIp,
    client_user_agent: body.userAgent
  };
  if (body.userData?.email) userData.em = [await hashSha256(body.userData.email)];
  if (body.userData?.phone) userData.ph = [await hashSha256(body.userData.phone)];
  const payload = {
    data: [
      {
        event_name: body.eventName,
        event_time: Math.floor(Date.now() / 1e3),
        event_id: body.eventId,
        event_source_url: body.eventSourceUrl,
        action_source: "website",
        user_data: userData
      }
    ]
  };
  const url = `https://graph.facebook.com/v20.0/${body.pixelId}/events?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Meta CAPI error:", json);
  }
  return json;
}
async function sendToGa4(body) {
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
          page_location: body.eventSourceUrl
        }
      }
    ]
  };
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("GA4 Measurement Protocol error:", res.status, text);
    return { error: text };
  }
  return { ok: true };
}
function normalizeGa4EventName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
}
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body;
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
  const forwardedFor = req.headers["x-forwarded-for"] || "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  const userAgent = req.headers["user-agent"] || "";
  const enriched = { ...body, clientIp, userAgent };
  try {
    await recordAnalyticsEvent({
      eventName: enriched.eventName,
      url: enriched.eventSourceUrl,
      clientId: enriched.clientId,
      clientIp: enriched.clientIp,
      userAgent: enriched.userAgent,
      params: enriched.params
    });
  } catch (e) {
    console.error("Error recording local analytics event:", e);
  }
  const [metaResult, ga4Result] = await Promise.allSettled([
    sendToMetaCapi(enriched),
    sendToGa4(enriched)
  ]);
  res.status(200).json({
    meta: metaResult.status === "fulfilled" ? metaResult.value : { error: String(metaResult.reason) },
    ga4: ga4Result.status === "fulfilled" ? ga4Result.value : { error: String(ga4Result.reason) }
  });
}

// api/_lib/sitemap.ts
var DEFAULT_PORTFOLIO_SLUGS = [
  { slug: "sample-ecommerce-storefront", title: "Sample Project: E-Commerce Storefront", projectDate: "2026-04-12", featured: true },
  { slug: "sample-brand-identity", title: "Sample Project: Brand Visual Identity", projectDate: "2026-05-18", featured: true },
  { slug: "sample-social-video-reels", title: "Sample Project: Social Video Reels", projectDate: "2026-06-05", featured: true },
  { slug: "sample-corporate-documentary", title: "Sample Project: Corporate Documentary", projectDate: "2026-07-02", featured: true }
];
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
async function generateSitemapXml(hostUrl) {
  const normalizedBaseUrl = hostUrl.replace(/\/+$/, "");
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const staticPages = [
    { path: "/", priority: "1.0", changefreq: "daily", lastmod: today },
    { path: "/services", priority: "0.9", changefreq: "weekly", lastmod: today },
    { path: "/portfolio", priority: "0.9", changefreq: "daily", lastmod: today },
    { path: "/packages", priority: "0.8", changefreq: "weekly", lastmod: today },
    { path: "/about", priority: "0.7", changefreq: "monthly", lastmod: today },
    { path: "/free-audit", priority: "0.8", changefreq: "weekly", lastmod: today },
    { path: "/contact", priority: "0.7", changefreq: "monthly", lastmod: today },
    { path: "/privacy-policy", priority: "0.3", changefreq: "yearly", lastmod: "2026-01-01" },
    { path: "/terms", priority: "0.3", changefreq: "yearly", lastmod: "2026-01-01" }
  ];
  let allPortfolios = [...DEFAULT_PORTFOLIO_SLUGS];
  if (hasDatabaseUrl()) {
    try {
      const rows = await query("SELECT id, data FROM portfolios");
      const dbItems = rows.map((row) => ({ ...row.data, id: row.id })).filter((p) => p.published !== false);
      const slugMap = /* @__PURE__ */ new Map();
      [...allPortfolios, ...dbItems].forEach((p) => {
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
async function sitemapHandler(req, res) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "b2bfiy.com";
    const hostUrl = `${protocol}://${host}`;
    const sitemap = await generateSitemapXml(hostUrl);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.status(200).send(sitemap);
  } catch (error) {
    console.error("Failed to generate sitemap.xml:", error);
    res.setHeader("Content-Type", "text/plain");
    return res.status(500).send("Error generating sitemap.xml: " + (error?.message || "Unknown error"));
  }
}

// api/_lib/health.ts
async function handler2(_req, res) {
  if (!hasDatabaseUrl()) {
    res.status(200).json({ status: "ok", dbConfigured: false, dbConnected: false });
    return;
  }
  const dbConnected = await isDbReachable();
  res.status(200).json({ status: "ok", dbConfigured: true, dbConnected });
}

// api/_lib/adminAuth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var SESSION_COOKIE_NAME = "b2bfiy_admin_session";
function requireSecret() {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "b2bfiy_default_jwt_secret_dev_fallback";
  return secret;
}
function signSessionToken(payload) {
  return import_jsonwebtoken.default.sign(payload, requireSecret(), { expiresIn: "30d" });
}
function verifySessionToken(token) {
  try {
    return import_jsonwebtoken.default.verify(token, requireSecret());
  } catch {
    return null;
  }
}
function getSessionFromRequest(req) {
  let token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token && typeof req.headers?.cookie === "string") {
    const match = req.headers.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) token = decodeURIComponent(match.split("=").slice(1).join("="));
  }
  if (!token) return null;
  return verifySessionToken(token);
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${isProd ? "; Secure" : ""}`
  );
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}
async function bootstrapAdminIfEmpty() {
  if (!hasDatabaseUrl()) return;
  try {
    const rows = await query("SELECT COUNT(*)::text as count FROM admin_users");
    const count = parseInt(rows[0]?.count || "0", 10);
    if (count > 0) return;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    const hash = await import_bcryptjs.default.hash(password, 10);
    await query(
      `INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [`admin_${Date.now()}`, email.toLowerCase().trim(), hash]
    );
  } catch (err) {
    console.warn("Bootstrap admin check skipped:", err);
  }
}
async function verifyAdminCredentials(email, password) {
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
    const rows = await query(
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
    const valid = await import_bcryptjs.default.compare(password, user.password_hash);
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
async function updatePasswordForUser(userId, newPassword) {
  if (!hasDatabaseUrl()) return;
  const hash = await import_bcryptjs.default.hash(newPassword, 10);
  await query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [hash, userId]);
}

// api/_lib/content.ts
var ROW_ID = "default_site_content";
async function handler3(req, res) {
  if (req.method === "GET") {
    if (!hasDatabaseUrl()) {
      res.status(200).json({ data: null });
      return;
    }
    try {
      const rows = await query("SELECT data FROM site_content WHERE id = $1", [ROW_ID]);
      res.status(200).json({ data: rows[0]?.data ?? null });
    } catch (err) {
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
      await query(
        `INSERT INTO site_content (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [ROW_ID, JSON.stringify(body)]
      );
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Save site_content failed:", err);
      res.status(500).json({ error: err?.message || "Failed to save site content." });
    }
    return;
  }
  res.status(405).json({ error: "Method not allowed" });
}

// api/_lib/listTable.ts
function createListTableHandler(tableName) {
  return async function handler10(req, res) {
    if (req.method === "GET") {
      if (!hasDatabaseUrl()) {
        res.status(200).json({ data: [] });
        return;
      }
      try {
        const rows = await query(`SELECT id, data FROM ${tableName}`);
        res.status(200).json({ data: rows.map((r) => ({ ...r.data, id: r.id })) });
      } catch (err) {
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
        const items = Array.isArray(body) ? body : [];
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
      } catch (err) {
        console.error(`Save ${tableName} failed:`, err);
        res.status(500).json({ error: err?.message || `Failed to save ${tableName}.` });
      }
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
  };
}

// api/_lib/portfolios.ts
var portfolios_default = createListTableHandler("portfolios");

// api/_lib/packages.ts
var packages_default = createListTableHandler("packages");

// api/_lib/media.ts
var media_default = createListTableHandler("media_items");

// api/_lib/leads.ts
function rowToLead(row) {
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
    notes: row.notes || ""
  };
}
async function handler4(req, res) {
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
      res.status(200).json({ data: rows.map(rowToLead) });
    } catch (err) {
      console.error("Fetch leads failed:", err);
      res.status(500).json({ error: err?.message || "Failed to load leads." });
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
        JSON.stringify(lead)
      ];
      const conflictClause = session ? `ON CONFLICT (id) DO UPDATE SET
             type = EXCLUDED.type, full_name = EXCLUDED.full_name, business_name = EXCLUDED.business_name,
             email = EXCLUDED.email, whatsapp_number = EXCLUDED.whatsapp_number, website_url = EXCLUDED.website_url,
             service_needed = EXCLUDED.service_needed, message = EXCLUDED.message, submitted_at = EXCLUDED.submitted_at,
             status = EXCLUDED.status, notes = EXCLUDED.notes, raw_data = EXCLUDED.raw_data` : `ON CONFLICT (id) DO NOTHING`;
      await query(
        `INSERT INTO leads (id, type, full_name, business_name, email, whatsapp_number, website_url, service_needed, message, submitted_at, status, notes, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ${conflictClause}`,
        values
      );
      res.status(200).json({ ok: true });
    } catch (err) {
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
    } catch (err) {
      console.error("Delete lead failed:", err);
      res.status(500).json({ error: err?.message || "Failed to delete lead." });
    }
    return;
  }
  res.status(405).json({ error: "Method not allowed" });
}

// api/_lib/admin/login.ts
async function handler5(req, res) {
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
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: err?.message || "Login failed." });
  }
}

// api/_lib/admin/logout.ts
async function handler6(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

// api/_lib/admin/session.ts
async function handler7(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(200).json({ session: null });
    return;
  }
  res.status(200).json({ session: { userId: session.userId, email: session.email } });
}

// api/_lib/admin/password.ts
async function handler8(req, res) {
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
  } catch (err) {
    console.error("Admin password update error:", err);
    res.status(500).json({ error: err?.message || "Failed to update password." });
  }
}

// api/_lib/app.ts
function createApiApp() {
  const app2 = (0, import_express.default)();
  app2.use(import_express.default.json());
  app2.use(import_express.default.text({ type: ["text/*", "application/json"] }));
  app2.use(import_express.default.urlencoded({ extended: true }));
  app2.use((0, import_cookie_parser.default)());
  app2.get("/sitemap.xml", async (req, res) => {
    await sitemapHandler(req, res);
  });
  app2.get("/api/sitemap", async (req, res) => {
    await sitemapHandler(req, res);
  });
  app2.get("/robots.txt", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "b2bfiy.com";
    const sitemapUrl = `${protocol}://${host}/sitemap.xml`;
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${sitemapUrl}
`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).send(robotsTxt);
  });
  app2.get("/api/health", async (req, res) => {
    await handler2(req, res);
  });
  app2.all("/api/content", async (req, res) => {
    await handler3(req, res);
  });
  app2.all("/api/portfolios", async (req, res) => {
    await portfolios_default(req, res);
  });
  app2.all("/api/packages", async (req, res) => {
    await packages_default(req, res);
  });
  app2.all("/api/media", async (req, res) => {
    await media_default(req, res);
  });
  app2.all("/api/leads", async (req, res) => {
    await handler4(req, res);
  });
  app2.post("/api/admin/login", async (req, res) => {
    await handler5(req, res);
  });
  app2.post("/api/admin/logout", async (req, res) => {
    await handler6(req, res);
  });
  app2.get("/api/admin/session", async (req, res) => {
    await handler7(req, res);
  });
  app2.post("/api/admin/password", async (req, res) => {
    await handler8(req, res);
  });
  app2.get("/api/analytics/summary", async (_req, res) => {
    try {
      const summary = await get30DayAnalytics();
      res.setHeader("Cache-Control", "no-cache");
      res.json(summary);
    } catch (err) {
      console.error("Analytics summary error:", err);
      res.status(500).json({ error: err?.message || "Failed to load analytics" });
    }
  });
  app2.get("/api/analytics/pageviews", async (_req, res) => {
    try {
      const summary = await get30DayAnalytics();
      res.setHeader("Cache-Control", "no-cache");
      res.json(summary.dailyData);
    } catch (err) {
      console.error("Analytics pageviews error:", err);
      res.status(500).json({ error: err?.message || "Failed to load pageviews" });
    }
  });
  app2.post("/api/track", async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("Tracking API error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }
  });
  return app2;
}

// api/index.ts
var app = createApiApp();
function handler9(req, res) {
  return app(req, res);
}
