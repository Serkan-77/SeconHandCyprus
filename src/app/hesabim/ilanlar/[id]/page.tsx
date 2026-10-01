import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditListing } from "@/components/account/EditListing";
import { apiServerOrNull, getTaxonomy } from "@/lib/api/server";
import type { ImageUrls, ListingStatus } from "@/lib/api/types";
import { attributesFor } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "İlanı düzenle" };

type Editable = {
  id: string;
  slug: string;
  status: ListingStatus;
  title: string;
  price: number;
  currency: string;
  condition: string;
  city: string;
  district: string | null;
  description: string;
  negotiable: boolean;
  attributes: Record<string, unknown>;
  rejectReason: string | null;
  category: { id: number } | null;
  categoryPath: { name: string; nameEn: string | null }[];
  images: { id: string; key: string; urls: ImageUrls | null }[];
};

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, taxonomy] = await Promise.all([apiServerOrNull<{ listing: Editable }>(`/me/listings/${id}`), getTaxonomy()]);
  if (!data) notFound();
  const defs = data.listing.category ? attributesFor(taxonomy.categories, taxonomy.attributes, data.listing.category.id) : [];
  return <EditListing listing={data.listing} defs={defs} />;
}
