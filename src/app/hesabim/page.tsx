import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, getFavoriteIds, getSellerSummary, getUnreadCounts, getViewer, toCard } from "@/lib/queries";
import { formatPrice } from "@/lib/format";

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
        ? summary.ratingAvg.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : "—",
      label: "Satıcı puanı",
      href: `/satici/${viewer.user.id}/yorumlar`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Merhaba, {firstName}.</h1>
          <p className="mt-2 text-[13px] text-muted">İlanların, mesajların ve yeni keşiflerin burada.</p>
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
          <span className="text-[9px] font-semibold tracking-[1.8px] text-accent">YENİ BİR HİKÂYE BAŞLAT</span>
          <h2 className="my-3 text-xl font-semibold sm:text-[27px]">
            Kullanmadığın eşya,
            <br />
            birinin aradığı olabilir.
          </h2>
          <LinkButton href="/ilan-ver/fotograflar" full={false} icon={<Icon name="plus" className="h-4 w-4" />}>
            Ücretsiz ilan ver
          </LinkButton>
        </div>
        <div className="relative hidden min-h-[160px] sm:block">
          <Image src="/images/demo-bicycle.jpg" alt="" fill sizes="250px" className="object-cover" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="relative rounded-[10px] border border-border p-4 text-left">
            <strong className="block text-2xl font-semibold tracking-tight">{stat.value}</strong>
            <span className="text-[11px] text-muted">{stat.label}</span>
            <Icon name="chevron" className="absolute right-2.5 top-7 h-4 w-4 text-muted" />
          </Link>
        ))}
      </div>

      {!emailVerified || !viewer.profile.phoneVerified ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-bg p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-accent">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div className="min-w-[200px] flex-1">
            <b className="text-[13px]">Güven, küçük adımlarla büyür.</b>
            <p className="mt-1 text-[11px] text-muted">
              {!emailVerified ? "E-postanı doğrula" : "Telefon numaran için inceleme iste"}, profil güvenini tamamla.
            </p>
          </div>
          <LinkButton href="/hesabim/dogrulama" variant="outline" full={false}>
            Doğrula
          </LinkButton>
        </div>
      ) : null}

      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Son ilanların</h2>
          {listings.length ? (
            <Link href="/hesabim/ilanlar" className="text-xs font-medium text-accent">
              Tümünü gör
            </Link>
          ) : null}
        </div>
        {listings.length ? (
          <div className="overflow-hidden rounded-xl border border-border">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/hesabim/ilanlar/${listing.id}`}
                className="flex flex-wrap items-center gap-4 border-b border-border p-5 last:border-0"
              >
                <Image
                  src={listing.image}
                  alt={listing.title}
                  width={100}
                  height={90}
                  className="h-[90px] w-[100px] rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted">#KB{listing.refNo}</span>
                  <h3 className="my-1 text-sm font-semibold">{listing.title}</h3>
                  <strong className="text-base">{formatPrice(listing.price, listing.currency)}</strong>
                  <p className="mt-1 text-[10px] text-muted">{listing.city}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ListingStatusBadge status={listing.status} />
                  <span className="text-[10px] text-muted">{listing.viewCount} görüntülenme</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
            <Icon name="bag" className="h-8 w-8" />
            Henüz bir ilanın yok.
          </div>
        )}
      </div>
    </div>
  );
}
