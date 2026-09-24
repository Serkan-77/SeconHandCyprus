import Image from "next/image";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, one, toCard, type ListingStatus } from "@/lib/queries";
import { formatDate, formatPrice } from "@/lib/format";
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">İlan moderasyonu</h1>
          <p className="mt-1.5 text-xs text-muted">
            {filter.key === "bekleyen" ? `İnceleme bekleyen ${count ?? 0} ilan var.` : `${count ?? 0} ilan.`}
          </p>
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="durum" value={filter.key} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Başlıkta ara"
            aria-label="İlan başlığında ara"
            className="min-h-10 rounded-button border border-border bg-surface px-3 text-xs"
          />
          <button className="min-h-10 rounded-button bg-brand px-3 text-xs text-on-brand">Ara</button>
        </form>
      </div>

      <div className="flex gap-0 overflow-x-auto border-b border-border">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/yonetim/ilanlar?durum=${f.key}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-3 text-xs",
              f.key === filter.key ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
          <Icon name="check" className="h-8 w-8 text-accent" />
          {filter.key === "bekleyen" ? "Moderasyon kuyruğu boş. Tüm ilanlar incelendi." : "Bu filtrede ilan yok."}
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="bg-bg text-[10px] text-muted">
                <th className="p-3 font-medium">İlan</th>
                <th className="p-3 font-medium">Satıcı</th>
                <th className="p-3 font-medium">Kategori</th>
                <th className="p-3 font-medium">Fiyat</th>
                <th className="p-3 font-medium">Tarih</th>
                <th className="p-3 font-medium">Durum</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((listing) => (
                <tr key={listing.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <Image src={listing.image} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
                      <span className="max-w-[220px] truncate">{listing.title}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted">
                    {listing.seller ? (
                      <Link href={`/yonetim/kullanicilar/${listing.seller.id}`} className="hover:text-text">
                        {listing.seller.display_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-muted">{listing.category.name}</td>
                  <td className="p-3">{formatPrice(listing.price, listing.currency)}</td>
                  <td className="p-3 text-muted">{formatDate(listing.createdAt)}</td>
                  <td className="p-3">
                    <ListingStatusBadge status={listing.status} />
                  </td>
                  <td className="p-3">
                    <Link href={`/yonetim/ilanlar/${listing.id}`} className="text-[11px] font-medium text-accent">
                      {listing.status === "pending" ? "İncele" : "Aç"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
