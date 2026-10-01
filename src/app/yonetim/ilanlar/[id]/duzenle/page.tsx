import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListingForm } from "@/components/admin/AdminListingForm";
import { apiServer, apiServerOrNull, getTaxonomy } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import type { ListingCard } from "@/lib/api/types";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "İlanı düzenle" };

export default async function AdminEditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, taxonomy, { t }] = await Promise.all([
    apiServerOrNull<{ listing: ListingCard & { description: string; attributes: Record<string, unknown> } }>(`/admin/listings/${id}`),
    getTaxonomy(),
    getI18n(),
  ]);
  if (!data) notFound();
  const l = data.listing;
  // Admins also see hidden categories.
  const all = await apiServer<{ categories: Category[] }>("/admin/categories");
  return (
    <>
      <Link href={`/yonetim/ilanlar/${id}`} className="text-[13px] text-muted hover:text-text">
        ← {t("İlan incelemesi")}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t("İlanı düzenle")}</h1>
      <p className="-mt-4 text-[14px] text-muted">{t("Yönetici düzenlemeleri ilanı yeniden incelemeye göndermez.")}</p>
      <AdminListingForm
        categories={all.categories}
        attributes={taxonomy.attributes}
        initial={{
          id: l.id,
          title: l.title,
          categoryId: l.category?.id ?? all.categories[0]?.id ?? 1,
          price: l.price,
          currency: l.currency,
          condition: l.condition,
          city: l.city,
          district: l.district,
          description: l.description,
          negotiable: l.negotiable,
          status: l.status,
          attributes: l.attributes,
        }}
      />
    </>
  );
}
