import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let cachedClient: postgres.Sql | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false
  });

  cachedClient = client;
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

export async function closeDb() {
  await cachedClient?.end();
  cachedClient = null;
  cachedDb = null;
}
