import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { PackageToggle } from "./PackageToggle";

export const metadata = { title: "Yönetim · Paketler", robots: { index: false } };

export default async function AdminPackagesPage() {
  return (
    <AdminShell>
      <Packages />
    </AdminShell>
  );
}

async function Packages() {
  const supabase = await createClient();
  const { data: packages } = await supabase.from("packages").select("*").order("sort_order");

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Paket ve fiyatlandırma</h1>
        <p className="mt-1.5 text-xs text-muted">Öne çıkarma ve üyelik paketleri.</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
        <Icon name="info" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
        Bu paketler henüz kullanıcı tarafında satışa açık değil; ödeme sağlayıcısı bağlandığında etkin paketler öne
        çıkarma sayfasında listelenecek.
      </div>

      <div className="overflow-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="bg-bg text-[10px] text-muted">
              <th className="p-3 font-medium">Paket</th>
              <th className="p-3 font-medium">Süre</th>
              <th className="p-3 font-medium">Fiyat</th>
              <th className="p-3 font-medium">Etkin</th>
            </tr>
          </thead>
          <tbody>
            {(packages ?? []).map((pkg) => (
              <tr key={pkg.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{pkg.name}</td>
                <td className="p-3 text-muted">{pkg.duration_days ? `${pkg.duration_days} gün` : "—"}</td>
                <td className="p-3">{formatPrice(pkg.price, pkg.currency)}</td>
                <td className="p-3">
                  <PackageToggle id={pkg.id} active={pkg.active} name={pkg.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
