import { Request, Response } from "express";
import { initialPortfolios } from "../src/data/initialData.ts";
import { query, hasDatabaseUrl } from "./db.ts";

function escapeXml(unsafe: string): string {
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

export async function generateSitemapXml(hostUrl: string): Promise<string> {
  const normalizedBaseUrl = hostUrl.replace(/\/+$/, "");
  const today = new Date().toISOString().split("T")[0];

  // 1. Static core pages
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

  // 2. Fetch portfolios (from initial data + Neon if available)
  let allPortfolios = [...initialPortfolios];

  if (hasDatabaseUrl()) {
    try {
      const rows = await query<{ id: string; data: any }>("SELECT id, data FROM portfolios");
      const dbItems = rows
        .map((row) => ({ ...row.data, id: row.id }))
        .filter((p: any) => p.published !== false);

      // Combine unique by slug
      const slugMap = new Map();
      [...allPortfolios, ...dbItems].forEach((p: any) => {
        if (p.slug && p.published !== false) {
          slugMap.set(p.slug, p);
        }
      });
      allPortfolios = Array.from(slugMap.values());
    } catch (e) {
      console.warn("Could not fetch portfolios from Neon for sitemap:", e);
    }
  }

  // 3. Build XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

  // Append static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${escapeXml(`${normalizedBaseUrl}${page.path}`)}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Append portfolio projects
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

export default async function sitemapHandler(req: Request, res: Response) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "b2bfiy.com";
    const hostUrl = `${protocol}://${host}`;

    const sitemap = await generateSitemapXml(hostUrl);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.status(200).send(sitemap);
  } catch (error: any) {
    console.error("Failed to generate sitemap.xml:", error);
    res.setHeader("Content-Type", "text/plain");
    return res.status(500).send("Error generating sitemap.xml: " + (error?.message || "Unknown error"));
  }
}
