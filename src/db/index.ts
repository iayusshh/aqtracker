import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
// DATABASE_URL must be set to the Supabase Postgres connection string:
//
//   Transaction mode (port 6543) — recommended for Next.js App Router
//   route handlers (serverless, short-lived invocations):
//     postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
//
//   Session mode (port 5432) — use only in long-lived Node.js processes
//   (e.g. a background worker, drizzle-kit CLI commands).
//
// Set DATABASE_URL in .env.local for local development.
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not defined. Set it in .env.local pointing to your " +
      "Supabase Postgres connection string (transaction-mode pooler recommended)."
  );
}

/**
 * postgres.js client configured for serverless environments.
 *
 * max: 1  — a single connection per cold-start keeps us within Supabase's
 *            pooler limits when many route handler invocations run in parallel.
 * idle_timeout / connect_timeout — let the pooler reclaim stale connections
 *            quickly rather than holding them open unnecessarily.
 */
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  // Disable prefetch so that prepared-statement cache is not an issue with
  // PgBouncer-style transaction-mode pooling used by Supabase.
  prepare: false,
});

/**
 * Drizzle ORM instance. Import `db` in route handlers and server components.
 *
 * @example
 * import { db } from "@/db";
 * import { goals, eq } from "@/db";
 *
 * const myGoals = await db
 *   .select()
 *   .from(goals)
 *   .where(eq(goals.employeeId, userId));
 */
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export type DB = typeof db;

// Re-export the entire schema so callers can do:
//   import { db, goals, users, eq } from "@/db"
export * from "./schema";
