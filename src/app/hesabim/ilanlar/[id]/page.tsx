import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/env";
import { getViewer } from "@/lib/queries";
import { ManageListing } from "./ManageListing";

export const metadata = { title: "İlanı yönet" };

export default async function ManageListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/giris-gerekli?returnTo=/hesabim/ilanlar/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("*, images:listing_images(id, path, position)")
    .eq("id", id)
    .eq("seller_id", viewer.user.id)
    .maybeSingle();
  if (!listing) notFound();

  const images = [...(listing.images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ id: i.id as string, url: publicImageUrl(i.path) }));

  return (
    <ManageListing
      listing={{
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        price: String(Number(listing.price)),
        currency: listing.currency,
        city: listing.city,
        district: listing.district ?? "",
        description: listing.description,
        negotiable: listing.negotiable,
        details: listing.details ?? {},
        status: listing.status,
        rejectReason: listing.reject_reason,
        viewCount: listing.view_count,
      }}
      images={images}
    />
  );
}
