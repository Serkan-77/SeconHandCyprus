"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, SelectField, TextareaField } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

const AUDIENCES = ["Tüm kullanıcılar", "Aktif satıcılar", "Yeni kullanıcılar"];

export function AnnouncementComposer() {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ audience: AUDIENCES[0], title: "", body: "" });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await api.post<{ count: number }>("/admin/announcements", form);
      toast.show(t(`Duyuru ${r.count} kişiye gönderildi.`));
      setForm({ audience: AUDIENCES[0], title: "", body: "" });
      setConfirm(false);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setConfirm(true);
      }}
      className="flex flex-col gap-4 rounded-card border border-border p-5"
    >
      <SelectField label="Kime" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} options={AUDIENCES} hint="Duyuru bildirimlerini kapatanlara gönderilmez." />
      <Field label="Başlık" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required />
      <TextareaField label="Metin" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} rows={5} required />
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="submit" disabled={form.title.trim().length < 3 || form.body.trim().length < 3}>
          {t("Gönder")}
        </Button>
      </div>
      <Modal
        title="Duyuruyu gönder"
        description={t(`“${form.title}” duyurusu şu gruba bildirim olarak gidecek: ${t(form.audience)}. Geri alınamaz.`)}
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t("Vazgeç")}
            </Button>
            <Button loading={busy} onClick={send}>
              {t("Gönder")}
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </form>
  );
}
