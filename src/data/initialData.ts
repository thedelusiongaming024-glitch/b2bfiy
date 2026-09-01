import { PortfolioProject, ServicePackage, SiteContent, MediaItem } from "../types";

export const initialSiteContent: SiteContent = {
  phone: "+880 1712-345678",
  email: "hello@b2bfiy.com",
  viewAllGraphicsLink: "https://www.behance.net",
  socials: {
    facebook: "https://facebook.com/b2bfiy",
    instagram: "https://instagram.com/b2bfiy",
    linkedin: "https://linkedin.com/company/b2bfiy",
    whatsapp: "https://wa.me/8801712345678",
  },
  hero: {
    badge: "Your Digital Growth Partner",
    title: "Build a Powerful Digital Presence That Helps Your Business Grow.",
    highlight: "Digital Presence",
    description: "From high-converting websites and professional graphic design to engaging video content and complete social media management — B2bfiy gives your business the digital support it needs to stand out and grow.",
    trustText: "One creative team for your complete digital presence.",
    imageUrl: "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?auto=format&fit=crop&w=800&q=80",
  },
  // NOTE: Placeholder until real numbers are added via Admin -- do not
  // display unverified stats as fact on the live site.
  stats: [
    { id: "stat-1", value: "—", label: "Projects Completed" },
    { id: "stat-2", value: "—", label: "Happy Clients" },
    { id: "stat-3", value: "—", label: "Years of Experience" },
    { id: "stat-4", value: "—", label: "Client Satisfaction" },
  ],
  whyChooseUs: [
    { title: "One Team for Everything", description: "No more juggling multiple freelancers. We handle development, design, editing, and management under one roof." },
    { title: "Custom Solutions", description: "We don't use generic templates. Every strategy, design, and website is custom-crafted for your specific target audience." },
    { title: "Professional Quality", description: "Our team consists of expert designers, skilled developers, and creative video editors dedicated to premium output." },
    { title: "Fast Communication", description: "Stay updated always. We offer daily communications, clear deadlines, and quick turnaround times." },
    { title: "Affordable Packages", description: "Get agency-grade results at transparent, predictable, and fair pricing structured to scale with your business." },
    { title: "Ongoing Support", description: "We don't just launch and leave. B2bfiy provides continuous support, maintenance, and growth consulting." },
  ],
  // NOTE: Placeholder category labels only, not real partner/client names.
  // Swap in real client logos via the Admin panel once available.
  partners: [
    { id: "partner-1", name: "E-Commerce Brand" },
    { id: "partner-2", name: "Restaurant Group" },
    { id: "partner-3", name: "Local Retailer" },
    { id: "partner-4", name: "Dental Clinic" },
    { id: "partner-5", name: "Tech Startup" }
  ],
  // NOTE: Placeholder examples only -- no fabricated client names, photos, or
  // claimed results. Swap in real client testimonials via the Admin panel.
  testimonials: [
    {
      id: "rev-1",
      name: "Client Name",
      role: "Business Owner, E-Commerce",
      avatar: "",
      text: "This spot is reserved for a real client testimonial. Add one from the Admin panel once your first review comes in.",
      textBn: "এই জায়গাটি একটি বাস্তব ক্লায়েন্ট রিভিউর জন্য রাখা হয়েছে। প্রথম রিভিউ পাওয়ার পর অ্যাডমিন প্যানেল থেকে এটি যোগ করুন।",
      rating: 5
    },
    {
      id: "rev-2",
      name: "Client Name",
      role: "Business Owner, Local Service",
      avatar: "",
      text: "This spot is reserved for a real client testimonial. Add one from the Admin panel once your first review comes in.",
      textBn: "এই জায়গাটি একটি বাস্তব ক্লায়েন্ট রিভিউর জন্য রাখা হয়েছে। প্রথম রিভিউ পাওয়ার পর অ্যাডমিন প্যানেল থেকে এটি যোগ করুন।",
      rating: 5
    },
    {
      id: "rev-3",
      name: "Client Name",
      role: "Business Owner, Retail",
      avatar: "",
      text: "This spot is reserved for a real client testimonial. Add one from the Admin panel once your first review comes in.",
      textBn: "এই জায়গাটি একটি বাস্তব ক্লায়েন্ট রিভিউর জন্য রাখা হয়েছে। প্রথম রিভিউ পাওয়ার পর অ্যাডমিন প্যানেল থেকে এটি যোগ করুন।",
      rating: 5
    }
  ],
  about: {
    badge: "About B2bfiy",
    title: "The Dedicated Creative & Growth Engine For Your Business",
    description: "We are a team of expert creators, engineers, and marketers aligned to construct professional corporate web platforms, designs, and reels to help brands scale up.",
    missionTitle: "Bridging High-Fidelity Creative Quality and Affordable Predictability",
    missionDesc1: "Managing five separate freelance contracts is chaotic. One delivers slow code, another misses graphic styles, and a third stops replying during launch. B2bfiy was founded in Dhaka to establish a single reliable, professional creative team that business owners can delegate to.",
    missionDesc2: "We leverage modern technology, custom design systems, and cinematic short-form frameworks to elevate small brands, medical clinics, restaurants, and startups globally into trustworthy digital icons.",
    coreValues: [
      {
        title: "Results-First Execution",
        desc: "We don't prioritize vanity likes or useless visits. We build high-performance pipelines engineered to attract paying customers."
      },
      {
        title: "Absolute Transparency",
        desc: "No hidden setup costs, unexpected fees, or secret markups. Everything is communicated and priced upfront clearly."
      },
      {
        title: "Speed & Communication",
        desc: "Our teams coordinate via modern communication panels to answer questions within minutes and deliver designs on time."
      }
    ],
    founders: [
      {
        emoji: "👨‍💻",
        role: "Founder",
        name: "B2bfiy Founder",
        description: "Leads development, design direction, and client strategy across every project."
      }
    ]
  },
  footerDesc: "We help businesses build a powerful digital presence through high-converting websites, professional graphic design, engaging video content, and complete social media management.",
  copyright: "© 2026 B2bfiy. All rights reserved.",
  metaTitle: "B2bfiy - Digital Agency & Creative Solutions",
  seoKeywords: "digital presence, creative agency Dhaka, website development Bangladesh, video editing service, premium graphic design, social media management, SEO optimization",
  metaDescription: "B2bfiy is a complete digital presence agency helping businesses grow through high-converting websites, premium graphics, engaging reels, and result-oriented social media campaigns.",
  googleSiteVerification: "",
  metaPixelId: "",
  ga4MeasurementId: "",
  floatingWhatsApp: "+8801712345678",
  floatingCall: "+8801712345678",
  showFloatingButtons: true,
  privacyPolicy: {
    lastUpdated: "July 19, 2026",
    introduction: "B2bfiy (“we,” “our,” or “us”) respects your privacy. This document outlines how we collect, process, and safeguard the information you provide when using our digital agency website, requesting free audits, or ordering monthly creative services.",
    informationCollect: "When you interact with our forms, we collect the following:\n\n• Contact Parameters: Full Name, email address, WhatsApp contact number.\n• Business Information: Company Name, existing website or Facebook page URL.\n• Project Guidelines: Desired service models, message texts, or audit contexts.",
    howWeProcess: "We process your submitted leads to:\n\n• Analyze your online representation and deliver the Free Digital Audit document.\n• Coordinate project deliverables and pricing quotes via email/WhatsApp.\n• Dispatch periodic performance updates and billing statements to monthly partners.",
    security: "We apply server-side encryption protocols and database protection firewalls to prevent unauthorized access, alteration, or data leaks. We do not sell or lease your business handles, email directories, or WhatsApp numbers to third-party marketing brokers.",
    contact: "If you have any questions or require your lead history removed from our administrative console database, please contact us directly at hello@b2bfiy.com."
  },
  terms: {
    lastUpdated: "July 19, 2026",
    scope: "By subscribing to B2bfiy monthly retainers or ordering custom website developments, you agree to coordinate with our project directors on layout requirements, content copy, or video edits on a regular basis.",
    billing: "Monthly growth retainers (Starter, Growth, Premium) require upfront payment at the start of each billing cycle month. Project-based custom web developments are split into milestone payments (typically 50% deposit and 50% upon final production approval).",
    ipOwnership: "Upon complete clearance of billing invoices, the client receives 100% full intellectual property ownership of all finalized custom websites, graphics, logos, layouts, and cinematic reel files. B2bfiy retains the right to display the finalized items in our public portfolio collection unless explicitly requested otherwise in writing.",
    cancellation: "Monthly subscription retainers can be cancelled or modified by providing a 7-day written notice before the next billing cycle. We do not provide prorated refunds for active design cycles once assets are delivered.",
    contact: "These terms shall be governed by applicable commercial laws. For official legal service notices, please email hello@b2bfiy.com."
  },
  serviceImages: {
    webDev: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80",
    graphic: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80",
    video: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    social: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80"
  }
};

