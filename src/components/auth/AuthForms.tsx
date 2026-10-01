"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError, Notice } from "@/components/ui/FormError";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { ApiRequestError, errorMessage } from "@/lib/api/errors";
import { safeInternalPath } from "@/lib/safeRedirect";
import { REGION_NAMES } from "@shared/constants";
import { passwordSchema } from "@shared/schemas";

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiRequestError | Error | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run, message: error ? errorMessage(error) : "" };
}

function ResendVerification({ email }: { email: string }) {
  const { t } = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  return (
    <button
      type="button"
      disabled={state !== "idle" || !email}
      onClick={async () => {
        setState("busy");
        await api.post("/auth/resend-verification", { email }).catch(() => {});
        setState("sent");
      }}
      className="font-semibold text-accent underline-offset-2 hover:underline disabled:text-muted disabled:no-underline"
    >
      {state === "sent" ? t("Yeni bağlantı gönderildi") : t("Doğrulama e-postasını yeniden gönder")}
    </button>
  );
}

export function LoginForm({ returnTo, notice }: { returnTo: string; notice?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const s = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const target = safeInternalPath(returnTo);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void s.run(async () => {
          await api.post("/auth/login", { email, password });
          router.replace(target);
          router.refresh();
        });
      }}
      className="flex flex-col gap-4"
    >
      {notice ? <Notice>{t(notice)}</Notice> : null}
      <Field label="E-posta" type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field
        label="Şifre"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={
          <Link href="/sifre-yenile" className="font-medium text-accent hover:underline">
            {t("Şifremi unuttum")}
          </Link>
        }
      />
      {s.error ? (
        <FormError>
          {s.message}
          {s.error instanceof ApiRequestError && s.error.code === "email_not_verified" ? (
            <span className="mt-2 block">
              <ResendVerification email={email} />
            </span>
          ) : null}
        </FormError>
      ) : null}
      <Button type="submit" size="lg" full loading={s.busy}>
        {t("Giriş yap")}
      </Button>
    </form>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const { t } = useLocale();
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-zçğıöşü]/.test(password) && /[A-ZÇĞİÖŞÜ]/.test(password)) score++;
  if (/\d/.test(password) && /[^\p{L}\d]/u.test(password)) score++;
  const labels = ["Çok zayıf", "Zayıf", "İdare eder", "İyi", "Güçlü"];
  const colors = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"];
  return (
    <div className="-mt-2 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : "bg-border"}`} />
        ))}
      </div>
      <span className="text-[12px] text-muted">{t(labels[score])}</span>
    </div>
  );
}

export function SignupForm({ returnTo }: { returnTo: string }) {
  const { t } = useLocale();
  const s = useSubmit();
  const [form, setForm] = useState({ name: "", email: "", password: "", region: "", accept: false });
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="mail" className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-bold">{t("E-postanı kontrol et")}</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          <span translate="no" className="font-semibold text-text">{form.email}</span> {t("adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayınca hesabın açılacak.")}
        </p>
        <p className="text-[13px] text-muted">{t("Gelen kutunda göremiyorsan gereksiz (spam) klasörüne bak.")}</p>
        <ResendVerification email={form.email} />
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (form.name.trim().length < 2) errs.name = t("Adını gir.");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errs.email = t("Geçerli bir e-posta adresi gir.");
        const pw = passwordSchema.safeParse(form.password);
        if (!pw.success) errs.password = t(pw.error.issues[0].message);
        if (!form.accept) errs.accept = t("Devam etmek için koşulları kabul et.");
        setFieldErrors(errs);
        if (Object.keys(errs).length) return;
        void s.run(async () => {
          await api.post("/auth/signup", { name: form.name, email: form.email, password: form.password, region: form.region });
          try {
            window.sessionStorage.setItem("kie-after-verify", safeInternalPath(returnTo));
          } catch {}
          setSent(true);
        });
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Adın" name="name" autoComplete="name" required value={form.name} onChange={(e) => set({ name: e.target.value })} error={fieldErrors.name} hint="Diğer kullanıcılar seni bu adla görür." maxLength={40} />
      <Field label="E-posta" type="email" name="email" autoComplete="email" inputMode="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} error={fieldErrors.email} hint="Kimseyle paylaşılmaz." />
      <Field
        label="Şifre"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        value={form.password}
        onChange={(e) => set({ password: e.target.value })}
        error={fieldErrors.password}
        hint="En az 8 karakter. Uzun bir cümle en güvenlisi."
      />
      <PasswordStrength password={form.password} />
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        <span className="flex justify-between">
          {t("Bölgen")}
          <span className="font-normal text-subtle">{t("İsteğe bağlı")}</span>
        </span>
        <select value={form.region} onChange={(e) => set({ region: e.target.value })} className="min-h-11 rounded-field border border-border-strong bg-surface px-3.5 text-[15px] font-normal">
          <option value="">{t("Seçme")}</option>
          {REGION_NAMES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2.5 text-[13px]">
        <input type="checkbox" checked={form.accept} onChange={(e) => set({ accept: e.target.checked })} className="mt-0.5 h-[18px] w-[18px] accent-[var(--accent)]" aria-invalid={Boolean(fieldErrors.accept)} />
        <span>
          <Link href="/kosullar" target="_blank" className="font-medium text-accent hover:underline">
            {t("Kullanım koşullarını")}
          </Link>{" "}
          {t("ve")}{" "}
          <Link href="/gizlilik" target="_blank" className="font-medium text-accent hover:underline">
            {t("gizlilik bildirimini")}
          </Link>{" "}
          {t("okudum, kabul ediyorum.")}
        </span>
      </label>
      {fieldErrors.accept ? <p className="-mt-2 text-[12px] font-medium text-danger">{fieldErrors.accept}</p> : null}
      {s.error ? <FormError>{s.message}</FormError> : null}
      <Button type="submit" size="lg" full loading={s.busy}>
        {t("Hesap oluştur")}
      </Button>
    </form>
  );
}

