import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { verifyAuditChain } from "../src/server/audit";
const c = postgres(process.env.DATABASE_URL!, { max: 1 });
console.log("primeiro registro inconsistente:", await verifyAuditChain(drizzle(c) as never));
await c.end();
