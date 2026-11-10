import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// Conexões limitadas: a VPS é pequena. Ajustar DB_POOL_MAX conforme docs/07-operacao.md.
export const pg = globalForDb.pg ?? postgres(env.DATABASE_URL, { max: env.DB_POOL_MAX, prepare: true });
if (process.env.NODE_ENV !== "production") globalForDb.pg = pg;

export const db = drizzle(pg, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
