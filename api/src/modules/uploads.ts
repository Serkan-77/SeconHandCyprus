// /api/v1/uploads — photo uploads (listing photos, avatars) and /media serving.
//
// An upload is decoded and re-encoded before anything is stored (see
// storage/images.ts), stored under a random server-made key, and recorded in
// public.uploads with its owner. Listings and profiles can only reference
// uploads that belong to the caller (database triggers + API checks).
// Uploads never attached to anything are deleted after 24 hours.
import { createReadStream } from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SYSTEM, withActor } from "../db/pool.ts";
import { ApiError, badRequest, forbidden } from "../lib/errors.ts";
import { consumeLimits } from "../auth/attempts.ts";
import { isSanctioned, requireViewer } from "../http/context.ts";
import { ImageRejected, imageUrls, newKey, processImage, type UploadKind } from "../storage/images.ts";
import { KEY_PATTERN } from "../storage/store.ts";
import { parse, run } from "./common.ts";

/** Deletes files and upload rows that no listing or profile references any more. */
export async function purgeUploads(app: FastifyInstance, keys: string[]) {
  const { db, store } = app.deps;
  const unique = [...new Set(keys)].filter((k) => KEY_PATTERN.test(k));
  if (!unique.length) return;
  const orphaned = await withActor(db, SYSTEM, (sql) =>
    sql<{ key: string }[]>`
      delete from uploads u
      where u.key = any(${unique}::text[])
        and not exists (select 1 from listing_images i where i.path = u.key)
        and not exists (select 1 from profiles p where p.avatar_url = u.key)
      returning u.key`,
  );
  for (const { key } of orphaned) {
    await store.remove(key).catch((err) => app.log.warn({ err: { message: (err as Error).message }, key }, "file removal failed"));
  }
}

/** Removes uploads that were never attached (abandoned drafts), older than a day. */
export async function cleanOrphanUploads(app: FastifyInstance) {
  const rows = await withActor(app.deps.db, SYSTEM, (sql) =>
    sql<{ key: string }[]>`
      select u.key from uploads u
      where u.attached_at is null and u.created_at < now() - interval '24 hours'
        and not exists (select 1 from listing_images i where i.path = u.key)
        and not exists (select 1 from profiles p where p.avatar_url = u.key)
      limit 500`,
  );
  await purgeUploads(app, rows.map((r) => r.key));
  return rows.length;
}

export async function uploadRoutes(app: FastifyInstance) {
  const { db, store, config } = app.deps;

  app.post("/uploads", async (req) => {
    const v = requireViewer(req);
    if (isSanctioned(v)) throw forbidden("Hesabın kısıtlıyken fotoğraf yükleyemezsin.");
    if (!req.isMultipart()) throw badRequest("Fotoğraf dosyası bekleniyor.");
    await consumeLimits(db, [
      { action: "upload", subject: v.id, max: 80, windowMinutes: 60, message: "Kısa sürede çok fazla fotoğraf yükledin. Biraz sonra tekrar dene." },
      { action: "upload_day", subject: v.id, max: 300, windowMinutes: 24 * 60, message: "Bugünlük fotoğraf yükleme sınırına ulaştın." },
    ]);
    const kindField = (req.query as { kind?: string }).kind;
    const kind: UploadKind = kindField === "avatar" ? "avatar" : "listing";
    const file = await req.file();
    if (!file) throw badRequest("Fotoğraf dosyası bekleniyor.");
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      throw new ApiError(413, "too_large", "Fotoğraf çok büyük (en fazla 12 MB).");
    }
    let processed;
    try {
      processed = await processImage(buffer, kind);
    } catch (e) {
      if (e instanceof ImageRejected) throw new ApiError(422, "invalid_image", e.message);
      throw e;
    }
    const key = newKey(kind);
    await store.putVariants(key, processed.variants);
    try {
      await run(app, req, (sql) => sql`
        insert into uploads (owner_id, kind, key, width, height, bytes)
        values (${v.id}, ${kind}, ${key}, ${processed.width}, ${processed.height}, ${processed.bytes})`);
    } catch (e) {
      await store.remove(key);
      throw e;
    }
    return { key, kind, width: processed.width, height: processed.height, urls: imageUrls(config.MEDIA_URL, key) };
  });

  // Removes one of the caller's own uploads that is not in use (e.g. a photo
  // taken out of a draft before publishing).
  app.post("/uploads/discard", async (req) => {
    const v = requireViewer(req);
    const { key } = parse(z.object({ key: z.string().regex(KEY_PATTERN) }), req.body);
    const [row] = await run(app, req, (sql) => sql<{ key: string }[]>`
      select key from uploads where key = ${key} and owner_id = ${v.id} and attached_at is null`);
    if (row) await purgeUploads(app, [key]);
    return { ok: true };
  });
}

// Media for development and as a fallback; in production Caddy serves
// /media straight from the upload directory with the same headers.
export async function mediaRoutes(app: FastifyInstance) {
  const { store, config } = app.deps;
  if (!config.SERVE_MEDIA) return;
  app.get("/media/*", async (req, reply) => {
    const rest = (req.params as { "*": string })["*"] ?? "";
    const cut = rest.lastIndexOf("/");
    const file = await store.locate(rest.slice(0, cut), rest.slice(cut + 1));
    if (!file) return reply.status(404).send({ error: { code: "not_found", message: "Bulunamadı." } });
    reply.header("content-type", "image/webp");
    reply.header("cache-control", "public, max-age=31536000, immutable");
    reply.header("x-content-type-options", "nosniff");
    reply.header("content-security-policy", "default-src 'none'; sandbox");
    return reply.send(createReadStream(file));
  });
}
