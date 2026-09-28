"use client";

import { getBrowserClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600;

/** Downscales large photos in the browser and re-encodes them as JPEG. */
async function compress(file: File, maxEdge: number): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca fotoğraf yükleyebilirsin.");
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
    );
  } catch {
    // Formats the browser cannot decode are sent as-is when the bucket takes
    // them; anything else (e.g. HEIC on desktop) gets a clear message.
    if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    throw new Error("Bu fotoğraf biçimi desteklenmiyor. JPG, PNG ya da WEBP seç.");
  }
}

export async function uploadImage(bucket: "listing-images" | "avatars", file: File) {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Fotoğraf yüklemek için giriş yapmalısın.");
  const blob = await compress(file, bucket === "avatars" ? 512 : MAX_EDGE);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) {
    throw new Error(
      error.message.includes("size") ? "Fotoğraf çok büyük (en fazla 8 MB)." : "Fotoğraf yüklenemedi. Tekrar dene.",
    );
  }
  return path;
}

export async function removeUploadedImages(bucket: "listing-images" | "avatars", paths: string[]) {
  if (!paths.length) return;
  await getBrowserClient().storage.from(bucket).remove(paths);
}
