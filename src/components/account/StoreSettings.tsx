"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError, Notice } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";

export function StoreSettings({ me }: { me: Me }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const isStore = me.accountType === "store";
  const [form, setForm] = useState({
    storeName: me.store.name ?? "",
    address: me.store.address ?? "",
    phone: me.store.phone ?? "",
    website: me.store.website ?? "",
    hours: me.store.hours ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t(isStore ? "Mağazan" : "Mağaza aç")}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {t("İşletmen varsa ilanların mağaza adınla görünür, profilinde adres ve çalışma saatlerin yer alır. Mağaza hesabı ücretsizdir.")}
        </p>
      </div>
      {isStore ? (
        me.store.verified ? (
          <Notice tone="success" icon="check">{t("Mağazan ekibimiz tarafından onaylandı. Onaylı mağazalar daha fazla ilan açabilir.")}</Notice>
        ) : (
          <Notice icon="info">{t("Mağaza doğrulaması için destek ekibimize işletme bilgilerinle yazabilirsin. Mağaza adını değiştirirsen doğrulama kalkar.")}</Notice>
        )
      ) : null}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api.put("/me/store", form);
            toast.show(isStore ? "Mağaza bilgilerin kaydedildi." : "Mağazan açıldı.");
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        className="flex flex-col gap-4 rounded-card border border-border p-5"
      >
        <Field label="Mağaza adı" value={form.storeName} onChange={set("storeName")} maxLength={60} required />
        <Field label="Adres" optional value={form.address} onChange={set("address")} maxLength={160} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="İşletme telefonu" optional type="tel" value={form.phone} onChange={set("phone")} hint="Mağaza profilinde herkese görünür." />
          <Field label="Çalışma saatleri" optional value={form.hours} onChange={set("hours")} maxLength={80} placeholder="Hafta içi 09:00–18:00" />
        </div>
        <Field label="Web sitesi" optional value={form.website} onChange={set("website")} placeholder="www.ornek.com" />
        {error ? <FormError>{error}</FormError> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} icon={<Icon name="store" className="h-4 w-4" />}>
            {t(isStore ? "Kaydet" : "Mağazayı aç")}
          </Button>
          {isStore ? (
            <Button variant="ghost" onClick={() => setClosing(true)}>
              {t("Bireysel hesaba dön")}
            </Button>
          ) : null}
        </div>
      </form>
      <Modal
        title="Bireysel hesaba dön"
        description="Mağaza bilgilerin ve doğrulama rozetin kaldırılır. İlanların yayında kalır."
        open={closing}
        onClose={() => setClosing(false)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setClosing(false)}>
              {t("Vazgeç")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.del("/me/store").catch((err) => toast.show(errorMessage(err), { tone: "error" }));
                setClosing(false);
                router.refresh();
              }}
            >
              {t("Mağazayı kapat")}
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </div>
  );
}