/** Opened from the e-mail link: confirms the address and signs the person in. */
export function VerifyEmail({ token }: { token: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const [message, setMessage] = useState(token ? "" : t("Doğrulama bağlantısı eksik."));
  const once = useRef(false);

  useEffect(() => {
    if (once.current || !token) return;
    once.current = true;
    api
      .post("/auth/verify-email", { token })
      .then(() => {
        setState("done");
        // New accounts finish their profile first, then go where they started.
        let next = "/kurulum";
        try {
          const back = window.sessionStorage.getItem("kie-after-verify");
          if (back && back !== "/") next = `/kurulum?returnTo=${encodeURIComponent(back)}`;
          window.sessionStorage.removeItem("kie-after-verify");
        } catch {}
        setTimeout(() => {
          router.replace(next);
          router.refresh();
        }, 1200);
      })
      .catch((e) => {
        setState("failed");
        setMessage(errorMessage(e));
      });
  }, [token, router, t]);

  if (state === "working") {
    return (
      <div className="flex flex-col items-center gap-3 py-8" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-accent border-r-transparent" />
        <p className="text-[14px] text-muted">{t("E-posta adresin doğrulanıyor…")}</p>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="check" className="h-7 w-7" />
        </span>
        <p className="font-semibold">{t("E-posta adresin doğrulandı. Hoş geldin!")}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <FormError>{message}</FormError>
      <p className="text-[14px] text-muted">{t("Bağlantıların süresi 24 saattir ve yalnızca bir kez kullanılabilir. Giriş yapmayı dene; gerekirse yeni bağlantı iste.")}</p>
      <Link href="/giris" className="text-center font-semibold text-accent hover:underline">
        {t("Giriş sayfasına git")}
      </Link>
    </div>
  );
}

export function ResetRequestForm() {
  const { t } = useLocale();
  const s = useSubmit();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <Notice tone="success" icon="check">
        {t("Bu adresle bir hesap varsa şifre sıfırlama bağlantısı gönderdik. Bağlantı 1 saat geçerlidir.")}
      </Notice>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void s.run(async () => {
          await api.post("/auth/password-reset", { email });
          setSent(true);
        });
      }}
      className="flex flex-col gap-4"
    >
      <Field label="E-posta" type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {s.error ? <FormError>{s.message}</FormError> : null}
      <Button type="submit" size="lg" full loading={s.busy}>
        {t("Sıfırlama bağlantısı gönder")}
      </Button>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const s = useSubmit();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <FormError>{t("Şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.")}</FormError>
        <Link href="/sifre-yenile" className="text-center font-semibold text-accent hover:underline">
          {t("Yeni bağlantı iste")}
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const pw = passwordSchema.safeParse(password);
        if (!pw.success) return setErr(t(pw.error.issues[0].message));
        if (password !== confirm) return setErr(t("Şifreler birbiriyle eşleşmiyor."));
        setErr("");
        void s.run(async () => {
          await api.post("/auth/password-reset/confirm", { token, password });
          router.replace("/hesabim?sifre=yenilendi");
          router.refresh();
        });
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Yeni şifre" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="En az 8 karakter." />
      <PasswordStrength password={password} />
      <Field label="Yeni şifre (tekrar)" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {err || s.error ? <FormError>{err || s.message}</FormError> : null}
      <Notice icon="lock">{t("Şifreni değiştirince diğer cihazlardaki oturumların kapanır.")}</Notice>
      <Button type="submit" size="lg" full loading={s.busy}>
        {t("Şifreyi kaydet")}
      </Button>
    </form>
  );
}
