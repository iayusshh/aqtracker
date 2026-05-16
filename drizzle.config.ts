import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local for local development so drizzle-kit push/generate commands
// have access to DATABASE_URL without requiring a shell export.
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not defined. Create .env.local with DATABASE_URL set to " +
      "your Supabase Postgres connection string before running drizzle-kit commands."
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Skip Supabase-managed schemas so drizzle-kit does not attempt to diff
  // or migrate auth/storage/realtime tables.
  tablesFilter: ["!auth.*", "!storage.*", "!realtime.*"],
  verbose: true,
  strict: true,
} satisfies Config;

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------
// Generate a migration file from schema changes:
//   npx drizzle-kit generate
//
// Push schema directly to DB (development only — bypasses migration files):
//   npx drizzle-kit push
//
// Open Drizzle Studio (local DB browser):
//   npx drizzle-kit studio
//
// For production: run the hand-authored supabase/migrations/001_init.sql
// in the Supabase Dashboard → SQL Editor, which also sets up RLS policies,
// triggers, and helper functions that drizzle-kit generate cannot produce.
