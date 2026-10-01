"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";
import { FormError, Notice } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { AppearanceControls } from "@/components/AppearanceControls";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import { formatLocalized } from "@/lib/i18n/format";
import { REGION_NAMES } from "@shared/constants";
import { passwordSchema } from "@shared/schemas";

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-32 rounded-card border border-border p-5 sm:p-6">
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {t(title)}
      </h2>
      {description ? <p className="mt-1 text-[14px] text-muted">{t(description)}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileSection({ me }: { me: Me }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: me.displayName, region: me.region ?? "", bio: me.bio ?? "" });
  const [avatar, setAvatar] = useState<{ key: string | null; urls: Me["avatar"] }>({ key: me.avatarKey, urls: me.avatar });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.patch("/me/profile", { name: form.name, region: form.region, bio: form.bio, avatar: avatar.key });
      toast.show("Profilin kaydedildi.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center gap-4">
        <Avatar name={form.name} src={avatar.urls} size="xl" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" loading={uploading} onClick={() => file.current?.click()} icon={<Icon name="camera" className="h-4 w-4" />}>
            {t(avatar.key ? "Fotoğrafı değiştir" : "Fotoğraf ekle")}
          </Button>
          {avatar.key ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setAvatar({ key: null, urls: null })}>
              {t("Kaldır")}
            </Button>
          ) : null}
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
                toast.show(errorMessage(err), { tone: "error" });
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
      </div>
      <Field label="Görünen ad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} autoComplete="name" hint="İlanlarında ve mesajlarda bu ad görünür." />
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("Bölge")}
        <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="min-h-11 rounded-field border border-border-strong bg-surface px-3.5 text-[15px] font-normal">
          <option value="">{t("Seçme")}</option>
          {REGION_NAMES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <TextareaField label="Hakkımda" optional value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} rows={3} placeholder="Kısaca kendini tanıt. Örn. Girne'de yaşıyorum, eşyalarıma iyi bakarım." />
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="submit" loading={busy}>
          {t("Kaydet")}
        </Button>
      </div>
    </form>
  );
}

