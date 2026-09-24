import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";

const sections = [
  { title: "1. Hizmetin kapsamı", body: "Kıbrıs İkinci El, kullanıcıların ikinci el eşyalarını ilan olarak yayınlayıp birbirleriyle doğrudan iletişim kurmasını sağlayan bir vitrin platformudur. Alım satım işlemi platform dışında, taraflar arasında gerçekleşir." },
  { title: "2. Kullanıcı yükümlülükleri", body: "Kullanıcılar verdikleri ilanların doğruluğundan ve yayınladıkları içerikten sorumludur. Yanıltıcı, sahte ya da yasa dışı içerik içeren ilanlar kaldırılabilir." },
  { title: "3. Sorumluluk sınırı", body: "Platform, kullanıcılar arasındaki alışverişlere taraf değildir ve doğabilecek anlaşmazlıklardan sorumlu tutulamaz." },
  { title: "4. Hesap askıya alma", body: "Kurallara aykırı davranış tespit edilmesi durumunda hesaplar uyarılabilir ya da askıya alınabilir." },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Kullanım koşulları"]} />
      <div className="mb-6 flex items-start gap-3 rounded-xl bg-brand-soft p-4 text-xs leading-relaxed">
        <Icon name="info" className="h-[18px] w-[18px] flex-shrink-0 text-accent" />
        Bu sayfa okunabilir bir belge şablonudur; onaylı, yayına hazır hukuki metin içermez. Nihai
        metin hukuk ekibi tarafından tamamlanmalıdır.
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-[32px]">Kullanım koşulları</h1>
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
