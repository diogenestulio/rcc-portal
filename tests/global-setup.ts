import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:dev_only_pw@127.0.0.1:55432/rcc_test";
  const u = new URL(url);
  const dbName = u.pathname.slice(1);
  if (!/_test$/.test(dbName)) throw new Error("Por segurança, o banco de teste precisa terminar em _test");
  u.pathname = "/postgres";
  const admin = postgres(u.toString(), { max: 1 });
  await admin.unsafe(`drop database if exists ${dbName} with (force)`);
  await admin.unsafe(`create database ${dbName}`);
  await admin.end();
  const c = postgres(url, { max: 1 });
  await migrate(drizzle(c), { migrationsFolder: "./drizzle" });
  await c.end();
}
