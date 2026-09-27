"use client";

import { useActionState, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field } from "@/components/ui/Field";
import { FormError, FormSuccess } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { deleteAccount, updateContact, updateSettings } from "@/lib/actions/account";
import { updatePassword } from "@/lib/actions/auth";

const defaults: Record<string, boolean | string> = {
  notify_messages: true,
  notify_price: true,
  notify_listing: true,
  notify_rating: true,
  notify_announcements: true,
};

function ToggleRow({
  title,
  sub,
  settingKey,
  settings,
  onSave,
}: {
  title: string;
  sub?: string;
  settingKey: string;
  settings: Record<string, unknown>;
  onSave: (key: string, value: unknown) => void;
}) {
  const value = (settings[settingKey] ?? defaults[settingKey]) as boolean;
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <span>
        <b className="text-[13px]">{title}</b>
        {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
      </span>
      <Switch label={title} defaultChecked={value} onChange={(checked) => onSave(settingKey, checked)} />
    </div>
  );
}

export function SettingsView({
  settings,
  contact,
}: {
  settings: Record<string, unknown>;
  contact: { phone: string; whatsapp: boolean };
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [saved, setSaved] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, startDelete] = useTransition();
  const [, startSave] = useTransition();
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePassword, undefined);
  const [contactState, contactAction, contactPending] = useActionState(updateContact, undefined);

  function save(key: string, value: unknown) {
    startSave(async () => {
      const result = await updateSettings({ [key]: value });
      setSaved(result.error ? result.error : "Tercihin kaydedildi.");
      setTimeout(() => setSaved(""), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Ayarlar</h1>
        {saved ? <FormSuccess>{saved}</FormSuccess> : null}
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Bildirim tercihleri</h2>
        <div className="divide-y divide-border rounded-xl border border-border px-5">
          <ToggleRow title="Yeni mesaj bildirimleri" settingKey="notify_messages" settings={settings} onSave={save} />
          <ToggleRow title="Favori fiyat düşüşleri" settingKey="notify_price" settings={settings} onSave={save} />
          <ToggleRow title="İlan durumu güncellemeleri" settingKey="notify_listing" settings={settings} onSave={save} />
          <ToggleRow title="Yeni değerlendirmeler" settingKey="notify_rating" settings={settings} onSave={save} />
          <ToggleRow title="Platform duyuruları" settingKey="notify_announcements" settings={settings} onSave={save} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">İletişim</h2>
        <form action={contactAction} className="flex flex-col gap-4 rounded-xl border border-border p-5">
          <Field
            label="Telefon numarası"
            type="tel"
            name="phone"
            defaultValue={contact.phone}
            placeholder="+90 5xx xxx xx xx"
            hint="Numaran profilinde ve ilanlarında hiçbir zaman açıkça yazmaz. Boş da bırakabilirsin."
          />
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-[13px] font-semibold">Alıcılar bana nasıl ulaşsın?</legend>
            <label className="flex items-start gap-2.5 rounded-xl border border-border p-3.5 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-bg">
              <input type="radio" name="whatsapp" value="off" defaultChecked={!contact.whatsapp} className="mt-0.5 accent-brand" />
              <span>
                <b className="block">Yalnızca uygulama içi mesaj</b>
                <span className="text-xs text-muted">Numaran gizli kalır; ilanlarında WhatsApp butonu görünmez.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 rounded-xl border border-border p-3.5 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-bg">
              <input type="radio" name="whatsapp" value="on" defaultChecked={contact.whatsapp} className="mt-0.5 accent-brand" />
              <span>
                <b className="block">Uygulama içi mesaj + WhatsApp</b>
                <span className="text-xs text-muted">
                  Giriş yapmış alıcılar ilanlarındaki WhatsApp butonuyla numarana ulaşabilir. Telefon numarası gerekir.
                </span>
              </span>
            </label>
          </fieldset>
          {contactState?.error ? <FormError>{contactState.error}</FormError> : null}
          {contactState?.ok ? <FormSuccess>İletişim bilgilerin kaydedildi.</FormSuccess> : null}
          <Button type="submit" full={false} disabled={contactPending} className="sm:min-w-[180px]">
            Kaydet
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Görünüm</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-5 py-4">
          <div>
            <b className="text-[13px]">Tema</b>
            <p className="mt-1 text-xs text-muted">Açık ya da koyu görünüm arasında seç. Tercihin bu cihazda saklanır.</p>
          </div>
          <ThemeToggle className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border px-4 text-xs font-medium" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Dil</h2>
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[13px] font-semibold">
            Dil
            <select
              disabled
              className="min-h-12 rounded-field border border-border bg-surface px-4 text-base font-normal text-text opacity-70"
            >
              <option>Türkçe</option>
            </select>
            <small className="text-[11px] font-normal text-muted">İngilizce arayüz yakında.</small>
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Güvenlik</h2>
        <form action={passwordAction} className="flex flex-col gap-4 rounded-xl border border-border p-5">
          <Field label="Yeni şifre" type="password" name="password" autoComplete="new-password" minLength={8} required />
          <Field label="Yeni şifre (tekrar)" type="password" name="password2" autoComplete="new-password" required />
          {passwordState?.error ? <FormError>{passwordState.error}</FormError> : null}
          {passwordState?.ok ? <FormSuccess>Şifren güncellendi.</FormSuccess> : null}
          <Button type="submit" full={false} disabled={passwordPending} className="sm:min-w-[180px]">
            Şifreyi güncelle
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-danger">Tehlikeli bölge</h2>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5">
          <div>
            <b className="text-[13px]">Hesabımı sil</b>
            <p className="mt-1 text-xs text-muted">Bu işlem geri alınamaz; profilin, ilanların ve fotoğrafların kalıcı olarak silinir. Gönderdiğin mesajlar karşı tarafın konuşmasında “Silinmiş kullanıcı” adıyla kalır.</p>
          </div>
          <Button variant="danger" full={false} onClick={() => setDeleteOpen(true)} icon={<Icon name="trash" className="h-4 w-4" />}>
            Hesabımı sil
          </Button>
        </div>
      </section>

      <Modal title="Hesabı silme onayı" open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmText !== "SİL" || !confirmChecked) return;
            startDelete(async () => {
              const result = await deleteAccount();
              if (result?.error) setDeleteError(result.error);
            });
          }}
          className="flex flex-col gap-5"
        >
          <p className="text-sm text-muted">
            Bu işlem geri alınamaz. Onaylamak için aşağıya <b className="text-text">SİL</b> yaz ve kutucuğu işaretle.
          </p>
          <Field label="Onay metni" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <Checkbox
            label="Profil bilgilerimin, ilanlarımın ve fotoğraflarımın silineceğini biliyorum."
            checked={confirmChecked}
            onChange={(e) => setConfirmChecked(e.target.checked)}
          />
          {deleteError ? <FormError>{deleteError}</FormError> : null}
          <Button type="submit" variant="danger" disabled={confirmText !== "SİL" || !confirmChecked || deleting}>
            {deleting ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
