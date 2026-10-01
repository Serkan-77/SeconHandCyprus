"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, SelectField, TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

const TOPICS = ["İlan sorunu", "Hesap ve giriş", "Şikayet ve güvenlik", "Kısıtlamaya itiraz", "Mağaza doğrulama", "Diğer"];

export function SupportForm({ defaultEmail }: { defaultEmail: string }) {
  const { t } = useLocale();
  const [form, setForm] = useState({ topic: TOPICS[0], email: defaultEmail, message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <h2 className="text-xl font-bold">{t("Destek talebin alındı")}</h2>
        <p className="max-w-sm text-[14px] text-muted">{t("Ekibimiz genellikle 24 saat içinde e-posta ile dönüş yapar.")}</p>
        <LinkButton href="/">{t("Ana sayfaya dön")}</LinkButton>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api.post("/support", form);
          setSent(true);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="relative flex flex-col gap-5 rounded-card border border-border p-5 sm:p-6"
    >
      <SelectField label="Konu" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} options={TOPICS} />
      <Field label="E-posta adresin" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required hint="Yanıtı bu adrese göndeririz." />
      <TextareaField
        label="Mesajın"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        placeholder="Yaşadığın sorunu kısaca anlat. İlgili ilan numarası (KB…) varsa ekle."
        minLength={10}
        maxLength={5000}
        rows={6}
      />
      {/* Honeypot: hidden from people, filled in by form bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" loading={busy}>
        {t("Talebi gönder")}
      </Button>
    </form>
  );
}
