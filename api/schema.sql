-- B2BFIY - DATABASE SCHEMA FOR NEON POSTGRES
-- Paste this into the Neon SQL Editor (Neon Console -> your project -> SQL Editor)
-- and click "Run" to create all tables.
--
-- SECURITY MODEL:
--   Neon is plain Postgres with no built-in RLS-backed public API, so all
--   access control now lives in the API routes under /api (see api/adminAuth.ts),
--   not in SQL policies. Only the server (holding DATABASE_URL) ever talks to
--   this database directly.
--
--   Admin login is a real email + bcrypt-hashed password stored in
--   admin_users, issued as an HttpOnly JWT cookie. The very first successful
--   login bootstraps that row from the ADMIN_EMAIL / ADMIN_PASSWORD server
--   env vars, so set those once in Vercel before your first sign-in.

-- 1. Site content
CREATE TABLE IF NOT EXISTS site_content (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Portfolios
CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Service packages
CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Media library items
CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Leads (form submissions)
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    full_name TEXT NOT NULL,
    business_name TEXT,
    email TEXT,
    whatsapp_number TEXT,
    website_url TEXT,
    service_needed TEXT,
    message TEXT,
    submitted_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Analytics events (server-side page views / leads for the admin dashboard)
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    url TEXT,
    client_id TEXT,
    client_ip TEXT,
    user_agent TEXT,
    params JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analytics_events_ts_idx ON analytics_events (ts);

-- 7. Admin accounts (replaces Supabase Auth)
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
