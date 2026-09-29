
import * as I18n from "@/components/i18n/Localized";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SellerHeader } from "@/components/SellerHeader";
import { ListingGrid } from "@/components/ListingGrid";
import { getSellerSummary, publicName, searchListings } from "@/lib/queries";
import { SITE } from "@/lib/site";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const seller = UUID.test(id) ? await getSellerSummary(id) : null;
  if (!seller) return { title: "Satıcı bulunamadı" };
  const name = publicName(seller);
  return {
    title: seller.accountType === "store" ? `${name} — mağaza` : `${name} — satıcı profili`,
    description: `${name} kullanıcısının ${SITE.name}'deki ${seller.activeListings} aktif ilanı ve ${seller.ratingCount} değerlendirmesi.`,
    alternates: { canonical: `/satici/${id}` },
  };
}

export default async function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const seller = await getSellerSummary(id);
  if (!seller) notFound();
  const { items } = await searchListings({ sellerId: id, pageSize: 48 });

  return (
    <div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6">
      <Breadcrumbs
        items={seller.accountType === "store" ? [{ label: "Mağazalar", href: "/magazalar" }, publicName(seller)] : [publicName(seller)]}
      />
      <SellerHeader seller={seller} active="profil" />
      <I18n.h2 className="mb-5 text-lg font-semibold">{seller.accountType === "store" ? "Mağazanın ürünleri" : "Aktif ilanları"}</I18n.h2>
      <ListingGrid items={items} columns={3} emptyAction={false} empty={`${publicName(seller)} şu an aktif bir ilan yayınlamıyor.`} />
    </div>
  );
}
