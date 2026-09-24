import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";

const sections = [
  { title: "1. Toplanan veriler", body: "Ad, iletişim bilgileri, konum tercihi ve ilan/mesaj içerikleri gibi hizmeti sağlamak için gerekli veriler toplanır." },
  { title: "2. Verilerin kullanımı", body: "Veriler yalnızca hesabının işletilmesi, güvenliğin sağlanması ve iletişiminin kolaylaştırılması amacıyla kullanılır." },
  { title: "3. Paylaşım", body: "Kişisel veriler, yasal zorunluluklar dışında üçüncü taraflarla paylaşılmaz." },
  { title: "4. Haklarınız", body: "Verilerine erişme, düzeltme ve silinmesini talep etme hakkına sahipsin." },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Gizlilik bildirimi"]} />
      <div className="mb-6 flex items-start gap-3 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
        <Icon name="info" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
        Bu sayfa okunabilir bir belge şablonudur; onaylı, yayına hazır hukuki metin içermez.
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-[32px]">Gizlilik bildirimi</h1>
      <div className="flex flex-col gap-6">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 text-base font-semibold">{s.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
