import type { Metadata } from "next";
import { ContactLine, LegalDocument, type LegalSection } from "@/components/LegalDocument";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Çerez politikası",
  description: `${SITE.name} hangi çerezleri kullanır, reklam çerezleri nasıl çalışır ve tercihlerini nasıl yönetirsin.`,
  alternates: { canonical: "/cerez-politikasi" },
};

const cookies: { name: string; purpose: string; duration: string; kind: string }[] = [
  { name: "sb-*-auth-token", purpose: "Oturumunu açık tutar (giriş yapmış olman).", duration: "Oturum boyunca, en fazla 1 yıl", kind: "Zorunlu" },
  { name: "kie-region", purpose: "Seçtiğin bölgeyi hatırlar (ör. Girne).", duration: "1 yıl", kind: "Tercih" },
  { name: "theme", purpose: "Açık / koyu görünüm tercihini hatırlar.", duration: "1 yıl", kind: "Tercih" },
  { name: "Google reklam çerezleri (ör. __gads, __gpi, IDE)", purpose: "Reklam göstermek, reklam performansını ölçmek ve izin verdiysen reklamları kişiselleştirmek.", duration: "Google tarafından belirlenir, genellikle 13 aya kadar", kind: "Reklam (üçüncü taraf)" },
];

const sections: LegalSection[] = [
  {
    id: "cerez-nedir",
    title: "Çerez nedir?",
    body: (
      <p>
        Çerezler, bir web sitesini ziyaret ettiğinde tarayıcına kaydedilen küçük metin dosyalarıdır. Oturumunu açık
        tutmak ve tercihlerini hatırlamak gibi işler için kullanılırlar.
      </p>
    ),
  },
  {
    id: "kullandigimiz",
    title: "Kullandığımız çerezler",
    body: (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="bg-bg text-[11px] text-muted">
              <th className="p-3 font-medium">Çerez</th>
              <th className="p-3 font-medium">Amaç</th>
              <th className="p-3 font-medium">Süre</th>
              <th className="p-3 font-medium">Tür</th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((c) => (
              <tr key={c.name} className="border-t border-border align-top">
                <td className="p-3 font-mono text-[11px] text-text">{c.name}</td>
                <td className="p-3">{c.purpose}</td>
                <td className="p-3">{c.duration}</td>
                <td className="p-3">{c.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "yerel-depolama",
    title: "Yerel depolama",
    body: (
      <p>
        İlan verme sırasında doldurduğun alanlar, sayfalar arasında kaybolmasın diye tarayıcının oturum depolamasında
        (sessionStorage) geçici olarak tutulur ve sekmeyi kapattığında silinir.
      </p>
    ),
  },
  {
    id: "reklam-cerezleri",
    title: "Reklam çerezleri ve onay",
    body: (
      <>
        <p>
          Reklamlar Google AdSense tarafından sunulur. Avrupa Ekonomik Alanı, Birleşik Krallık ve İsviçre&apos;den gelen
          ziyaretçilere, Google tarafından onaylanmış bir onay yönetim platformu aracılığıyla reklam çerezleri
          yerleştirilmeden önce izin sorulur. İzin vermezsen yalnızca kişiselleştirilmemiş (sınırlı) reklamlar
          gösterilir.
        </p>
        <p>
          Kişiselleştirilmiş reklamları istediğin zaman{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google Reklam Ayarları
          </a>{" "}
          sayfasından kapatabilirsin.
        </p>
      </>
    ),
  },
  {
    id: "yonetme",
    title: "Çerezleri nasıl yönetirsin?",
    body: (
      <p>
        Tarayıcının ayarlarından çerezleri silebilir veya engelleyebilirsin. Zorunlu çerezleri engellersen giriş
        yapamaz ve hesabınla ilgili özellikleri kullanamazsın.
      </p>
    ),
  },
  {
    id: "iletisim",
    title: "İletişim",
    body: (
      <p>
        Çerezlerle ilgili soruların için <ContactLine />
      </p>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Çerez politikası"
      current="/cerez-politikasi"
      sections={sections}
      intro={
        <p>
          Bu politika, <b>{SITE.name}</b> sitesinde hangi çerezlerin kullanıldığını ve bunları nasıl
          yönetebileceğini açıklar.
        </p>
      }
    />
  );
}
