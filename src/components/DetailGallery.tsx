"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";

export function DetailGallery({ images, alt }: { images: string[]; alt: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const photos = images.length ? images : ["/images/placeholder.svg"];
  const count = photos.length;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setActive((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setActive((i) => (i - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  return (
    <section>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ürün fotoğrafını büyüt"
        className="relative block h-[340px] w-full overflow-hidden rounded-2xl bg-bg sm:h-[470px] lg:h-[520px]"
      >
        <Image
          src={photos[active]}
          alt={`${alt} — fotoğraf ${active + 1}`}
          fill
          priority
          className="object-cover"
          sizes="(min-width: 1024px) 60vw, 100vw"
        />
        <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-lg bg-white/93 px-3 py-2 text-[11px] text-[#111318]">
          <Icon name="image" className="h-[17px] w-[17px]" />
          {active + 1} / {count} fotoğraf
        </span>
      </button>
      {count > 1 ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto sm:gap-3">
          {photos.map((src, i) => (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[1.5] w-[calc(25%-6px)] min-w-[88px] flex-shrink-0 overflow-hidden rounded-lg border-2",
                active === i ? "border-text" : "border-transparent",
              )}
              aria-label={`${i + 1}. ürün fotoğrafını göster`}
              aria-pressed={active === i}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="200px" />
            </button>
          ))}
        </div>
      ) : null}

      <Modal title={`Fotoğraf ${active + 1} / ${count}`} open={open} onClose={() => setOpen(false)}>
        <div className="relative h-[60vh] w-full overflow-hidden rounded-xl bg-bg">
          <Image src={photos[active]} alt={alt} fill className="object-contain" sizes="90vw" />
          {count > 1 ? (
            <>
              <button
                onClick={() => setActive((i) => (i - 1 + count) % count)}
                aria-label="Önceki fotoğraf"
                className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#111318]"
              >
                <Icon name="back" className="h-4 w-4" />
              </button>
              <button
                onClick={() => setActive((i) => (i + 1) % count)}
                aria-label="Sonraki fotoğraf"
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#111318]"
              >
                <Icon name="chevron" className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
        <div className="flex justify-center gap-2">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`${i + 1}. fotoğrafa git`}
              className={cn("h-2 w-2 rounded-full", active === i ? "bg-text" : "bg-border")}
            />
          ))}
        </div>
      </Modal>
    </section>
  );
}
