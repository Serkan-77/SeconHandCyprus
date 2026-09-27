import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { getViewer } from "@/lib/queries";
import { StoreForm } from "./StoreForm";

export const metadata = { title: "Mağaza hesabı" };

export default async function StoreSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/magaza");
  const p = viewer.profile;
  const isStore = p.accountType === "store";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight sm:text-[30px]">
          Mağaza hesabı
          {isStore ? <Badge kind="accent">{p.storeVerified ? "Onaylı mağaza" : "Onay bekliyor"}</Badge> : null}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted">
          İşletmen ya da mağazan varsa ürünlerini mağaza adıyla paylaş. Mağazalar, sitedeki{" "}
          <Link href="/magazalar" className="font-medium text-accent">
            Mağazalar
          </Link>{" "}
          bölümünde ayrıca listelenir; ilanların normal ilanlar gibi incelemeden geçer.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: "store" as const, title: "Ayrı vitrin", text: "Mağaza sayfanda tüm ürünlerin, adresin ve çalışma saatlerin görünür." },
          { icon: "shield" as const, title: "Onaylı mağaza rozeti", text: "Ekibimiz işletmeni doğruladığında rozetin eklenir." },
          { icon: "bag" as const, title: "Daha fazla ilan", text: "Onaylı mağazalar aynı anda 500'e kadar ilan yayınlayabilir." },
        ].map((b) => (
          <div key={b.title} className="rounded-xl bg-bg p-4">
            <Icon name={b.icon} className="h-5 w-5" />
            <b className="mt-2 block text-[13px]">{b.title}</b>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{b.text}</p>
          </div>
        ))}
      </div>

      {isStore && !p.storeVerified ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
          <Icon name="info" className="h-4 w-4 flex-shrink-0 text-accent" />
          Onaylı mağaza rozeti için{" "}
          <Link href="/destek" className="font-medium text-accent">
            destek sayfasından
          </Link>{" "}
          işletme bilgilerini (vergi levhası ya da işletme belgesi) ilet. Mağaza adını değiştirirsen rozet yeniden onaya düşer.
        </div>
      ) : null}

      <StoreForm
        userId={viewer.user.id}
        isStore={isStore}
        initial={{
          storeName: p.storeName ?? "",
          address: p.storeAddress ?? "",
          phone: p.storePhone ?? "",
          website: p.storeWebsite ?? "",
          hours: p.storeHours ?? "",
        }}
      />
    </div>
  );
}
