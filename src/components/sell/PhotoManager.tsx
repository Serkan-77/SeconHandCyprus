"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { DraftPhoto } from "@/lib/listingDraft";
import { cn } from "@/lib/cn";

const MAX_EDGE = 2560;
const MAX_PHOTOS = 10;

/**
 * Big phone photos are scaled down in the browser before upload (faster on
 * mobile data). The server decodes and re-encodes every file anyway, so this
 * is only about speed, not safety. Formats the browser cannot draw are sent
 * as they are and the server gives a clear answer.
 */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 1.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 6 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9));
  } catch {
    return file;
  }
}

type Pending = { id: string; name: string; preview: string; error?: string };

export function PhotoManager({
  photos,
  onChange,
  max = MAX_PHOTOS,
  error,
}: {
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
  max?: number;
  error?: string;
}) {
  const { t } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const latest = useRef(photos);
  latest.current = photos;

  async function add(files: FileList | File[]) {
    const room = max - latest.current.length - pending.filter((p) => !p.error).length;
    const list = [...files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, Math.max(0, room));
    if (!list.length) return;
    const items = list.map((f) => ({ id: crypto.randomUUID(), name: f.name, preview: URL.createObjectURL(f), file: f }));
    setPending((p) => [...p, ...items.map((i) => ({ id: i.id, name: i.name, preview: i.preview }))]);
    // Two at a time: quick on Wi-Fi, gentle on mobile data.
    const queue = [...items];
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const res = await api.upload(await shrink(item.file), "listing");
          latest.current = [...latest.current, { key: res.key, urls: res.urls }];
          onChange(latest.current);
          setPending((p) => p.filter((x) => x.id !== item!.id));
          URL.revokeObjectURL(item.preview);
        } catch (e) {
          const message = errorMessage(e);
          setPending((p) => p.map((x) => (x.id === item!.id ? { ...x, error: message } : x)));
        }
      }
    };
    await Promise.all([worker(), worker()]);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function remove(index: number) {
    const [gone] = photos.slice(index, index + 1);
    onChange(photos.filter((_, i) => i !== index));
    // Unused uploads are cleaned up by the server; discarding early frees space sooner.
    void api.post("/uploads/discard", { key: gone.key }).catch(() => {});
  }

  const count = photos.length + pending.filter((p) => !p.error).length;

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (dragging !== null) return;
          e.preventDefault();
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          if (dragging !== null) return;
          e.preventDefault();
          setDropHover(false);
          void add(e.dataTransfer.files);
        }}
        className={cn(
          "grid grid-cols-3 gap-2.5 rounded-card border-2 border-dashed p-2.5 transition sm:grid-cols-4 lg:grid-cols-5",
          dropHover ? "border-accent bg-accent-soft" : error ? "border-danger/60" : "border-border-strong",
        )}
      >
        {photos.map((p, i) => (
          <div
            key={p.key}
            draggable
            onDragStart={() => setDragging(i)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null);
            }}
            className={cn("group relative aspect-square overflow-hidden rounded-[10px] bg-brand-soft", dragging === i && "opacity-40")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.urls.sm} alt={t(`Fotoğraf ${i + 1}`)} className="h-full w-full object-cover" draggable={false} />
            {i === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-on-brand">{t("Kapak")}</span>
            ) : null}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t(`Fotoğraf ${i + 1} kaldır`)}
              className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={t("Sola taşı")}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white disabled:invisible"
              >
                <Icon name="back" className="h-4 w-4" />
              </button>
              {i !== 0 ? (
                <button type="button" onClick={() => move(i, 0)} className="h-8 rounded-full bg-black/60 px-2.5 text-[11px] font-semibold text-white">
                  {t("Kapak yap")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === photos.length - 1}
                aria-label={t("Sağa taşı")}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white disabled:invisible"
              >
                <Icon name="chevron" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-[10px] bg-brand-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className={cn("h-full w-full object-cover", p.error ? "opacity-30" : "opacity-60")} />
            {p.error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                <span className="text-[11px] font-medium leading-tight text-danger">{p.error}</span>
                <button type="button" onClick={() => setPending((all) => all.filter((x) => x.id !== p.id))} className="text-[11px] font-semibold underline">
                  {t("Kapat")}
                </button>
              </div>
            ) : (
              <span className="absolute inset-0 grid place-items-center" role="status" aria-label={t("Yükleniyor")}>
                <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white border-r-transparent" />
              </span>
            )}
          </div>
        ))}
        {count < max ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[10px] bg-bg text-center text-[13px] font-medium text-muted transition hover:bg-brand-soft hover:text-text"
          >
            <Icon name="camera" className="h-7 w-7" />
            {photos.length ? t("Ekle") : t("Fotoğraf ekle")}
            <span className="text-[11px] text-subtle tabular">
              {count} / {max}
            </span>
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <p className="mt-2 text-[12px] font-medium text-danger">{error}</p> : null}
      <p className="mt-2 text-[12px] text-muted">
        {t("İlk fotoğraf kapak olur. Sürükleyerek ya da oklarla sırala. En fazla 10 fotoğraf, her biri en fazla 12 MB.")}
      </p>
    </div>
  );
}
