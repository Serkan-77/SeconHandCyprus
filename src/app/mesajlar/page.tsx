import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

// /mesajlar?c=<id> is the link format of message notifications; it opens the thread.
export default async function MessagesIndex({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ c }, { t }] = await Promise.all([searchParams, getI18n()]);
  if (c && /^[0-9a-f-]{36}$/i.test(c)) redirect(`/mesajlar/${c}`);
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-3 p-8 text-center lg:flex">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-muted">
        <Icon name="chat" className="h-7 w-7" />
      </span>
      <p className="font-semibold">{t("Bir sohbet seç")}</p>
      <p className="max-w-xs text-[14px] text-muted">{t("Soldaki listeden bir sohbet açarak mesajlaşmaya devam et.")}</p>
    </div>
  );
}
