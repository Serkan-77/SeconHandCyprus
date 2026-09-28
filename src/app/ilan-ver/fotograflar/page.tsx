"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/WizardLayout";
import { WizardPreviewCard } from "@/components/WizardPreviewCard";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { getWizardDraft, useWizardDraft } from "@/lib/wizardStore";
import { removeUploadedImages, uploadImage } from "@/lib/upload";
import { publicImageUrl } from "@/lib/supabase/env";

const MAX_PHOTOS = 10;

export default function AddPhotosPage() {
  const { draft, setDraft } = useWizardDraft();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFiles(files: FileList | null) {
    if (!files?.length || uploading > 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      setError("Yalnızca fotoğraf yükleyebilirsin (JPG, PNG, WEBP).");
      return;
    }
    if (draft.photos.length + list.length > MAX_PHOTOS) {
      setError(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`);
      return;
    }
    setError("");
    setUploading(list.length);
    for (const file of list) {
      try {
        const path = await uploadImage("listing-images", file);
        // Read the draft again: a photo may have been removed meanwhile.
        setDraft({ photos: [...getWizardDraft().photos, path] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(path: string) {
    setDraft({ photos: draft.photos.filter((p) => p !== path) });
    removeUploadedImages("listing-images", [path]);
  }

  function makeCover(path: string) {
    setDraft({ photos: [path, ...draft.photos.filter((p) => p !== path)] });
  }

  return (
    <WizardLayout active={0} preview={<WizardPreviewCard />}>
      <div>
        <h2 className="text-xl font-semibold">Fotoğraflarını ekle</h2>
        <p className="mt-2 text-[13px] text-muted">İyi ışıklı, net fotoğraflar ilanının daha hızlı satılmasını sağlar.</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onClick={() => {
          if (uploading === 0 && draft.photos.length < MAX_PHOTOS) inputRef.current?.click();
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed bg-surface p-8 text-center transition",
          dragging ? "border-accent bg-accent-soft" : "border-border",
        )}
      >
        <Icon name="camera" className="h-8 w-8 text-brand" />
        <span className="text-sm font-medium">Fotoğraf seçmek için tıkla ya da buraya sürükle</span>
        <span className="text-xs text-muted">En az 1, en fazla {MAX_PHOTOS} fotoğraf · JPG, PNG, WEBP</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          full={false}
          disabled={uploading > 0 || draft.photos.length >= MAX_PHOTOS}
        >
          {uploading > 0 ? `${uploading} fotoğraf yükleniyor…` : "Fotoğraf seç"}
        </Button>
      </div>

      {error ? <FormError>{error}</FormError> : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {draft.photos.map((path, i) => (
          <div key={path} className="group relative aspect-square overflow-hidden rounded-xl bg-bg">
            <Image src={publicImageUrl(path)} alt={`Fotoğraf ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-[#111318]">
                Kapak
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(path)}
                className="absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-[#111318]"
              >
                Kapak yap
              </button>
            )}
            <button
              type="button"
              aria-label={`${i + 1}. fotoğrafı kaldır`}
              onClick={() => remove(path)}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#111318]"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="skeleton aspect-square rounded-xl" />
        ))}
        {draft.photos.length + uploading < 3 &&
          Array.from({ length: 3 - draft.photos.length - uploading }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border text-[10px] text-muted"
            >
              Boş
            </div>
          ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6">
        <Button disabled={draft.photos.length === 0 || uploading > 0} onClick={() => router.push("/ilan-ver/detaylar")}>
          Devam et
        </Button>
        <p className="text-center text-[11px] text-muted">
          {draft.photos.length} / {MAX_PHOTOS} fotoğraf eklendi
          {draft.photos.length === 0 ? " · devam etmek için en az 1 fotoğraf ekle" : ""}
        </p>
      </div>
    </WizardLayout>
  );
}
