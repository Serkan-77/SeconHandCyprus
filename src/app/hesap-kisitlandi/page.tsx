import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { apiServer, getMe } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Hesap kısıtlaması", robots: { index: false } };

type Sanction = { kind: string; reason: string; expiresAt: string | null; createdAt: string };

export default async function RestrictedPage() {
  const [{ t, f }, me] = await Promise.all([getI18n(), getMe()]);
  const { items } = me ? await apiServer<{ items: Sanction[] }>("/me/sanctions").catch(() => ({ items: [] as Sanction[] })) : { items: [] as Sanction[] };
  const active = me && (me.status === "restricted" || me.status === "suspended") && (!me.statusUntil || new Date(me.statusUntil) > new Date());
  const latest = items.find((s) => s.kind === "restrict" || s.kind === "suspend");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-warning-soft text-warning">
        <Icon name="shield" className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-bold">{t(active ? "Hesabın kısıtlandı" : "Hesabında kısıtlama yok")}</h1>
      {active ? (
        <>
          <p className="text-[15px] leading-relaxed text-muted">
            {t("Kullanım koşullarımıza aykırı bir işlem tespit edildiği için ilan verme, mesajlaşma ve favorileme geçici olarak kapalı. İlanların bu süre boyunca herkese gizlenir.")}
          </p>
          <dl className="w-full rounded-card border border-border text-left text-[14px]">
            {latest ? (
              <div className="border-b border-border px-4 py-3">
                <dt className="text-muted">{t("Gerekçe")}</dt>
                <dd className="font-medium" translate="no">
                  {latest.reason}
                </dd>
              </div>
            ) : null}
            <div className="px-4 py-3">
              <dt className="text-muted">{t("Bitiş")}</dt>
              <dd className="font-medium">{me?.statusUntil ? f("formatLongDate", me.statusUntil) : t("Süresiz (inceleme sonrası kaldırılabilir)")}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="text-[15px] text-muted">{t("Her şey yolunda görünüyor.")}</p>
      )}
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        <LinkButton href="/destek" full>
          {t("İtiraz et / destek al")}
        </LinkButton>
        <LinkButton href="/kosullar" variant="outline" full>
          {t("Kullanım koşulları")}
        </LinkButton>
      </div>
    </div>
  );
}
