
import * as I18n from "@/components/i18n/Localized";
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
  { name: "kie-locale", purpose: "Türkçe / İngilizce dil tercihini hatırlar.", duration: "1 yıl", kind: "Tercih" },
  { name: "Google reklam çerezleri (ör. __gads, __gpi, IDE)", purpose: "Reklam göstermek, reklam performansını ölçmek ve izin verdiysen reklamları kişiselleştirmek.", duration: "Google tarafından belirlenir, genellikle 13 aya kadar", kind: "Reklam (üçüncü taraf)" },
];

const sections: LegalSection[] = [
  {
    id: "cerez-nedir",
    title: "Çerez nedir?",
    body: (
      <I18n.p>
        Çerezler, bir web sitesini ziyaret ettiğinde tarayıcına kaydedilen küçük metin dosyalarıdır. Oturumunu açık
        tutmak ve tercihlerini hatırlamak gibi işler için kullanılırlar.
      </I18n.p>
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
              <I18n.th className="p-3 font-medium">Çerez</I18n.th>
              <I18n.th className="p-3 font-medium">Amaç</I18n.th>
              <I18n.th className="p-3 font-medium">Süre</I18n.th>
              <I18n.th className="p-3 font-medium">Tür</I18n.th>
            </tr>
          </thead>
          <I18n.tbody>
            {cookies.map((c) => (
              <tr key={c.name} className="border-t border-border align-top">
                <I18n.td className="p-3 font-mono text-[11px] text-text">{c.name}</I18n.td>
                <I18n.td className="p-3">{c.purpose}</I18n.td>
                <I18n.td className="p-3">{c.duration}</I18n.td>
                <I18n.td className="p-3">{c.kind}</I18n.td>
              </tr>
            ))}
          </I18n.tbody>
        </table>
      </div>
    ),
  },
  {
    id: "yerel-depolama",
    title: "Yerel depolama",
    body: (
      <I18n.p>
        İlan verme sırasında doldurduğun alanlar, sayfalar arasında kaybolmasın diye tarayıcının oturum depolamasında
        (sessionStorage) geçici olarak tutulur ve sekmeyi kapattığında silinir.
      </I18n.p>
    ),
  },
  {
    id: "reklam-cerezleri",
    title: "Reklam çerezleri ve onay",
    body: (
      <>
        <I18n.p>
          Reklamlar Google AdSense tarafından sunulur. Avrupa Ekonomik Alanı, Birleşik Krallık ve İsviçre&apos;den gelen
          ziyaretçilere, Google tarafından onaylanmış bir onay yönetim platformu aracılığıyla reklam çerezleri
          yerleştirilmeden önce izin sorulur. İzin vermezsen yalnızca kişiselleştirilmemiş (sınırlı) reklamlar
          gösterilir.
        </I18n.p>
        <I18n.p>
          Kişiselleştirilmiş reklamları istediğin zaman{" "}
          <I18n.a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google Reklam Ayarları
          </I18n.a>{" "}
          sayfasından kapatabilirsin.
        </I18n.p>
      </>
    ),
  },
  {
    id: "yonetme",
    title: "Çerezleri nasıl yönetirsin?",
    body: (
      <I18n.p>
        Tarayıcının ayarlarından çerezleri silebilir veya engelleyebilirsin. Zorunlu çerezleri engellersen giriş
        yapamaz ve hesabınla ilgili özellikleri kullanamazsın.
      </I18n.p>
    ),
  },
  {
    id: "iletisim",
    title: "İletişim",
    body: (
      <I18n.p>
        Çerezlerle ilgili soruların için <ContactLine />
      </I18n.p>
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
        <I18n.p>
          Bu politika, <I18n.b>{SITE.name}</I18n.b> sitesinde hangi çerezlerin kullanıldığını ve bunları nasıl
          yönetebileceğini açıklar.
        </I18n.p>
      }
    />
  );
}
