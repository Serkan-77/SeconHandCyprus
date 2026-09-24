import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { LinkButton } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
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
    supabase.from("listings").select("id, title, category_id, price, currency, description").eq("id", id).maybeSingle(),
    getCategories(),
  ]);
  if (!listing) notFound();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">İlan düzenleme</h1>
        <LinkButton href={`/yonetim/ilanlar/${id}`} variant="outline" full={false} className="min-h-10 text-xs">
          İncelemeye dön
        </LinkButton>
      </div>
      <p className="text-xs text-muted">
        Onaylamadan önce içerikteki küçük hataları burada düzeltebilirsin; bu bir moderatör işlemidir.
      </p>
      <AdminEditForm
        listing={{
          id: listing.id,
          title: listing.title,
          categoryId: listing.category_id,
          price: String(Number(listing.price)),
          currency: listing.currency,
          description: listing.description,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}
