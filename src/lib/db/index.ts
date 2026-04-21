import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as users from "@/db/schema/users";
import * as auth from "@/db/schema/auth";
import * as notebooks from "@/db/schema/notebooks";
import * as sources from "@/db/schema/sources";
import * as conversations from "@/db/schema/conversations";
import * as outputs from "@/db/schema/outputs";
import * as progress from "@/db/schema/progress";
import * as canvas from "@/db/schema/canvas";
import * as subscriptions from "@/db/schema/subscriptions";

/**
 * Postgres connection pool — tuned for Next.js serverless + long-running
 * workers sharing the same schema.
 *
 * Why these values:
 *
 *   max: 10
 *     Route handlers are short-lived; each worker lambda (or node process)
 *     can safely hold up to 10 connections. If you're deploying on Neon
 *     pooled / Supabase pooler / PgBouncer transaction-mode, this is a
 *     per-process ceiling, not a global one — the pooler takes care of
 *     total fan-out.
 *
 *   idle_timeout: 20
 *     Release an idle connection after 20s. Shorter than `max_lifetime`
 *     so bursty workloads drop back to zero connections between spikes.
 *
 *   max_lifetime: 60 * 30  (30 min)
 *     Rotate connections so long-running processes don't cling to a
 *     connection whose server-side state drifted (e.g. after schema
 *     migration or postgres restart).
 *
 *   connect_timeout: 10
 *     Fail fast if the DB is unreachable instead of hanging the request.
 *
 *   prepare: PREPARE (see below)
 *     In direct-connection mode we prepare statements for a ~20% hot-path
 *     win. In transaction-pooled mode (PgBouncer / pgcat), prepared
 *     statements are not safe — each transaction can land on a different
 *     server connection. Toggle via DATABASE_TRANSACTION_POOLED=1.
 *
 *   ssl: 'require' in prod
 *     Neon, Supabase, RDS etc. all accept 'require'. Local Docker
 *     postgres doesn't — keep ssl off in dev.
 *
 *   onnotice: () => {}
 *     Silences the per-query NOTICE spam Postgres emits (e.g. "table
 *     already exists" during dev migrations).
 *
 * IMPORTANT: The default Postgres statement_timeout is 0 (unlimited). A
 * misbehaving query could pin a connection forever. We set a 30s default
 * at session start via `connection.statement_timeout`; long jobs (video /
 * podcast composition) run in the worker process, not via `db` here.
 */

const TRANSACTION_POOLED = process.env.DATABASE_TRANSACTION_POOLED === "1";
const IS_PROD = process.env.NODE_ENV === "production";

// Fall back to a dummy URL in test / CI so importing `db` doesn't crash a
// unit-test file that never actually runs a query. Real runtime flows go
// through src/env.ts which rejects missing DATABASE_URL at startup.
const connectionString =
  process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test";

const client = postgres(connectionString, {
  max: TRANSACTION_POOLED ? 1 : 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,

  // Transaction-pooled deployments can't use prepared statements because
  // successive txns may land on different backend connections. Direct
  // connections get prepared statements for a modest speedup on hot paths.
  prepare: !TRANSACTION_POOLED,

  ssl: IS_PROD ? "require" : false,

  // Session-level defaults applied on every new backend connection.
  // statement_timeout: cap per-query work at 30s — prevents runaway queries
  //                    from pinning a connection forever. Value is in ms
  //                    per postgres.js parameter conventions.
  // idle_in_transaction_session_timeout: kill open txns that stall.
  connection: {
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 60_000,
    application_name: "fluxmind",
  },

  // Quiet per-query NOTICE logging (e.g. "table already exists").
  onnotice: () => {},
});

export const db = drizzle(client, {
  schema: {
    ...users,
    ...auth,
    ...notebooks,
    ...sources,
    ...conversations,
    ...outputs,
    ...progress,
    ...canvas,
    ...subscriptions,
  },
  // Turn on query logging in dev by setting DRIZZLE_LOG=1 — useful for
  // spotting N+1 and unexpected full scans while developing.
  logger: process.env.DRIZZLE_LOG === "1",
});

export type Database = typeof db;