export const initialPortfolios: PortfolioProject[] = [
  // NOTE: These are illustrative sample case studies to show the page layout --
  // not real clients, and no fabricated results/stats. Replace with real
  // portfolio projects via the Admin panel as they're completed.
  {
    id: "p1",
    title: "Sample Project: E-Commerce Platform",
    slug: "sample-ecommerce-platform",
    clientName: "Example Client",
    category: "Website Development",
    thumbnail: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
    ],
    projectDate: "2026-04-12",
    shortDescription: "Example layout for an e-commerce project case study -- a modern, fast storefront for an online food provider.",
    fullDescription: "This is a placeholder case study showing how a website development project would be presented: the client's need, our approach, and the outcome.",
    clientChallenge: "Placeholder text describing the client's starting problem (e.g. a slow, outdated site with poor mobile checkout).",
    ourSolution: "Placeholder text describing the approach taken (e.g. a custom-built storefront with a streamlined checkout flow).",
    workProcess: [
      "Discovery & wireframing of the user buying journey.",
      "Custom UI/UX prototype design.",
      "Frontend development with responsive optimization.",
      "Ordering integration, automations, and secure deployment."
    ],
    projectResult: "Add the real, measurable outcome here once this becomes an actual completed project.",
    technologies: ["React", "Tailwind CSS", "Vite", "Framer Motion"],
    tags: ["E-Commerce", "Web Development", "Responsive Design"],
    seoTitle: "Sample E-Commerce Website Case Study | B2bfiy",
    seoDescription: "Example case study layout for an e-commerce website project.",
    featured: true,
    published: true,
  },
  {
    id: "p2",
    title: "Sample Project: Brand Visual Identity",
    slug: "sample-brand-identity",
    clientName: "Example Client",
    category: "Graphic Design",
    thumbnail: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517838448704-a32910584bb0?auto=format&fit=crop&w=1200&q=80"
    ],
    projectDate: "2026-05-18",
    shortDescription: "Example layout for a branding project case study -- a full visual identity suite for a fitness brand.",
    fullDescription: "This is a placeholder case study showing how a branding project would be presented: the client's need, our approach, and the outcome.",
    clientChallenge: "Placeholder text describing the client's starting problem (e.g. an inconsistent, dated visual identity).",
    ourSolution: "Placeholder text describing the approach taken (e.g. a cohesive brand system with logo, typography, and templates).",
    workProcess: [
      "Moodboard curation matching the brand's target aesthetic.",
      "Logo concept development and typographic testing.",
      "Brand book & style guide generation.",
      "Collateral design for banners, flyers, and packaging."
    ],
    projectResult: "Add the real, measurable outcome here once this becomes an actual completed project.",
    technologies: ["Adobe Illustrator", "Photoshop", "Brand Strategy", "Typography"],
    tags: ["Branding", "Social Assets", "Logo Design"],
    featured: true,
    published: true,
  },
  {
    id: "p3",
    title: "Sample Project: Social Video Reels",
    slug: "sample-social-video-reels",
    clientName: "Example Client",
    category: "Video Editing",
    subCategory: "Reels",
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"
    ],
    projectDate: "2026-06-05",
    shortDescription: "Example layout for a short-form video case study -- high-energy social reels for a restaurant brand.",
    fullDescription: "This is a placeholder case study showing how a video editing project would be presented: the client's need, our approach, and the outcome. Video preview coming soon.",
    clientChallenge: "Placeholder text describing the client's starting problem (e.g. raw footage with low viewer retention).",
    ourSolution: "Placeholder text describing the approach taken (e.g. professional color grading, pacing, and captions).",
    workProcess: [
      "Footage review and storyboarding.",
      "Audio synchronization & beat-matching.",
      "Color grading, captions, sound design & transitions.",
      "Format rendering optimized for vertical feeds."
    ],
    projectResult: "Add the real, measurable outcome here once this becomes an actual completed project.",
    technologies: ["Premiere Pro", "After Effects", "Sound Design", "Color Grading"],
    tags: ["Short Form Video", "Reels", "Cinematic Promo"],
    featured: true,
    published: true,
    imageAspectRatio: "square",
    imageFit: "cover"
  },
  {
    id: "p5",
    title: "Sample Project: Corporate Documentary",
    slug: "sample-corporate-documentary",
    clientName: "Example Client",
    category: "Video Editing",
    subCategory: "Long Video",
    thumbnail: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80"
    ],
    projectDate: "2026-07-02",
    shortDescription: "Example layout for a long-form video case study -- a corporate culture documentary. Video preview coming soon.",
    fullDescription: "This is a placeholder case study showing how a long-form corporate video project would be presented: the client's need, our approach, and the outcome.",
    clientChallenge: "Placeholder text describing the client's starting problem (e.g. hours of raw footage needing a compelling narrative).",
    ourSolution: "Placeholder text describing the approach taken (e.g. scripted narrative structure, motion graphics, and grading).",
    workProcess: [
      "Scripting, transcription indexing, and footage selects.",
      "A/B roll assembly and structural narrative edit.",
      "Motion graphics overlays and typography.",
      "Audio sweetening, sound effects, and color grading."
    ],
    projectResult: "Add the real, measurable outcome here once this becomes an actual completed project.",
    technologies: ["Premiere Pro", "After Effects", "Davinci Resolve", "Audition"],
    tags: ["Corporate Video", "Long Form", "Brand Documentary"],
    featured: true,
    published: true,
    imageAspectRatio: "square",
    imageFit: "cover"
  },
  {
    id: "p6",
    title: "Sample Project: Brand Motion Opener",
    slug: "sample-brand-motion-opener",
    clientName: "Example Client",
    category: "Video Editing",
    subCategory: "Motion Video",
    thumbnail: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80"
    ],
    projectDate: "2026-07-15",
    shortDescription: "Example layout for a 3D motion graphics case study -- a brand introduction video for a beauty launch. Video preview coming soon.",
    fullDescription: "This is a placeholder case study showing how a motion graphics project would be presented: the client's need, our approach, and the outcome.",
    clientChallenge: "Placeholder text describing the client's starting problem (e.g. needing a premium, high-end product launch teaser).",
    ourSolution: "Placeholder text describing the approach taken (e.g. 3D simulation, kinetic typography, and sound design).",
    workProcess: [
      "Style framing & storyboarding.",
      "3D modeling and simulation.",
      "Cinematic camera work and typography layout.",
      "Sound design and color grading."
    ],
    projectResult: "Add the real, measurable outcome here once this becomes an actual completed project.",
    technologies: ["After Effects", "Cinema 4D", "Octane Render", "Premiere Pro"],
    tags: ["Motion Graphics", "3D Animation", "Brand Promo"],
    featured: true,
    published: true,
    imageAspectRatio: "square",
    imageFit: "cover"
  },
  {
    id: "p4",
    title: "Sample Project: Social Media Management",
    slug: "sample-social-media-management",
    clientName: "Example Client",
    category: "Social Media Management",
    thumbnail: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80"
    ],
    projectDate: "2026-06-25",
    shortDescription: "Example layout for a social media management case study -- ongoing page management for a local clinic.",
    fullDescription: "This is a placeholder case study showing how a social media management engagement would be presented: the client's need, our approach, and the outcome.",
    clientChallenge: "Placeholder text describing the client's starting problem (e.g. no time to plan content, low engagement).",
    ourSolution: "Placeholder text describing the approach taken (e.g. a monthly content calendar and inbox management).",
    workProcess: [
      "Target audience research and brand voice alignment.",
      "Monthly calendar planning & copywriting.",
      "Graphic layouts & short-form edits.",
      "Daily scheduling, monitoring, and monthly reporting."
    ],
    projectResult: "Add the real, measurable outcome here once this becomes an actual completed project.",
    technologies: ["Facebook Suite", "Canva Pro", "Copywriting", "Page Optimization"],
    tags: ["Social Media Management", "Lead Gen"],
    featured: true,
    published: true,
  }
];