function ContactSection({ me }: { me: Me }) {
  const { t } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [phone, setPhone] = useState(me.contact.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(me.contact.whatsapp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api.put("/me/contact", { phone, whatsapp });
          toast.show("İletişim bilgilerin kaydedildi.");
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Telefon" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 533 123 45 67" hint="Numaran herkese açık değildir." />
      <div className="flex items-start justify-between gap-4 rounded-field border border-border p-3.5">
        <div>
          <p className="text-[14px] font-medium">{t("WhatsApp ile ulaşılabilirim")}</p>
          <p className="text-[13px] text-muted">{t("Açarsan giriş yapmış alıcılar ilanında WhatsApp butonunu görür ve numarana ulaşabilir.")}</p>
        </div>
        <Switch label="WhatsApp ile ulaşılabilirim" checked={whatsapp} onChange={setWhatsapp} />
      </div>
      {me.phoneVerified ? (
        <p className="flex items-center gap-1.5 text-[13px] text-success">
          <Icon name="check" className="h-4 w-4" />
          {t("Telefon numaran ekibimiz tarafından incelendi. Numarayı değiştirirsen inceleme sıfırlanır.")}
        </p>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="submit" loading={busy}>
          {t("Kaydet")}
        </Button>
      </div>
    </form>
  );
}

const NOTIFY = [
  ["notify_messages", "Yeni mesajlar"],
  ["notify_listing", "İlan onayları ve reddedilmeler"],
  ["notify_price", "Favorilerimdeki fiyat düşüşleri"],
  ["notify_rating", "Hakkımdaki değerlendirmeler"],
  ["notify_announcements", "Duyurular"],
] as const;

function NotificationSection({ me }: { me: Me }) {
  const { t } = useLocale();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFY.map(([k]) => [k, me.settings[k] !== false])),
  );
  return (
    <ul className="divide-y divide-border">
      {NOTIFY.map(([key, label]) => (
        <li key={key} className="flex min-h-14 items-center justify-between gap-4">
          <span className="text-[14px]">{t(label)}</span>
          <Switch
            label={label}
            checked={values[key]}
            onChange={async (v) => {
              setValues((s) => ({ ...s, [key]: v }));
              try {
                await api.patch("/me/settings", { [key]: v });
              } catch (err) {
                setValues((s) => ({ ...s, [key]: !v }));
                toast.show(errorMessage(err), { tone: "error" });
              }
            }}
          />
        </li>
      ))}
    </ul>
  );
}

type Session = { id: string; client: string; userAgent: string | null; createdAt: string; lastUsedAt: string; current: boolean };

function deviceName(ua: string | null) {
  if (!ua) return "Bilinmeyen cihaz";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [browser, os].filter(Boolean).join(" · ") || "Bilinmeyen cihaz";
}

function SecuritySection({ me }: { me: Me }) {
  const { t, locale } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    api
      .get<{ sessions: Session[] }>("/auth/sessions")
      .then((r) => setSessions(r.sessions))
      .catch(() => setSessions([]));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const pw = passwordSchema.safeParse(next);
          if (!pw.success) return setError(t(pw.error.issues[0].message));
          setBusy(true);
          setError("");
          try {
            await api.post("/auth/password", { current, password: next });
            setCurrent("");
            setNext("");
            toast.show("Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.");
            const r = await api.get<{ sessions: Session[] }>("/auth/sessions");
            setSessions(r.sessions);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <h3 className="font-semibold">{t(me.hasPassword ? "Şifreyi değiştir" : "Şifre belirle")}</h3>
        {me.hasPassword ? <Field label="Mevcut şifre" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /> : null}
        <Field label="Yeni şifre" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="En az 8 karakter." />
        {error ? <FormError>{error}</FormError> : null}
        <div>
          <Button type="submit" loading={busy}>
            {t("Şifreyi kaydet")}
          </Button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{t("Açık oturumlar")}</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await api.post("/auth/logout-all").catch(() => {});
              router.push("/giris");
              router.refresh();
            }}
          >
            {t("Her yerden çıkış yap")}
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-card border border-border">
          {sessions === null ? (
            <li className="p-4">
              <div className="skeleton h-5 w-2/3" />
            </li>
          ) : (
            sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-4">
                <Icon name={s.client === "mobile" ? "phone" : "monitor"} className="h-5 w-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">
                    {t(deviceName(s.userAgent))}
                    {s.current ? <span className="ml-2 rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">{t("Bu cihaz")}</span> : null}
                  </p>
                  <p className="text-[12px] text-muted">{t("Son kullanım:")} {formatLocalized("timeAgo", [s.lastUsedAt], locale)}</p>
                </div>
                {!s.current ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await api.del(`/auth/sessions/${s.id}`).catch(() => {});
                      setSessions((list) => list?.filter((x) => x.id !== s.id) ?? null);
                    }}
                  >
                    {t("Kapat")}
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function DeleteSection({ me }: { me: Me }) {
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const word = t("SİL");
  return (
    <div>
      <p className="text-[14px] text-muted">
        {t("Hesabını silersen profilin, ilanların, fotoğrafların, favorilerin ve bildirimlerin kalıcı olarak silinir. Karşı tarafın sohbet geçmişi onlarda kalır; senin adın “Silinmiş kullanıcı” olarak görünür.")}
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)} icon={<Icon name="trash" className="h-4 w-4" />}>
        {t("Hesabımı sil")}
      </Button>
      <Modal title="Hesabını sil" description="Bu işlem geri alınamaz." open={open} onClose={() => setOpen(false)} size="sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api.post("/me/delete", { password });
              await api.post("/auth/logout").catch(() => {});
              router.push("/?hesap=silindi");
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
          className="flex flex-col gap-4"
        >
          {me.hasPassword ? <Field label="Şifren" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /> : null}
          <Field label={t(`Onaylamak için ${word} yaz`)} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          {error ? <FormError>{error}</FormError> : null}
          <Notice tone="warning">{t("Hesabın kısıtlıysa silinemez; itiraz için destek talebi oluşturabilirsin.")}</Notice>
          <Button type="submit" variant="danger" full loading={busy} disabled={confirm.trim().toLocaleUpperCase("tr-TR") !== word.toLocaleUpperCase("tr-TR")}>
            {t("Hesabımı kalıcı olarak sil")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

export function Settings({ me }: { me: Me }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t("Ayarlar")}</h1>
      <Section id="profil" title="Profil" description="Diğer kullanıcıların gördüğü bilgiler.">
        <ProfileSection me={me} />
      </Section>
      <Section id="iletisim" title="İletişim" description="Telefonun yalnızca izin verdiğin şekilde paylaşılır.">
        <ContactSection me={me} />
      </Section>
      <Section id="bildirimler" title="Bildirim tercihleri">
        <NotificationSection me={me} />
      </Section>
      <Section id="guvenlik" title="Güvenlik" description={`${t("Giriş e-postan:")} ${me.email}`}>
        <SecuritySection me={me} />
      </Section>
      <Section id="gorunum" title="Dil ve görünüm">
        <AppearanceControls />
      </Section>
      <Section id="hesap" title="Hesabı sil">
        <DeleteSection me={me} />
      </Section>
    </div>
  );
}
