"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { MediaImage } from "@/components/ui/MediaImage";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ImageUrls } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Photo = { id: string; urls: ImageUrls | null };

/**
 * Listing photos. Desktop: a mosaic (one large photo and up to four more)
 * opening a full-screen viewer. Phones: an edge-to-edge swipeable photo with
 * a counter. The viewer has keyboard, swipe and zoom; nothing needs hover.
 */
export function Gallery({ photos, title, badge }: { photos: Photo[]; title: string; badge?: React.ReactNode }) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const touch = useRef<number | null>(null);
  const count = photos.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  if (!count) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-soft">
        <MediaImage urls={null} alt="" />
      </div>
    );
  }

  const current = photos[index];
  const open = (i: number) => {
    setIndex(i);
    setViewer(true);
  };
  const tiles = photos.slice(0, 5);

  return (
    <div>
      {/* Desktop mosaic */}
      <div
        className={cn(
          "relative hidden h-[min(560px,62vh)] min-h-[400px] gap-2 overflow-hidden rounded-[20px] md:grid",
          tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-4 grid-rows-2",
        )}
      >
        {tiles.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => open(i)}
            aria-label={t(`Fotoğraf ${i + 1} / ${count}`)}
            className={cn(
              "group relative overflow-hidden bg-brand-soft",
              tiles.length >= 3 && i === 0 && "col-span-2 row-span-2",
              tiles.length === 3 && i > 0 && "col-span-2",
              tiles.length === 4 && i === 3 && "col-span-2",
            )}
          >
            <MediaImage urls={p.urls} alt={i === 0 ? title : ""} priority={i === 0} sizes={i === 0 ? "(min-width: 1280px) 50vw, 60vw" : "25vw"} className="absolute inset-0 transition duration-500 group-hover:scale-[1.03]" />
          </button>
        ))}
        {badge ? <div className="pointer-events-none absolute left-4 top-4">{badge}</div> : null}
        <button
          type="button"
          onClick={() => open(0)}
          className="absolute bottom-4 right-4 flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-[#0a0a0a] shadow-md hover:bg-white/90"
        >
          <Icon name="grid" className="h-4 w-4" />
          {t(`Tüm fotoğraflar (${count})`)}
        </button>
      </div>

      {/* Phones: edge-to-edge swipe */}
      <div
        className="group relative -mx-4 aspect-square overflow-hidden bg-[#0a0a0a] sm:-mx-6 md:hidden"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <button type="button" onClick={() => setViewer(true)} className="block h-full w-full cursor-zoom-in" aria-label={t("Fotoğrafı büyüt")}>
          <MediaImage urls={current.urls} alt={t(`${title} — fotoğraf ${index + 1} / ${count}`)} priority={index === 0} sizes="(min-width: 1024px) 800px, 100vw" className="object-contain" />
        </button>
        {badge ? <div className="pointer-events-none absolute left-3 top-3">{badge}</div> : null}
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("Önceki fotoğraf")}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0f1216] shadow-md transition hover:bg-white sm:grid"
            >
              <Icon name="back" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("Sonraki fotoğraf")}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0f1216] shadow-md transition hover:bg-white sm:grid"
            >
              <Icon name="chevron" className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-pill bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white tabular" aria-live="polite">
              {index + 1} / {count}
            </span>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setViewer(true)}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-pill bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white"
        >
          <Icon name="zoom" className="h-3.5 w-3.5" />
          {t("Büyüt")}
        </button>
      </div>

      {count > 1 ? (
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto md:hidden" role="tablist" aria-label={t("Fotoğraflar")}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t(`Fotoğraf ${i + 1} / ${count}`)}
              onClick={() => setIndex(i)}
              className={cn(
                "relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-[8px] ring-2 ring-offset-1 ring-offset-surface transition sm:h-[72px] sm:w-24",
                i === index ? "ring-accent" : "ring-transparent opacity-75 hover:opacity-100",
              )}
            >
              <MediaImage urls={p.urls} alt="" max="sm" sizes="96px" />
            </button>
          ))}
        </div>
      ) : null}

      {viewer ? <Lightbox photos={photos} index={index} setIndex={setIndex} onClose={() => setViewer(false)} title={title} /> : null}
    </div>
  );
}

function Lightbox({
  photos,
  index,
  setIndex,
  onClose,
  title,
}: {
  photos: Photo[];
  index: number;
  setIndex: (fn: (i: number) => number) => void;
  onClose: () => void;
  title: string;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const touch = useRef<number | null>(null);
  const count = photos.length;
  useFocusTrap(ref, true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, setIndex]);

  const current = photos[index];
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={t("Fotoğraf görüntüleyici")} tabIndex={-1} className="fixed inset-0 z-[90] flex flex-col bg-black text-white outline-none">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[13px] tabular opacity-80">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            aria-pressed={zoom}
            aria-label={t(zoom ? "Uzaklaştır" : "Yakınlaştır")}
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"
          >
            <Icon name="zoom" className="h-5 w-5" />
          </button>
          <button type="button" onClick={onClose} aria-label={t("Kapat")} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null || zoom) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) setIndex((i) => (i + (dx < 0 ? 1 : -1) + count) % count);
          touch.current = null;
        }}
        onMouseMove={(e) => {
          if (!zoom) return;
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
      >
        {current.urls ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.urls.lg}
            alt={t(`${title} — fotoğraf ${index + 1} / ${count}`)}
            onClick={() => setZoom((z) => !z)}
            className={cn("h-full w-full select-none object-contain transition-transform duration-200", zoom ? "scale-[2.2] cursor-zoom-out" : "cursor-zoom-in")}
            style={{ transformOrigin: origin }}
            draggable={false}
          />
        ) : null}
        {count > 1 ? (
          <>
            <button type="button" onClick={() => setIndex((i) => (i - 1 + count) % count)} aria-label={t("Önceki fotoğraf")} className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <Icon name="back" className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => setIndex((i) => (i + 1) % count)} aria-label={t("Sonraki fotoğraf")} className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <Icon name="chevron" className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setIndex(() => i)} aria-label={t(`Fotoğraf ${i + 1} / ${count}`)} className={cn("h-14 w-16 flex-shrink-0 overflow-hidden rounded-md ring-2", i === index ? "ring-white" : "ring-transparent opacity-60")}>
              <MediaImage urls={p.urls} alt="" max="sm" sizes="64px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
