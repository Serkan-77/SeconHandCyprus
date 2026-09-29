
import * as I18n from "@/components/i18n/Localized";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, getFavoriteIds, getSellerSummary, getUnreadCounts, getViewer, toCard } from "@/lib/queries";

export const metadata = { title: "Hesabım" };

export default async function AccountHomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim");
  const supabase = await createClient();

  const [summary, unread, favoriteIds, { data: recent }] = await Promise.all([
    getSellerSummary(viewer.user.id),
    getUnreadCounts(),
    getFavoriteIds(),
    supabase
      .from("listings")
      .select(LISTING_CARD_SELECT)
      .eq("seller_id", viewer.user.id)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const listings = (recent ?? []).map(toCard);
  const firstName = viewer.profile.displayName.split(" ")[0];
  const emailVerified = Boolean(viewer.user.email_confirmed_at);

  const stats = [
    { value: String(summary?.activeListings ?? 0), label: "Aktif ilan", href: "/hesabim/ilanlar" },
    { value: String(unread.messages), label: "Okunmamış mesaj", href: "/mesajlar" },
    { value: String(favoriteIds.length), label: "Favori", href: "/hesabim/favoriler" },
    {
      value: summary?.ratingCount
        ? <I18n.Formatted kind="decimal" args={[summary.ratingAvg]} />
        : "—",
      label: "Satıcı puanı",
      href: `/satici/${viewer.user.id}/yorumlar`,
    },
  ];

  return (
    <I18n.div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Merhaba, <I18n.Raw>{firstName}</I18n.Raw>.</I18n.h1>
          <I18n.p className="mt-2 text-[13px] text-muted">İlanların, mesajların ve yeni keşiflerin burada.</I18n.p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <LinkButton href={`/satici/${viewer.user.id}`} variant="ghost" full={false}>
            Profilimi gör
          </LinkButton>
          <LinkButton href="/hesabim/duzenle" variant="outline" full={false} icon={<Icon name="edit" className="h-4 w-4" />}>
            Profili düzenle
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-bg sm:grid-cols-[1fr_250px]">
        <div className="p-6 sm:p-8">
          <I18n.span className="text-[9px] font-semibold tracking-[1.8px] text-accent">YENİ BİR HİKÂYE BAŞLAT</I18n.span>
          <I18n.h2 className="my-3 text-xl font-semibold sm:text-[27px]">
            Kullanmadığın eşya,
            <br />
            birinin aradığı olabilir.
          </I18n.h2>
          <LinkButton href="/ilan-ver/fotograflar" full={false} icon={<Icon name="plus" className="h-4 w-4" />}>
            Ücretsiz ilan ver
          </LinkButton>
        </div>
        <div className="relative hidden min-h-[160px] sm:block">
          <I18n.Image src="/images/demo-bicycle.jpg" alt="" fill sizes="250px" className="object-cover" />
        </div>
      </div>

      <I18n.div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {stats.map((stat) => (
          <I18n.Link key={stat.label} href={stat.href} className="relative rounded-[10px] border border-border p-4 text-left">
            <I18n.strong className="block text-2xl font-semibold tracking-tight">{stat.value}</I18n.strong>
            <I18n.span className="text-[11px] text-muted">{stat.label}</I18n.span>
            <Icon name="chevron" className="absolute right-2.5 top-7 h-4 w-4 text-muted" />
          </I18n.Link>
        ))}
      </I18n.div>

      {!emailVerified || !viewer.profile.phoneVerified ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-bg p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-accent">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div className="min-w-[200px] flex-1">
            <I18n.b className="text-[13px]">Güven, küçük adımlarla büyür.</I18n.b>
            <I18n.p className="mt-1 text-[11px] text-muted">
              {!emailVerified ? "E-postanı doğrula" : "Telefon numaran için inceleme iste"}, profil güvenini tamamla.
            </I18n.p>
          </div>
          <LinkButton href="/hesabim/dogrulama" variant="outline" full={false}>
            Doğrula
          </LinkButton>
        </div>
      ) : null}

      <I18n.div>
        <I18n.div className="mb-3.5 flex items-center justify-between">
          <I18n.h2 className="text-lg font-semibold">Son ilanların</I18n.h2>
          {listings.length ? (
            <I18n.Link href="/hesabim/ilanlar" className="text-xs font-medium text-accent">
              Tümünü gör
            </I18n.Link>
          ) : null}
        </I18n.div>
        {listings.length ? (
          <I18n.div className="overflow-hidden rounded-xl border border-border">
            {listings.map((listing) => (
              <I18n.Link
                key={listing.id}
                href={`/hesabim/ilanlar/${listing.id}`}
                className="flex flex-wrap items-center gap-4 border-b border-border p-5 last:border-0"
              >
                <I18n.Image
                  src={listing.image}
                  alt={listing.title}
                  width={100}
                  height={90}
                  className="h-[90px] w-[100px] rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <I18n.span className="text-[10px] text-muted">#KB{listing.refNo}</I18n.span>
                  <I18n.h3 className="my-1 text-sm font-semibold"><I18n.Raw>{listing.title}</I18n.Raw></I18n.h3>
                  <I18n.strong className="text-base"><I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} /></I18n.strong>
                  <I18n.p className="mt-1 text-[10px] text-muted">{listing.city}</I18n.p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ListingStatusBadge status={listing.status} />
                  <I18n.span className="text-[10px] text-muted">{listing.viewCount} görüntülenme</I18n.span>
                </div>
              </I18n.Link>
            ))}
          </I18n.div>
        ) : (
          <I18n.div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
            <Icon name="bag" className="h-8 w-8" />
            Henüz bir ilanın yok.
          </I18n.div>
        )}
      </I18n.div>
    </I18n.div>
  );
}
