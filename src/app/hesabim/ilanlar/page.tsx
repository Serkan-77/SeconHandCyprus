
import * as I18n from "@/components/i18n/Localized";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, getViewer, toCard, type ListingStatus } from "@/lib/queries";
import { cn } from "@/lib/cn";

export const metadata = { title: "İlanlarım" };

const tabs: { key: string; label: string; statuses: ListingStatus[] }[] = [
  { key: "aktif", label: "Aktif", statuses: ["active"] },
  { key: "inceleme", label: "İncelemede", statuses: ["pending", "rejected"] },
  { key: "satilan", label: "Satılan", statuses: ["sold"] },
  { key: "pasif", label: "Pasif", statuses: ["removed", "draft"] },
];

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/ilanlar");
  const { sekme } = await searchParams;
  const active = tabs.find((t) => t.key === sekme) ?? tabs[0];

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(LISTING_CARD_SELECT)
    .eq("seller_id", viewer.user.id)
    .order("created_at", { ascending: false });
  const all = (data ?? []).map(toCard);
  const listings = all.filter((l) => active.statuses.includes(l.status));

  return (
    <I18n.div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">İlanlarım</I18n.h1>
          <I18n.p className="mt-2 text-[13px] text-muted">Eşyalarının yeni hikâyelerini buradan takip et.</I18n.p>
        </div>
        <LinkButton href="/ilan-ver/fotograflar" full={false} icon={<Icon name="plus" className="h-4 w-4" />}>
          Yeni ilan ver
        </LinkButton>
      </div>

      <I18n.div className="flex gap-0 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const count = all.filter((l) => t.statuses.includes(l.status)).length;
          return (
            <I18n.Link
              key={t.key}
              href={t.key === "aktif" ? "/hesabim/ilanlar" : `/hesabim/ilanlar?sekme=${t.key}`}
              aria-current={t.key === active.key ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-xs",
                t.key === active.key ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
              )}
            >
              {t.label} ({count})
            </I18n.Link>
          );
        })}
      </I18n.div>

      {listings.length ? (
        <I18n.div className="overflow-hidden rounded-xl border border-border">
          {listings.map((listing) => (
            <article key={listing.id} className="flex flex-wrap items-center gap-4 border-b border-border p-5 last:border-0">
              <I18n.Image
                src={listing.image}
                alt={listing.title}
                width={100}
                height={90}
                className="h-[90px] w-[100px] flex-shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <I18n.span className="text-[10px] text-muted">
                  #KB{listing.refNo} · <I18n.Formatted kind="relativeDay" args={[listing.createdAt]} />
                </I18n.span>
                <I18n.h3 className="my-1 text-sm font-semibold"><I18n.Raw>{listing.title}</I18n.Raw></I18n.h3>
                <I18n.strong className="text-base"><I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} /></I18n.strong>
                <I18n.p className="mt-1 text-[10px] text-muted">{listing.city}</I18n.p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <ListingStatusBadge status={listing.status} />
                <I18n.span className="text-[10px] text-muted">{listing.viewCount} görüntülenme</I18n.span>
              </div>
              <div className="ml-auto flex flex-col items-center gap-2">
                <LinkButton href={`/hesabim/ilanlar/${listing.id}`} variant="outline" full={false} className="min-h-10 text-xs">
                  Yönet
                </LinkButton>
              </div>
            </article>
          ))}
        </I18n.div>
      ) : (
        <I18n.div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="bag" className="h-8 w-8" />
          Bu sekmede henüz bir ilanın yok.
        </I18n.div>
      )}

      <I18n.div className="flex items-start gap-2.5 rounded-xl bg-bg p-4 text-xs leading-relaxed text-muted">
        <Icon name="clock" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
        İncelemedeki ilanlar kontrol tamamlandıktan sonra görünür olur. Reddedilen ilanları düzenleyip tekrar
        incelemeye gönderebilirsin.
      </I18n.div>
    </I18n.div>
  );
}
