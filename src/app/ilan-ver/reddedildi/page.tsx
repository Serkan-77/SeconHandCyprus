
import * as I18n from "@/components/i18n/Localized";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/queries";

export const metadata = { title: "İlan yayınlanamadı" };

export default async function ListingRejectedPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/ilanlar");

  const supabase = await createClient();
  const { data: listing } =
    id && /^[0-9a-f-]{36}$/i.test(id)
      ? await supabase.from("listings").select("id, title, status, reject_reason").eq("id", id).eq("seller_id", viewer.user.id).maybeSingle()
      : { data: null };
  if (!listing) redirect("/hesabim/ilanlar?sekme=inceleme");

  return (
    <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-20 text-center">
      <span className="grid h-[85px] w-[85px] place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name="flag" className="h-9 w-9" />
      </span>
      <I18n.h1 className="text-2xl font-semibold">
        {listing.status === "rejected" ? "İlanın yayınlanamadı." : "İlanın durumu güncellendi."}
      </I18n.h1>
      <I18n.p className="max-w-xs text-sm text-muted">
        <I18n.b className="text-text"><I18n.Raw>{listing.title}</I18n.Raw></I18n.b>
        {listing.status === "rejected"
          ? ` kullanım koşullarımıza uymadığı için yayınlanamadı: ${listing.reject_reason ?? "kurallara uygun bulunmadı."} Düzenleyip tekrar gönderebilirsin.`
          : " için ret kararı artık geçerli değil."}
      </I18n.p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <LinkButton href={`/hesabim/ilanlar/${listing.id}`}>İlanı düzenle</LinkButton>
        <LinkButton href="/yardim" variant="outline">
          Yardım al
        </LinkButton>
      </div>
    </div>
  );
}
