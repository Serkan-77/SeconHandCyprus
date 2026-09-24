import { ComingSoon } from "@/components/ComingSoon";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { featureFlags } from "@/lib/featureFlags";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { PackagePicker } from "./PackagePicker";

export const metadata = { title: "İlanını öne çıkar" };

export default async function PromoteListingPage() {
  if (!featureFlags.monetization) {
    return (
      <ComingSoon
        title="Öne çıkarma yakında geliyor."
        desc="İlanını öne çıkarma paketleri, gerçek bir ödeme sağlayıcısıyla birlikte açılacak."
      />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("packages")
    .select("id, name, price, currency, duration_days")
    .eq("active", true)
    .not("duration_days", "is", null)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-[600px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["İlanı öne çıkar"]} />
      <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-[32px]">İlanını öne çıkar</h1>
      <p className="mb-6 text-[13px] text-muted">Bir paket seç, ilanın arama sonuçlarında öne çıksın.</p>
      <PackagePicker
        packages={(data ?? []).map((p) => ({
          id: p.id,
          days: p.duration_days,
          price: formatPrice(p.price, p.currency),
        }))}
      />
    </div>
  );
}
