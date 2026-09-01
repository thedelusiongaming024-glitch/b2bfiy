import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import trackHandler from "./api/track.ts";
import sitemapHandler from "./api/sitemap.ts";
import healthHandler from "./api/health.ts";
import contentHandler from "./api/content.ts";
import portfoliosHandler from "./api/portfolios.ts";
import packagesHandler from "./api/packages.ts";
import mediaHandler from "./api/media.ts";
import leadsHandler from "./api/leads.ts";
import adminLoginHandler from "./api/admin/login.ts";
import adminLogoutHandler from "./api/admin/logout.ts";
import adminSessionHandler from "./api/admin/session.ts";
import adminPasswordHandler from "./api/admin/password.ts";
import { get30DayAnalytics } from "./api/analyticsStore.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON, text/raw, and cookie parsers
  app.use(express.json());
  app.use(express.text({ type: ["text/*", "application/json"] }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Dynamic Sitemap XML Route
  app.get("/sitemap.xml", async (req, res) => {
    await sitemapHandler(req, res);
  });

  app.get("/api/sitemap", async (req, res) => {
    await sitemapHandler(req, res);
  });

  // Dynamic Robots.txt Route
  app.get("/robots.txt", (req, res) => {
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

  // Health / DB connectivity
  app.get("/api/health", async (req, res) => {
    await healthHandler(req, res);
  });

  // Neon-backed data routes (each handler internally branches on req.method)
  app.all("/api/content", async (req, res) => {
    await contentHandler(req, res);
  });
  app.all("/api/portfolios", async (req, res) => {
    await portfoliosHandler(req, res);
  });
  app.all("/api/packages", async (req, res) => {
    await packagesHandler(req, res);
  });
  app.all("/api/media", async (req, res) => {
    await mediaHandler(req, res);
  });
  app.all("/api/leads", async (req, res) => {
    await leadsHandler(req, res);
  });

  // Admin auth routes
  app.post("/api/admin/login", async (req, res) => {
    await adminLoginHandler(req, res);
  });
  app.post("/api/admin/logout", async (req, res) => {
    await adminLogoutHandler(req, res);
  });
  app.get("/api/admin/session", async (req, res) => {
    await adminSessionHandler(req, res);
  });
  app.post("/api/admin/password", async (req, res) => {
    await adminPasswordHandler(req, res);
  });

  // Server-side 30-day analytics endpoint
  app.get("/api/analytics/summary", async (_req, res) => {
    try {
      const summary = await get30DayAnalytics();
      res.setHeader("Cache-Control", "no-cache");
      res.json(summary);
    } catch (err: any) {
      console.error("Analytics summary error:", err);
      res.status(500).json({ error: err?.message || "Failed to load analytics" });
    }
  });

  app.get("/api/analytics/pageviews", async (_req, res) => {
    try {
      const summary = await get30DayAnalytics();
      res.setHeader("Cache-Control", "no-cache");
      res.json(summary.dailyData);
    } catch (err: any) {
      console.error("Analytics pageviews error:", err);
      res.status(500).json({ error: err?.message || "Failed to load pageviews" });
    }
  });

  app.post("/api/track", async (req, res) => {
    try {
      await trackHandler(req, res);
    } catch (err: any) {
      console.error("Tracking API error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Internal server error" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
