// Image pipeline. Uploaded bytes are decoded by libvips (sharp), never
// trusted by name or declared MIME type: anything that does not decode as a
// JPEG, PNG, WebP or AVIF image is refused. Output is always freshly encoded
// WebP in fixed sizes, auto-rotated, with every metadata block (EXIF, GPS,
// XMP, ICC comments) dropped. Originals are not kept: this keeps disk use
// predictable on a 50 GB server and removes anything hidden in the file.
import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { LIMITS } from "../../../shared/constants.ts";

sharp.concurrency(1);
sharp.cache(false);

export type UploadKind = "listing" | "avatar";

const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_EDGE = { listing: 240, avatar: 96 } as const;

const VARIANTS: Record<UploadKind, { name: string; size: number; square?: boolean }[]> = {
  listing: [
    { name: "sm.webp", size: 400 },
    { name: "md.webp", size: 800 },
    { name: "lg.webp", size: 1600 },
  ],
  avatar: [
    { name: "sm.webp", size: 128, square: true },
    { name: "md.webp", size: 512, square: true },
  ],
};

export class ImageRejected extends Error {}

export function newKey(kind: UploadKind, now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${kind === "listing" ? "l" : "a"}/${now.getUTCFullYear()}/${month}/${randomUUID()}`;
}

/**
 * `legacy` is for photos imported from the old system: they were accepted
 * under looser rules, so size and shape limits are relaxed. Decoding is just
 * as strict and the output is re-encoded the same way.
 */
export async function processImage(input: Buffer, kind: UploadKind, opts: { legacy?: boolean } = {}) {
  if (input.length === 0) throw new ImageRejected("Dosya boş.");
  const maxBytes = opts.legacy ? 30 * 1024 * 1024 : LIMITS.uploadMaxBytes;
  if (input.length > maxBytes) throw new ImageRejected("Fotoğraf çok büyük (en fazla 12 MB).");
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new ImageRejected("Bu dosya bir fotoğraf olarak açılamadı. JPG, PNG ya da WEBP seç.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new ImageRejected("Bu fotoğraf biçimi desteklenmiyor. JPG, PNG ya da WEBP seç.");
  }
  if (meta.format === "heif" && meta.compression !== "av1") {
    throw new ImageRejected("HEIC fotoğraflar desteklenmiyor. Telefonunda JPG olarak paylaş ya da ekran görüntüsü al.");
  }
  if (!meta.width || !meta.height) throw new ImageRejected("Fotoğraf okunamadı.");
  if ((meta.pages ?? 1) > 1) throw new ImageRejected("Hareketli görseller desteklenmiyor.");
  // EXIF orientations 5–8 swap width and height.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  if (Math.min(width, height) < (opts.legacy ? 16 : MIN_EDGE[kind])) {
    throw new ImageRejected("Fotoğraf çok küçük. Daha büyük bir fotoğraf seç.");
  }
  if (!opts.legacy && Math.max(width, height) / Math.min(width, height) > 6) {
    throw new ImageRejected("Fotoğrafın en-boy oranı desteklenmiyor.");
  }

  const variants: { name: string; data: Buffer }[] = [];
  let outWidth = 0;
  let outHeight = 0;
  for (const v of VARIANTS[kind]) {
    const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize(
        v.square
          ? { width: v.size, height: v.size, fit: "cover", position: "attention" }
          : { width: v.size, height: v.size, fit: "inside", withoutEnlargement: true },
      )
      .webp({ quality: v.size <= 400 ? 76 : 80, effort: 4 });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    variants.push({ name: v.name, data });
    outWidth = info.width;
    outHeight = info.height;
  }
  return { width: outWidth, height: outHeight, bytes: variants.reduce((n, v) => n + v.data.length, 0), variants };
}

export type ImageUrls = { sm: string; md: string; lg: string };

/** Public URLs of an image. External avatars (Google) are passed through. */
export function imageUrls(mediaUrl: string, key: string | null | undefined): ImageUrls | null {
  if (!key) return null;
  if (/^https:\/\//.test(key)) return { sm: key, md: key, lg: key };
  const base = `${mediaUrl.replace(/\/$/, "")}/${key}`;
  const isAvatar = key.startsWith("a/");
  return { sm: `${base}/sm.webp`, md: `${base}/md.webp`, lg: `${base}/${isAvatar ? "md" : "lg"}.webp` };
}
