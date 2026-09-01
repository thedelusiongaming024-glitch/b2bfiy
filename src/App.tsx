import React, { useState, useEffect, Suspense, lazy } from "react";
import { Phone, Mail, Facebook, Instagram, Linkedin, MessageSquare, ShieldAlert, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
import { Lead, PortfolioProject, ServicePackage, SiteContent, MediaItem } from "./types";

// Neon database integration
import {
  fetchAllDataFromDb,
  saveSiteContentToDb,
  syncPortfoliosToDb,
  syncPackagesToDb,
  syncMediaItemsToDb,
  saveLeadToDb,
  deleteLeadFromDb,
  getDbStatus
} from "./lib/db";

// Data
import { initialSiteContent, initialPortfolios, initialPackages, initialMedia } from "./data/initialData";
import { trackPageView, trackLead } from "./lib/serverTracking";

// Components
import Header from "./components/Header";
import Footer from "./components/Footer";
import IntroSplash from "./components/IntroSplash";
import SiteBackground from "./components/SiteBackground";

// Pages
// Home is kept as an eager import since it's the most common landing page —
// no extra network round trip / loading flash for the majority of visitors.
import Home from "./pages/Home";
// Everything else is code-split: each page (and whatever it alone pulls in,
// e.g. Admin's recharts-based analytics chart) ships as its own chunk that
// only loads when a visitor actually navigates there.
const Services = lazy(() => import("./pages/Services"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Packages = lazy(() => import("./pages/Packages"));
const About = lazy(() => import("./pages/About"));
const FreeAudit = lazy(() => import("./pages/FreeAudit"));
const Contact = lazy(() => import("./pages/Contact"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const Admin = lazy(() => import("./pages/Admin"));

// Helper: Safe LocalStorage set to prevent QuotaExceededError
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`LocalStorage write failed for key "${key}" (likely quota exceeded):`, e);
    return false;
  }
}

// Helper: Custom stable sort for portfolios
// - Custom portfolios (with ID starting with "project-") appear at the top, sorted by timestamp descending
// - Standard initial portfolios appear at the bottom in their original numerical order (p1, p2, p3...)
export function sortPortfolios(items: PortfolioProject[]): PortfolioProject[] {
  return [...items].sort((a, b) => {
    const isCustomA = a.id.startsWith("project-");
    const isCustomB = b.id.startsWith("project-");
    
    if (isCustomA && !isCustomB) return -1;
    if (!isCustomA && isCustomB) return 1;
    
    if (isCustomA && isCustomB) {
      return b.id.localeCompare(a.id);
    }
    
    const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}

// Helper: Route Path Mapping
export function parseRouteFromLocation(): { route: string; slug: string } {
  try {
    const rawPath = window.location.pathname.replace(/\/+$/, "").toLowerCase();
    if (rawPath === "/admin") return { route: "admin", slug: "" };
    if (rawPath === "/services") return { route: "services", slug: "" };
    if (rawPath === "/portfolio") return { route: "portfolio", slug: "" };
    if (rawPath.startsWith("/portfolio/")) {
      const slug = window.location.pathname.replace(/^\/portfolio\//, "").replace(/\/+$/, "");
      return { route: "portfolio-detail", slug };
    }
    if (rawPath === "/packages") return { route: "packages", slug: "" };
    if (rawPath === "/about") return { route: "about", slug: "" };
    if (rawPath === "/free-audit") return { route: "free-audit", slug: "" };
    if (rawPath === "/contact") return { route: "contact", slug: "" };
    if (rawPath === "/privacy-policy") return { route: "privacy-policy", slug: "" };
    if (rawPath === "/terms") return { route: "terms", slug: "" };
  } catch {
    // fallback
  }
  return { route: "home", slug: "" };
}

export function getPathForRoute(route: string, slug?: string): string {
  switch (route) {
    case "services": return "/services";
    case "portfolio": return "/portfolio";
    case "portfolio-detail": return slug ? `/portfolio/${slug}` : "/portfolio";
    case "packages": return "/packages";
    case "about": return "/about";
    case "free-audit": return "/free-audit";
    case "contact": return "/contact";
    case "privacy-policy": return "/privacy-policy";
    case "terms": return "/terms";
    case "admin": return "/admin";
    default: return "/";
  }
}

export default function App() {
  const initialNav = parseRouteFromLocation();
  const [currentRoute, setCurrentRouteState] = useState<string>(initialNav.route);
  const [selectedProjectSlug, setSelectedProjectSlugState] = useState<string>(initialNav.slug);
  const [selectedPackageCategory, setSelectedPackageCategory] = useState<"monthly" | "website" | "graphic" | "video">("monthly");
  const [selectedPackageForContact, setSelectedPackageForContact] = useState<string>("");

  const setRoute = (newRoute: string, extraParam?: string) => {
    setCurrentRouteState(newRoute);

    if (newRoute === "packages" && extraParam && ["monthly", "website", "graphic", "video"].includes(extraParam)) {
      setSelectedPackageCategory(extraParam as "monthly" | "website" | "graphic" | "video");
    }

    if (newRoute === "contact") {
      if (extraParam) {
        setSelectedPackageForContact(extraParam);
      }
    }

    // For "portfolio-detail" the slug is passed in via extraParam (see
    // setSelectedProjectSlug below) rather than read from the
    // selectedProjectSlug state, since React state updates are async and
    // this function would otherwise compute the URL from a stale slug
    // whenever it's called right after setSelectedProjectSlug.
    const slugForPath = newRoute === "portfolio-detail" ? (extraParam || selectedProjectSlug) : undefined;

    try {
      const targetPath = getPathForRoute(newRoute, slugForPath);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ route: newRoute, slug: slugForPath }, "", targetPath);
      }
    } catch {
      // safe fallback
    }
  };

  const setSelectedProjectSlug = (slug: string) => {
    setSelectedProjectSlugState(slug);
    try {
      if (slug) {
        const targetPath = `/portfolio/${slug}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState({ route: "portfolio-detail", slug }, "", targetPath);
        }
      }
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromLocation();
      setCurrentRouteState(parsed.route);
      setSelectedProjectSlugState(parsed.slug);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      const hasSeen = sessionStorage.getItem("b2bfiy_seen_intro");
      return hasSeen !== "true";
    } catch {
      return true;
    }
  });

  const handleIntroComplete = () => {
    setShowIntro(false);
    try {
      sessionStorage.setItem("b2bfiy_seen_intro", "true");
    } catch (e) {
      console.warn("sessionStorage write failed:", e);
    }
  };

  // Central Dynamic State holding all entities
  const [siteContent, setSiteContent] = useState<SiteContent>(initialSiteContent);
  const [portfolios, setPortfolios] = useState<PortfolioProject[]>(() => sortPortfolios(initialPortfolios));
  const [packages, setPackages] = useState<ServicePackage[]>(initialPackages);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(initialMedia);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isDbSynced, setIsDbSynced] = useState<boolean>(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("b2bfiy_dark_mode");
      return saved === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("b2bfiy_dark_mode", String(darkMode));
    } catch (e) {
      console.warn("Storage write failed:", e);
    }
  }, [darkMode]);

  // 1. Read from localStorage on mount + Asynchronously synchronize with Neon for real-time updates
  useEffect(() => {
    // A. Sync from LocalStorage Cache first for instant load
    try {
      const storedContent = localStorage.getItem("b2bfiy_site_content");
      if (storedContent) setSiteContent(JSON.parse(storedContent));

      const storedPortfolios = localStorage.getItem("b2bfiy_portfolios");
      if (storedPortfolios) {
        setPortfolios(sortPortfolios(JSON.parse(storedPortfolios)));
      } else {
        setPortfolios(sortPortfolios(initialPortfolios));
      }

      const storedPackages = localStorage.getItem("b2bfiy_packages");
      if (storedPackages) setPackages(JSON.parse(storedPackages));

      const storedMedia = localStorage.getItem("b2bfiy_media_items");
      if (storedMedia) setMediaItems(JSON.parse(storedMedia));

      const storedLeads = localStorage.getItem("b2bfiy_leads");
      if (storedLeads) {
        setLeads(JSON.parse(storedLeads));
      }
      // NOTE: No mock/demo leads are seeded here. The Admin leads inbox starts
      // empty and only ever shows real submissions from the site's forms.
    } catch (err) {
      console.error("Failed to read from localStorage:", err);
    }

    // B. Query Neon in background to load updated values
    const syncWithDb = async () => {
      const { configured } = await getDbStatus();
      if (!configured) return;

      console.log("[Neon Sync] Database configured. Syncing data...");
      const dbData = await fetchAllDataFromDb();
      if (dbData) {
        if (dbData.siteContent) {
          setSiteContent(dbData.siteContent);
          safeSetLocalStorage("b2bfiy_site_content", JSON.stringify(dbData.siteContent));
        }
        if (dbData.portfolios !== null) {
          const sorted = sortPortfolios(dbData.portfolios);
          setPortfolios(sorted);
          safeSetLocalStorage("b2bfiy_portfolios", JSON.stringify(sorted));
        }
        if (dbData.packages !== null) {
          setPackages(dbData.packages);
          safeSetLocalStorage("b2bfiy_packages", JSON.stringify(dbData.packages));
        }
        if (dbData.mediaItems !== null) {
          setMediaItems(dbData.mediaItems);
          safeSetLocalStorage("b2bfiy_media_items", JSON.stringify(dbData.mediaItems));
        }
        if (dbData.leads !== null) {
          setLeads(dbData.leads);
          safeSetLocalStorage("b2bfiy_leads", JSON.stringify(dbData.leads));
        }
        setIsDbSynced(true);
        console.log("[Neon Sync] Successfully synchronized all states with database tables.");
      }
    };

    syncWithDb();
  }, []);

  // Update page title, favicon, SEO meta tags, Google Verification, and Meta Pixel dynamically when siteContent changes
  useEffect(() => {
    // 1. Dynamic Title
    const activeTitle = siteContent.metaTitle?.trim() || (siteContent.brandName ? `${siteContent.brandName} - Complete Creative Agency` : "B2bfiy - Digital Agency & Creative Solutions");
    document.title = activeTitle;

    // OpenGraph / Twitter Title
    let ogTitle = document.querySelector("meta[property='og:title']") as HTMLMetaElement | null;
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.getElementsByTagName("head")[0].appendChild(ogTitle);
    }
    ogTitle.content = activeTitle;

    let twitterTitle = document.querySelector("meta[name='twitter:title']") as HTMLMetaElement | null;
    if (!twitterTitle) {
      twitterTitle = document.createElement("meta");
      twitterTitle.name = "twitter:title";
      document.getElementsByTagName("head")[0].appendChild(twitterTitle);
    }
    twitterTitle.content = activeTitle;

    // 2. Dynamic Favicon
    if (siteContent.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.getElementsByTagName("head")[0].appendChild(link);
      }
      link.href = siteContent.faviconUrl;
    }

    // 3. Dynamic Meta Description
    if (siteContent.metaDescription) {
      let metaDesc = document.querySelector("meta[name='description']") as HTMLMetaElement | null;
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.name = "description";
        document.getElementsByTagName("head")[0].appendChild(metaDesc);
      }
      metaDesc.content = siteContent.metaDescription;

      let ogDesc = document.querySelector("meta[property='og:description']") as HTMLMetaElement | null;
      if (!ogDesc) {
        ogDesc = document.createElement("meta");
        ogDesc.setAttribute("property", "og:description");
        document.getElementsByTagName("head")[0].appendChild(ogDesc);
      }
      ogDesc.content = siteContent.metaDescription;

      let twDesc = document.querySelector("meta[name='twitter:description']") as HTMLMetaElement | null;
      if (!twDesc) {
        twDesc = document.createElement("meta");
        twDesc.name = "twitter:description";
        document.getElementsByTagName("head")[0].appendChild(twDesc);
      }
      twDesc.content = siteContent.metaDescription;
    }

    // 4. Dynamic Meta Keywords
    if (siteContent.seoKeywords) {
      let metaKey = document.querySelector("meta[name='keywords']") as HTMLMetaElement | null;
      if (!metaKey) {
        metaKey = document.createElement("meta");
        metaKey.name = "keywords";
        document.getElementsByTagName("head")[0].appendChild(metaKey);
      }
      metaKey.content = siteContent.seoKeywords;
    }

    // 5. Dynamic Google Site Verification
    if (siteContent.googleSiteVerification) {
      let metaGsv = document.querySelector("meta[name='google-site-verification']") as HTMLMetaElement | null;
      if (!metaGsv) {
        metaGsv = document.createElement("meta");
        metaGsv.name = "google-site-verification";
        document.getElementsByTagName("head")[0].appendChild(metaGsv);
      }
      metaGsv.content = siteContent.googleSiteVerification;
    }

    // 6. Dynamic Meta Pixel (Facebook Pixel) Setup
    if (siteContent.metaPixelId) {
      const pixelId = siteContent.metaPixelId.trim();
      if (pixelId && typeof window !== "undefined") {
        // Prevent duplicate script loading
        const scriptId = "meta-pixel-script";
        let existingScript = document.getElementById(scriptId);
        
        if (!existingScript) {
          // Meta Pixel base setup code
          (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
            if (f.fbq) return;
            n = f.fbq = function() {
              n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = !0;
            n.version = '2.0';
            n.queue = [];
            t = b.createElement(e);
            t.async = !0;
            t.src = v;
            t.id = scriptId;
            s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
          })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

          // Initialize Pixel. PageView is tracked separately (client + server,
          // deduplicated) by the route-change effect below, so we don't fire
          // it a second time here.
          try {
            (window as any).fbq('init', pixelId);
            console.log(`[SEO & Analytics] Meta Pixel ${pixelId} successfully initialized.`);
          } catch (e) {
            console.error("Meta Pixel execution error: ", e);
          }
        }
      }
    }
  }, [
    siteContent.brandName,
    siteContent.metaTitle,
    siteContent.faviconUrl,
    siteContent.metaDescription,
    siteContent.seoKeywords,
    siteContent.googleSiteVerification,
    siteContent.metaPixelId
  ]);

  // 6b. Server-side PageView tracking (Meta CAPI + GA4), fired on every route
  // change. Runs independently of whether the client-side Pixel script has
  // loaded, and is deduplicated against the client Pixel PageView via a
  // shared event_id (see src/lib/serverTracking.ts).
  useEffect(() => {
    if (currentRoute === "admin") return;
    trackPageView(siteContent.metaPixelId);
  }, [currentRoute, siteContent.metaPixelId]);

  // 2. LocalStorage & Neon Database Persistence Sync helpers
  const handleUpdateSiteContent = async (nextContent: SiteContent) => {
    setSiteContent(nextContent);
    safeSetLocalStorage("b2bfiy_site_content", JSON.stringify(nextContent));
    
    // Background sync to database
    try {
      const ok = await saveSiteContentToDb(nextContent);
      if (!ok) {
        console.warn("Neon site content sync returned false. LocalStorage updated.");
      }
    } catch (e) {
      console.warn("Neon background site content sync failed:", e);
    }
  };

  const handleUpdatePortfolios = async (nextPortfolios: PortfolioProject[]) => {
    const sorted = sortPortfolios(nextPortfolios);
    setPortfolios(sorted);
    safeSetLocalStorage("b2bfiy_portfolios", JSON.stringify(sorted));
    
    // Background sync to database
    try {
      const ok = await syncPortfoliosToDb(sorted);
      if (!ok) {
        console.warn("Neon portfolio sync returned false. LocalStorage updated.");
      }
    } catch (e) {
      console.warn("Neon background portfolio sync failed:", e);
    }
  };

  const handleUpdatePackages = async (nextPackages: ServicePackage[]) => {
    setPackages(nextPackages);
    safeSetLocalStorage("b2bfiy_packages", JSON.stringify(nextPackages));
    
    // Background sync to database
    try {
      const ok = await syncPackagesToDb(nextPackages);
      if (!ok) {
        console.warn("Neon packages sync returned false. LocalStorage updated.");
      }
    } catch (e) {
      console.warn("Neon background packages sync failed:", e);
    }
  };

  const handleUpdateMedia = async (nextMedia: MediaItem[]) => {
    setMediaItems(nextMedia);
    safeSetLocalStorage("b2bfiy_media_items", JSON.stringify(nextMedia));
    
    // Background sync to database
    try {
      const ok = await syncMediaItemsToDb(nextMedia);
      if (!ok) {
        console.warn("Neon media sync returned false. LocalStorage updated.");
      }
    } catch (e) {
      console.warn("Neon background media sync failed:", e);
    }
  };

  const handleLeadSubmit = async (newLead: Lead) => {
    const nextLeads = [newLead, ...leads];
    setLeads(nextLeads);
    safeSetLocalStorage("b2bfiy_leads", JSON.stringify(nextLeads));

    // Fire a Lead conversion event via client Pixel + server-side (Meta CAPI / GA4).
    try {
      trackLead(siteContent.metaPixelId, {
        email: (newLead as any).email,
        phone: (newLead as any).whatsappNumber,
      });
    } catch (e) {
      console.warn("Lead tracking dispatch failed:", e);
    }

    // Background sync to database
    try {
      await saveLeadToDb(newLead);
    } catch (e) {
      console.warn("Neon background lead submission failed:", e);
    }
  };

  const handleUpdateLead = async (leadId: string, updatedLead: Partial<Lead>) => {
    const nextLeads = leads.map((lead) => (lead.id === leadId ? { ...lead, ...updatedLead } : lead));
    setLeads(nextLeads);
    safeSetLocalStorage("b2bfiy_leads", JSON.stringify(nextLeads));
    
    // Background sync to database
    const fullLead = nextLeads.find(l => l.id === leadId);
    if (fullLead) {
      try {
        await saveLeadToDb(fullLead);
      } catch (e) {
        console.warn("Neon background lead update failed:", e);
      }
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    const nextLeads = leads.filter((lead) => lead.id !== leadId);
    setLeads(nextLeads);
    safeSetLocalStorage("b2bfiy_leads", JSON.stringify(nextLeads));
    
    // Background sync to database
    try {
      await deleteLeadFromDb(leadId);
    } catch (e) {
      console.warn("Neon background lead deletion failed:", e);
    }
  };

  // 3. Dynamic Page Selector Renderer
  const renderPage = () => {
    switch (currentRoute) {
      case "home":
        return (
          <Home
            setRoute={setRoute}
            setSelectedProjectSlug={setSelectedProjectSlug}
            siteContent={siteContent}
            portfolios={portfolios}
            packages={packages}
            onLeadSubmit={handleLeadSubmit}
          />
        );
      case "services":
        return (
          <Services
            setRoute={setRoute}
            siteContent={siteContent}
            packages={packages}
            onLeadSubmit={handleLeadSubmit}
          />
        );
      case "portfolio":
        return (
          <Portfolio
            setRoute={setRoute}
            setSelectedProjectSlug={setSelectedProjectSlug}
            portfolios={portfolios}
            siteContent={siteContent}
          />
        );
      case "portfolio-detail":
        return (
          <ProjectDetail
            setRoute={setRoute}
            slug={selectedProjectSlug}
            portfolios={portfolios}
          />
        );
      case "packages":
        return (
          <Packages
            setRoute={setRoute}
            siteContent={siteContent}
            packages={packages}
            selectedCategory={selectedPackageCategory}
            onSelectCategory={setSelectedPackageCategory}
          />
        );
      case "about":
        return <About setRoute={setRoute} siteContent={siteContent} />;
      case "free-audit":
        return (
          <FreeAudit
            setRoute={setRoute}
            siteContent={siteContent}
            onLeadSubmit={handleLeadSubmit}
          />
        );
      case "contact":
        return (
          <Contact
            setRoute={setRoute}
            siteContent={siteContent}
            onLeadSubmit={handleLeadSubmit}
            prefilledService={selectedPackageForContact}
          />
        );
      case "privacy-policy":
        return <PrivacyPolicy siteContent={siteContent} />;
      case "terms":
        return <Terms siteContent={siteContent} />;
      case "admin":
        return (
          <Admin
            leads={leads}
            onUpdateLead={handleUpdateLead}
            onDeleteLead={handleDeleteLead}
            portfolios={portfolios}
            onUpdatePortfolios={handleUpdatePortfolios}
            packages={packages}
            onUpdatePackages={handleUpdatePackages}
            siteContent={siteContent}
            onUpdateSiteContent={handleUpdateSiteContent}
            mediaItems={mediaItems}
            onUpdateMedia={handleUpdateMedia}
          />
        );
      default:
        return (
          <Home
            setRoute={setRoute}
            setSelectedProjectSlug={setSelectedProjectSlug}
            siteContent={siteContent}
            portfolios={portfolios}
            packages={packages}
          />
        );
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {showIntro && (
          <IntroSplash onComplete={handleIntroComplete} />
        )}
      </AnimatePresence>

      {/* FIXED PREMIUM BACKGROUND (stays put while the page scrolls over it) */}
      <SiteBackground />

      <div className="flex flex-col min-h-screen text-[#101828] dark:text-gray-100 font-sans transition-colors duration-300 relative selection:bg-[#FF2D2D] selection:text-white">
        {/* 1. FLOATING STICKY HEADER */}
      <Header 
        currentRoute={currentRoute} 
        setRoute={setRoute} 
        siteContent={siteContent} 
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* 2. ACTIVE MAIN PAGE VIEW */}
      <main className="flex-grow">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-10 h-10 border-4 border-[#FF2D2D] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {renderPage()}
        </Suspense>
      </main>

      {/* 4. MULTI-COLUMN PROFESSIONAL FOOTER */}
      <Footer setRoute={setRoute} siteContent={siteContent} />

      {/* FLOATING SUPPORT WIDGETS (WHATSAPP & CALL) */}
      {siteContent.showFloatingButtons !== false && currentRoute !== "admin" && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-4">
          {/* Call Widget */}
          {siteContent.floatingCall && (
            <motion.a
              href={`tel:${siteContent.floatingCall.replace(/[^0-9+]/g, "")}`}
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-[#FF2D2D] text-white shadow-xl group relative cursor-pointer"
              aria-label="Call Support"
            >
              <div>
                <Phone className="w-6 h-6" />
              </div>

              <span className="absolute right-16 bg-[#101828] text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-xl transform translate-x-2 group-hover:translate-x-0">
                Call: {siteContent.floatingCall}
              </span>
            </motion.a>
          )}

          {/* WhatsApp Widget */}
          {siteContent.floatingWhatsApp && (
            <motion.a
              href={`https://wa.me/${siteContent.floatingWhatsApp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl group relative cursor-pointer"
              aria-label="WhatsApp Support"
            >
              <div>
                <MessageCircle className="w-6.5 h-6.5 fill-white text-[#25D366]" />
              </div>

              <span className="absolute right-16 bg-[#101828] text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-xl transform translate-x-2 group-hover:translate-x-0">
                WhatsApp Chat
              </span>
            </motion.a>
          )}
        </div>
      )}

    </div>
    </>
  );
}
