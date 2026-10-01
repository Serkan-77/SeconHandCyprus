"use client";

// Small building blocks for the admin pages. Every action is a plain API
// call; the API checks admin rights again and writes the audit log.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";

const NAV: { href: string; icon: IconName; label: string; count?: string }[] = [
  { href: "/yonetim", icon: "chart", label: "Genel bakış" },
  { href: "/yonetim/ilanlar", icon: "bag", label: "İlan moderasyonu", count: "pending" },
  { href: "/yonetim/sikayetler", icon: "flag", label: "Şikayetler", count: "openReports" },
  { href: "/yonetim/kullanicilar", icon: "users", label: "Kullanıcılar" },
  { href: "/yonetim/dogrulama", icon: "shield", label: "Telefon incelemesi", count: "pendingVerifications" },
  { href: "/yonetim/destek", icon: "mail", label: "Destek talepleri", count: "openTickets" },
  { href: "/yonetim/kategoriler", icon: "grid", label: "Kategoriler ve alanlar" },
  { href: "/yonetim/duyurular", icon: "bell", label: "Duyurular" },
  { href: "/yonetim/kayitlar", icon: "history", label: "İşlem kayıtları" },
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const { t } = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("Yönetim menüsü")} className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV.map((item) => {
        const active = item.href === "/yonetim" ? pathname === item.href : pathname.startsWith(item.href);
        const count = item.count ? (counts[item.count] ?? 0) : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 flex-shrink-0 items-center gap-2.5 whitespace-nowrap rounded-button px-3 text-[13px]",
              active ? "bg-brand text-on-brand" : "text-muted hover:bg-brand-soft hover:text-text",
            )}
          >
            <Icon name={item.icon} className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{t(item.label)}</span>
            {count ? <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular", active ? "bg-on-brand text-brand" : "bg-accent text-on-accent")}>{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** A button that calls the API, optionally after a confirmation, then refreshes the page. */
export function AdminAction({
  label,
  method = "POST",
  path,
  body,
  confirm,
  variant = "outline",
  icon,
  done,
  redirectTo,
  size = "sm",
}: {
  label: string;
  method?: "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  confirm?: string;
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger" | "secondary";
  icon?: IconName;
  done?: string;
  redirectTo?: string;
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function run() {
    setBusy(true);
    try {
      if (method === "DELETE") await api.del(path, body);
      else if (method === "PUT") await api.put(path, body);
      else await api.post(path, body ?? {});
      setOpen(false);
      if (done) toast.show(done);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} loading={busy && !confirm} onClick={() => (confirm ? setOpen(true) : run())} icon={icon ? <Icon name={icon} className="h-4 w-4" /> : undefined}>
        {t(label)}
      </Button>
      {confirm ? (
        <Modal
          title={label}
          description={confirm}
          open={open}
          onClose={() => setOpen(false)}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("Vazgeç")}
              </Button>
              <Button variant={variant === "danger" ? "danger" : "primary"} loading={busy} onClick={run}>
                {t(label)}
              </Button>
            </>
          }
        >
          <span />
        </Modal>
      ) : null}
    </>
  );
}

const REJECT_REASONS = [
  "Yasaklı ya da kurallara aykırı ürün",
  "Yanıltıcı başlık ya da açıklama",
  "Uygunsuz ya da alakasız fotoğraf",
  "Yanlış kategori",
  "Açıklamada iletişim bilgisi ya da dış bağlantı",
  "Tekrarlanan ilan",
];

export function RejectButton({ listingId, size = "sm" }: { listingId: string; size?: "sm" | "md" }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)} icon={<Icon name="close" className="h-4 w-4" />}>
        {t("Reddet")}
      </Button>
      <Modal title="İlanı reddet" description="Gerekçe satıcıya bildirim olarak gider." open={open} onClose={() => setOpen(false)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api.post(`/admin/listings/${listingId}/reject`, { reason, note });
              setOpen(false);
              toast.show("İlan reddedildi.");
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-col gap-3"
        >
          <div className="space-y-1">
            {REJECT_REASONS.map((r) => (
              <label key={r} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-button border border-border px-3 text-[14px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--accent)]" />
                {t(r)}
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("Satıcıya not (isteğe bağlı)")}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={360} rows={3} className="rounded-field border border-border-strong bg-surface px-3 py-2 text-[14px] font-normal" />
          </label>
          {error ? <FormError>{error}</FormError> : null}
          <Button type="submit" variant="danger" loading={busy}>
            {t("Reddet ve bildir")}
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function SanctionButton({ userId }: { userId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"warn" | "restrict" | "suspend" | "lift">("warn");
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kinds = [
    ["warn", "Uyar", "Hesap çalışmaya devam eder; kullanıcıya bildirim gider."],
    ["restrict", "Geçici kısıtla", "İlan, mesaj, favori kapanır; ilanlar süre boyunca gizlenir."],
    ["suspend", "Askıya al", "Kısıtlama gibi, ancak süresiz (kaldırılana kadar)."],
    ["lift", "Kısıtlamayı kaldır", "Hesabı normale döndürür."],
  ] as const;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} icon={<Icon name="shield" className="h-4 w-4" />}>
        {t("Yaptırım uygula")}
      </Button>
      <Modal title="Yaptırım uygula" open={open} onClose={() => setOpen(false)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api.post(`/admin/users/${userId}/sanctions`, { kind, reason, ...(kind === "restrict" ? { days } : {}) });
              setOpen(false);
              setReason("");
              toast.show("Yaptırım kaydedildi.");
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-col gap-3"
        >
          {kinds.map(([k, label, hint]) => (
            <label key={k} className="flex cursor-pointer gap-2.5 rounded-button border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="mt-1 accent-[var(--accent)]" />
              <span>
                <span className="block text-[14px] font-semibold">{t(label)}</span>
                <span className="text-[13px] text-muted">{t(hint)}</span>
              </span>
            </label>
          ))}
          {kind === "restrict" ? (
            <label className="flex items-center gap-2 text-[14px]">
              {t("Süre (gün)")}
              <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 w-24 rounded-field border border-border-strong px-3" />
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("Gerekçe (kullanıcıya gösterilir)")}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} rows={3} required className="rounded-field border border-border-strong bg-surface px-3 py-2 text-[14px] font-normal" />
          </label>
          {error ? <FormError>{error}</FormError> : null}
          <Button type="submit" loading={busy}>
            {t("Kaydet")}
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function AdminCard({ title, children, action, className }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  const { t } = useLocale();
  return (
    <section className={cn("rounded-card border border-border bg-surface p-5", className)}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="font-semibold">{t(title)}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
