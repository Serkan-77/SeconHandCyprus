"use client";
import * as I18n from "@/components/i18n/Localized";


import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { updateProfile } from "@/lib/actions/account";
import { uploadImage } from "@/lib/upload";
import { initials } from "@/lib/format";
import { publicImageUrl } from "@/lib/supabase/env";
import { regionNames } from "@/lib/regions";
import { ActionForm } from "@/components/ui/ActionForm";

export function ProfileForm({
  profile,
  mode,
}: {
  profile: { displayName: string; region: string | null; bio: string | null; avatarUrl: string | null };
  mode: "setup" | "edit";
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const [name, setName] = useState(profile.displayName);
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const path = await uploadImage("avatars", file);
      setAvatarPath(path);
      setAvatarPreview(publicImageUrl(path, "avatars"));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ActionForm action={action} className="flex max-w-[560px] flex-col gap-5">
      <input type="hidden" name="avatar" value={avatarPath} />
      {mode === "setup" ? <input type="hidden" name="next" value="/" /> : null}
      <div className="flex items-center gap-4">
        <Avatar initials={initials(name)} src={avatarPreview} large />
        <I18n.div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            full={false}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Yükleniyor…" : avatarPreview ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onAvatar(e.target.files?.[0])}
          />
          {uploadError ? <I18n.small className="text-[11px] text-danger">{uploadError}</I18n.small> : null}
        </I18n.div>
      </div>
      <Field
        label={mode === "setup" ? "Görünen adın" : "Görünen ad"}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={40}
        hint="Adın ve soyadının baş harfi yeterli, örn. Deniz A."
      />
      <I18n.label className="flex flex-col gap-2 text-[13px] font-semibold text-text">
        Bölge
        <I18n.select
          name="region"
          defaultValue={profile.region ?? ""}
          className="min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text focus:outline-none"
        >
          <I18n.option value="">Seçilmedi</I18n.option>
          {regionNames.map((r) => (
            <I18n.option key={r}>{r}</I18n.option>
          ))}
        </I18n.select>
      </I18n.label>
      {mode === "edit" ? (
        <TextareaField
          label="Hakkımda"
          name="bio"
          defaultValue={profile.bio ?? ""}
          maxLength={400}
          placeholder="Satıcılara ve alıcılara kendinden kısaca bahset."
          hint="Bu alan profilinde herkese açık görünür."
        />
      ) : null}
      {state?.error ? <FormError>{state.error}</FormError> : null}
      {state?.ok ? <FormSuccess>Profilin kaydedildi.</FormSuccess> : null}
      <I18n.div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        {mode === "edit" ? (
          <LinkButton href="/hesabim" variant="outline" full={false} className="sm:min-w-[140px]">
            Vazgeç
          </LinkButton>
        ) : null}
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Kaydediliyor…" : mode === "setup" ? "Devam et" : "Kaydet"}
        </Button>
      </I18n.div>
    </ActionForm>
  );
}
