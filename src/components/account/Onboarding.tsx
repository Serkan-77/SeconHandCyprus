"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import { REGION_NAMES } from "@shared/constants";

export function Onboarding({ me, next }: { me: Me; next: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.displayName);
  const [region, setRegion] = useState(me.region ?? "");
  const [avatar, setAvatar] = useState<{ key: string | null; urls: Me["avatar"] }>({ key: me.avatarKey, urls: me.avatar });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const target = next === "/" ? "/hesabim" : next;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api.patch("/me/profile", { name, region, avatar: avatar.key });
          router.replace(target);
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center gap-4">
        <Avatar name={name} src={avatar.urls} size="xl" />
        <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => file.current?.click()} icon={<Icon name="camera" className="h-4 w-4" />}>
          {t("Fotoğraf ekle")}
        </Button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            try {
              const r = await api.upload(f, "avatar");
              setAvatar({ key: r.key, urls: r.urls });
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>
      <Field label="Görünen ad" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("Bölgen")}
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="min-h-11 rounded-field border border-border-strong bg-surface px-3.5 text-[15px] font-normal">
          <option value="">{t("Seçme")}</option>
          {REGION_NAMES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" size="lg" full loading={busy}>
        {t("Kaydet ve devam et")}
      </Button>
      <Link href={target} className="text-center text-[14px] font-medium text-muted hover:text-text">
        {t("Şimdilik atla")}
      </Link>
    </form>
  );
}
