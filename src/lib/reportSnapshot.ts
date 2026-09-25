// What a report was about, stored with the report when it was filed
// (reports.target_snapshot, migration 0011), so it survives the listing or
// account being deleted (P1-08).
export type ReportSnapshot = {
  captured_at?: string;
  listing?: {
    id: string;
    title: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    city?: string | null;
    district?: string | null;
    status?: string | null;
    ref_no?: number | null;
    seller_id?: string | null;
    seller_name?: string | null;
    images?: string[];
  };
  user?: { id: string; display_name: string };
};

/** Short label of a report's target from the snapshot, for deleted targets. */
export function snapshotLabel(snapshot: ReportSnapshot | null | undefined): string {
  if (snapshot?.listing) return `Silinmiş ilan · ${snapshot.listing.title}`;
  if (snapshot?.user) return `Silinmiş kullanıcı · ${snapshot.user.display_name}`;
  return "Silinmiş içerik";
}