export const initialPackages: ServicePackage[] = [
  // Monthly Packages
  {
    id: "m1",
    type: "monthly",
    title: "STARTER",
    price: "৳12,000",
    period: "Month",
    isPopular: false,
    features: [
      "12 Professional Social Media Designs",
      "4 Short-Form Videos / Reels",
      "Facebook Page Management",
      "Content Planning",
      "Captions & Hashtags",
      "Monthly Content Calendar",
      "Basic Page Optimization",
      "Monthly Performance Report"
    ],
    ctaText: "Get Started",
    published: true,
  },
  {
    id: "m2",
    type: "monthly",
    title: "GROWTH",
    price: "৳25,000",
    period: "Month",
    isPopular: true,
    features: [
      "20 Professional Social Media Designs",
      "8 Short-Form Videos / Reels",
      "Facebook Page Management",
      "Content Strategy",
      "Professional Captions & Hashtags",
      "Monthly Content Calendar",
      "Facebook Page Optimization",
      "Basic Ad Campaign Setup",
      "Monthly Performance Report",
      "Priority Support"
    ],
    ctaText: "Grow Your Business",
    published: true,
  },
  {
    id: "m3",
    type: "monthly",
    title: "PREMIUM GROWTH",
    price: "৳45,000",
    period: "Month",
    isPopular: false,
    features: [
      "30 Premium Social Media Designs",
      "12 Short-Form Videos / Reels",
      "Complete Facebook Management",
      "Content Strategy & Planning",
      "Captions & Hashtags",
      "Monthly Content Calendar",
      "Facebook Page Optimization",
      "Ad Campaign Management",
      "Monthly Strategy Consultation",
      "Detailed Performance Report",
      "Priority Support",
      "BONUS: Professional Business Landing Page"
    ],
    ctaText: "Book a Free Consultation",
    published: true,
  },

  // Website Packages
  {
    id: "w1",
    type: "website",
    title: "STARTER WEBSITE",
    price: "৳15,000",
    period: "Project",
    isPopular: false,
    features: [
      "Up to 5 Pages",
      "Modern Professional Design",
      "Mobile Responsive",
      "Contact Form",
      "WhatsApp Integration",
      "Basic SEO Setup",
      "Social Media Integration",
      "SSL Setup Assistance"
    ],
    deliveryTime: "7–10 Business Days",
    ctaText: "Choose Starter Web",
    published: true,
  },
  {
    id: "w2",
    type: "website",
    title: "BUSINESS WEBSITE",
    price: "৳30,000",
    period: "Project",
    isPopular: true,
    features: [
      "Up to 10 Pages",
      "Premium Custom Design",
      "Modern Animations",
      "Mobile & Tablet Responsive",
      "Lead Generation Forms",
      "WhatsApp Integration",
      "Basic SEO",
      "Speed Optimization",
      "Google Analytics Setup",
      "Admin Dashboard / CMS",
      "30 Days Support"
    ],
    deliveryTime: "10–20 Business Days",
    ctaText: "Choose Business Web",
    published: true,
  },
  {
    id: "w3",
    type: "website",
    title: "CUSTOM / E-COMMERCE WEBSITE",
    price: "৳50,000",
    period: "Project",
    isPopular: false,
    features: [
      "Custom UI/UX Design",
      "Product Management",
      "Shopping Cart & Checkout",
      "Payment Gateway Integration",
      "Customer Account System",
      "Order Management",
      "Admin Dashboard",
      "SEO Setup",
      "Performance Optimization",
      "Security Configuration",
      "60 Days Support"
    ],
    deliveryTime: "20–30 Business Days",
    ctaText: "Request a Custom Quote",
    published: true,
  },

  // Graphic Design Packages
  {
    id: "g1",
    type: "graphic",
    title: "SOCIAL STARTER",
    price: "৳5,000",
    period: "Package",
    isPopular: false,
    features: [
      "10 Social Media Designs",
      "Custom Brand Style",
      "2 Revisions Per Design",
      "High-Resolution Formats",
      "Source Files Included"
    ],
    ctaText: "Get Social Starter",
    published: true,
  },
  {
    id: "g2",
    type: "graphic",
    title: "BUSINESS CONTENT",
    price: "৳10,000",
    period: "Package",
    isPopular: true,
    features: [
      "20 Social Media Designs",
      "Custom Brand Style",
      "Promotional Creatives",
      "Cover / Banner Design",
      "Priority Delivery",
      "Source Files & Revisions"
    ],
    ctaText: "Get Business Content",
    published: true,
  },
  {
    id: "g3",
    type: "graphic",
    title: "MONTHLY DESIGN PARTNER",
    price: "৳18,000",
    period: "Month",
    isPopular: false,
    features: [
      "Up to 30 Social Media Designs",
      "Marketing Creatives",
      "Promotional Campaign Designs",
      "Consistent Brand Style",
      "Priority Support",
      "Dedicated Designer Channel"
    ],
    ctaText: "Become Design Partner",
    published: true,
  },

  // Video Editing Packages
  {
    id: "v1",
    type: "video",
    title: "REELS STARTER",
    price: "৳6,000",
    period: "Package",
    isPopular: false,
    features: [
      "4 Short Videos / Reels",
      "Professional Editing",
      "Captions",
      "Transitions & Effects",
      "Background Music",
      "Full HD Delivery"
    ],
    ctaText: "Get Reels Starter",
    published: true,
  },
  {
    id: "v2",
    type: "video",
    title: "CONTENT GROWTH",
    price: "৳12,000",
    period: "Package",
    isPopular: true,
    features: [
      "8 Short Videos / Reels",
      "Professional Editing",
      "Animated Captions",
      "Sound Design",
      "Motion Graphics",
      "Revision Support"
    ],
    ctaText: "Get Content Growth",
    published: true,
  },
  {
    id: "v3",
    type: "video",
    title: "VIDEO PARTNER",
    price: "৳20,000",
    period: "Month",
    isPopular: false,
    features: [
      "15 Short Videos / Reels",
      "Premium Editing",
      "Advanced Motion Graphics",
      "Animated Captions",
      "Sound Design",
      "Priority Delivery",
      "Hook Formulation"
    ],
    ctaText: "Become Video Partner",
    published: true,
  },

  // Launch Package
  {
    id: "l1",
    type: "website", // Custom/Launch
    title: "COMPLETE BUSINESS LAUNCH PACKAGE",
    price: "৳75,000",
    period: "Project",
    isPopular: true,
    features: [
      "Professional Business Website",
      "Logo & Brand Identity",
      "Facebook Page Setup & Optimization",
      "20 Social Media Designs",
      "8 Promotional Reels",
      "1 Month Social Media Management",
      "Content Strategy",
      "WhatsApp Integration",
      "Basic SEO Setup",
      "30 Days Support"
    ],
    deliveryTime: "30 Business Days",
    ctaText: "Launch Your Business with B2bfiy",
    published: true,
  }
];

// NOTE: Stock placeholder images for the Admin media library UI -- not real
// client deliverables. Replace with real project assets over time.
export const initialMedia: MediaItem[] = [
  { id: "m-1", url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80", name: "Stock Placeholder - Mockup", category: "mockup" },
  { id: "m-2", url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80", name: "Stock Placeholder - Graphic", category: "graphic" },
  { id: "m-3", url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80", name: "Stock Placeholder - Video Thumb", category: "video" },
  { id: "m-4", url: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80", name: "Stock Placeholder - Photo", category: "photo" },
  { id: "m-5", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80", name: "Stock Placeholder - Dashboard Mockup", category: "mockup" },
  { id: "m-6", url: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=800&q=80", name: "Stock Placeholder - Team Photo", category: "photo" },
];
