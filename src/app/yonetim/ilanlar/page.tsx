
import * as I18n from "@/components/i18n/Localized";
import { AdminShell } from "@/components/admin/AdminShell";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, one, toCard, type ListingStatus } from "@/lib/queries";
import { cn } from "@/lib/cn";

export const metadata = { title: "Yönetim · İlanlar", robots: { index: false } };

const filters: { key: string; label: string; statuses?: ListingStatus[] }[] = [
  { key: "bekleyen", label: "Bekleyen", statuses: ["pending"] },
  { key: "yayinda", label: "Yayında", statuses: ["active"] },
  { key: "reddedilen", label: "Reddedilen", statuses: ["rejected"] },
  { key: "hepsi", label: "Tümü" },
];

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ durum?: string; q?: string }> }) {
  const { durum, q } = await searchParams;
  const filter = filters.find((f) => f.key === durum) ?? filters[0];

  return (
    <AdminShell>
      <ListingsTable filter={filter} q={q} />
    </AdminShell>
  );
}

async function ListingsTable({ filter, q }: { filter: (typeof filters)[number]; q?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select(`${LISTING_CARD_SELECT}, seller:profiles!listings_seller_id_fkey(id, display_name)`, { count: "exact" })
    .order("created_at", { ascending: filter.key === "bekleyen" })
    .limit(100);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (q) query = query.ilike("title", `%${q.replace(/[%,]/g, " ")}%`);
  const { data, count } = await query;
  const rows = (data ?? []).map((row) => ({
    ...toCard(row),
    seller: one(row.seller) as { id: string; display_name: string } | null,
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">İlan moderasyonu</I18n.h1>
          <I18n.p className="mt-1.5 text-xs text-muted">
            {filter.key === "bekleyen" ? `İnceleme bekleyen ${count ?? 0} ilan var.` : `${count ?? 0} ilan.`}
          </I18n.p>
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="durum" value={filter.key} />
          <I18n.input
            name="q"
            defaultValue={q}
            placeholder="Başlıkta ara"
            aria-label="İlan başlığında ara"
            className="min-h-10 rounded-button border border-border bg-surface px-3 text-xs"
          />
          <I18n.button className="min-h-10 rounded-button bg-brand px-3 text-xs text-on-brand">Ara</I18n.button>
        </form>
      </div>

      <I18n.div className="flex gap-0 overflow-x-auto border-b border-border">
        {filters.map((f) => (
          <I18n.Link
            key={f.key}
            href={`/yonetim/ilanlar?durum=${f.key}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-3 text-xs",
              f.key === filter.key ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
            )}
          >
            {f.label}
          </I18n.Link>
        ))}
      </I18n.div>

      {rows.length === 0 ? (
        <I18n.div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="check" className="h-8 w-8 text-accent" />
          {filter.key === "bekleyen" ? "Moderasyon kuyruğu boş. Tüm ilanlar incelendi." : "Bu filtrede ilan yok."}
        </I18n.div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="bg-bg text-[10px] text-muted">
                <I18n.th className="p-3 font-medium">İlan</I18n.th>
                <I18n.th className="p-3 font-medium">Satıcı</I18n.th>
                <I18n.th className="p-3 font-medium">Kategori</I18n.th>
                <I18n.th className="p-3 font-medium">Fiyat</I18n.th>
                <I18n.th className="p-3 font-medium">Tarih</I18n.th>
                <I18n.th className="p-3 font-medium">Durum</I18n.th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <I18n.tbody>
              {rows.map((listing) => (
                <tr key={listing.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <I18n.Image src={listing.image} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
                      <I18n.span className="max-w-[220px] truncate"><I18n.Raw>{listing.title}</I18n.Raw></I18n.span>
                    </div>
                  </td>
                  <I18n.td className="p-3 text-muted">
                    {listing.seller ? (
                      <I18n.Link href={`/yonetim/kullanicilar/${listing.seller.id}`} className="hover:text-text">
                        <I18n.Raw>{listing.seller.display_name}</I18n.Raw>
                      </I18n.Link>
                    ) : (
                      "—"
                    )}
                  </I18n.td>
                  <I18n.td className="p-3 text-muted">{listing.category.name}</I18n.td>
                  <I18n.td className="p-3"><I18n.Formatted kind="formatPrice" args={[listing.price, listing.currency]} /></I18n.td>
                  <I18n.td className="p-3 text-muted"><I18n.Formatted kind="formatDate" args={[listing.createdAt]} /></I18n.td>
                  <td className="p-3">
                    <ListingStatusBadge status={listing.status} />
                  </td>
                  <td className="p-3">
                    <I18n.Link href={`/yonetim/ilanlar/${listing.id}`} className="text-[11px] font-medium text-accent">
                      {listing.status === "pending" ? "İncele" : "Aç"}
                    </I18n.Link>
                  </td>
                </tr>
              ))}
            </I18n.tbody>
          </table>
        </div>
      )}
    </>
  );
}
