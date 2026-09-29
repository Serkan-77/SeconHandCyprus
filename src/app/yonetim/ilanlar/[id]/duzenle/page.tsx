
import * as I18n from "@/components/i18n/Localized";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { LinkButton } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/env";
import { getCategories } from "@/lib/queries";
import { AdminEditForm } from "./AdminEditForm";

export const metadata = { title: "Yönetim · İlan düzenleme", robots: { index: false } };

export default async function AdminEditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell>
      <Editor id={id} />
    </AdminShell>
  );
}

async function Editor({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: listing }, categories] = await Promise.all([
    supabase.from("listings").select("*, images:listing_images(id, path, position)").eq("id", id).maybeSingle(),
    getCategories(),
  ]);
  if (!listing) notFound();
  const images = [...(listing.images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ id: i.id as string, url: publicImageUrl(i.path) }));

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">İlan düzenleme</I18n.h1>
        <LinkButton href={`/yonetim/ilanlar/${id}`} variant="outline" full={false} className="min-h-10 text-xs">
          İncelemeye dön
        </LinkButton>
      </div>
      <I18n.p className="text-xs text-muted">
        Yönetici olarak ilanın her alanını, durumunu ve fotoğraflarını değiştirebilir ya da ilanı silebilirsin. Yönetici
        düzenlemesi ilanı yeniden incelemeye düşürmez.
      </I18n.p>
      <AdminEditForm
        listing={{
          id: listing.id,
          title: listing.title,
          categoryId: listing.category_id,
          price: String(Number(listing.price)),
          currency: listing.currency,
          condition: listing.condition,
          city: listing.city,
          district: listing.district ?? "",
          description: listing.description,
          negotiable: listing.negotiable,
          status: listing.status,
          details: listing.details ?? {},
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        images={images}
      />
    </>
  );
}
