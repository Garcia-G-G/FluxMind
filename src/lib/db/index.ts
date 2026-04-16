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

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);

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
});

export type Database = typeof db;
