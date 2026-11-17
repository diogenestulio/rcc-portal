import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

/** Imagens públicas da biblioteca para escolher como capa (as mais recentes primeiro). */
export async function imagensPublicas() {
  return db.select({ id: media.id, alt: media.altText }).from(media)
    .where(and(eq(media.isPrivate, false), like(media.mimeType, "image/%"))).orderBy(desc(media.createdAt)).limit(200);
}
