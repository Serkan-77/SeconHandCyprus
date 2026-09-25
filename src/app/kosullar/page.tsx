import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalDocument, type LegalSection } from "@/components/LegalDocument";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kullanım koşulları",
  description: `${SITE.name} kullanım koşulları: ilan kuralları, yasaklı ürünler, kullanıcı sorumlulukları ve moderasyon.`,
  alternates: { canonical: "/kosullar" },
};

const sections: LegalSection[] = [
  {
    id: "kapsam",
    title: "Hizmetin kapsamı",
    body: (
      <>
        <p>
          {SITE.name}, Kıbrıs genelindeki kullanıcıların ikinci el eşyalarını ilan olarak yayınlamasını ve ilgilenen
          kişilerle doğrudan iletişim kurmasını sağlayan ücretsiz bir ilan platformudur.
        </p>
        <p>
          <b>Platform alım satımın tarafı değildir.</b> Ürünün teslimi, ödemesi ve durumu tamamen alıcı ile satıcı
          arasındadır. {SITE.name} ödeme almaz, aracılık etmez, ürün garantisi vermez ve kargo hizmeti sunmaz. Sitede
          gösterilen reklamlar üçüncü taraflarca (Google AdSense) sunulur.
        </p>
      </>
    ),
  },
  {
    id: "hesap",
    title: "Hesap açma ve güvenliği",
    body: (
      <ul>
        <li>Hesap açmak için 18 yaşını doldurmuş olmalı ve doğru bilgi vermelisin.</li>
        <li>Bir kişi yalnızca bir hesap kullanabilir; hesap devredilemez veya satılamaz.</li>
        <li>Şifrenin gizliliğinden sen sorumlusun. Hesabının izinsiz kullanıldığını fark edersen hemen bize bildir.</li>
        <li>
          Doğrulama rozeti yalnızca e-posta veya telefon numarasının doğrulandığını gösterir; kimlik, güvenilirlik ya da
          ürün garantisi anlamına gelmez.
        </li>
      </ul>
    ),
  },
  {
    id: "ilan-kurallari",
    title: "İlan kuralları",
    body: (
      <>
        <p>Her ilan yayına alınmadan önce moderasyon ekibi tarafından incelenir. İlanlarında:</p>
        <ul>
          <li>Satılan ürünün sana ait, gerçek ve satışa hazır olması,</li>
          <li>Fotoğrafların ürünün kendisine ait olması (katalog veya başka ilandan kopya olmaması),</li>
          <li>Başlık, fiyat, kategori ve ürün durumunun doğru girilmesi,</li>
          <li>Her ürün için tek ilan verilmesi, aynı ilanın tekrar tekrar yayınlanmaması,</li>
          <li>İlan metnine başka sitelerin bağlantıları, reklam veya iletişim dışı içerik eklenmemesi</li>
        </ul>
        <p>gerekir. Satılan ürünü “Satıldı” olarak işaretlemek satıcının sorumluluğundadır.</p>
      </>
    ),
  },
  {
    id: "yasakli-urunler",
    title: "Yasaklı ürünler ve içerikler",
    body: (
      <>
        <p>Aşağıdakilerin ilanı kesinlikle yasaktır ve bu tür ilanlar uyarı yapılmadan kaldırılır:</p>
        <ul>
          <li>Silah, mermi, patlayıcı ve bunların parçaları; av tüfeği dahil ruhsata tabi ürünler</li>
          <li>Uyuşturucu, reçeteli ilaç, tıbbi cihaz ve takviyeler, alkol ve tütün ürünleri</li>
          <li>Canlı hayvan ve nesli koruma altındaki türlerden yapılmış ürünler</li>
          <li>Sahte, taklit veya çalıntı ürünler; seri numarası silinmiş cihazlar</li>
          <li>Kimlik belgesi, plaka, resmi evrak, banka ve hat kartları</li>
          <li>Yetişkin içerik, nefret söylemi, şiddet veya ayrımcılık içeren her türlü içerik</li>
          <li>Hizmet, iş ilanı, emlak, kiralama ve dijital hesap/lisans satışları</li>
          <li>Kıbrıs&apos;ta yürürlükteki mevzuata aykırı diğer tüm ürünler</li>
        </ul>
      </>
    ),
  },
  {
    id: "iletisim-kurallari",
    title: "Mesajlaşma ve iletişim",
    body: (
      <ul>
        <li>Mesajlaşma yalnızca ilanla ilgili iletişim içindir; spam, taciz ve reklam yasaktır.</li>
        <li>Görmeden kapora veya ön ödeme istemek ya da göndermek güvenli değildir ve şikayet nedenidir.</li>
        <li>Rahatsız olduğun kullanıcıyı engelleyebilir ve konuşma menüsünden şikayet edebilirsin.</li>
        <li>
          Satıcı izin verdiyse WhatsApp üzerinden de iletişim kurulabilir; bu durumda iletişim platform dışında sürer ve
          {` ${SITE.name}`} bu yazışmaları göremez.
        </li>
      </ul>
    ),
  },
  {
    id: "guvenli-alisveris",
    title: "Güvenli alışveriş",
    body: (
      <p>
        Ürünü görmeden ödeme yapma, gündüz ve kalabalık bir yerde buluş, elektronik ürünleri çalışır halde kontrol et.
        Şüpheli bir durumda ilanı veya kullanıcıyı şikayet et. Ayrıntılı ipuçları için{" "}
        <Link href="/yardim#guvenlik">Yardım &amp; güvenlik</Link> sayfasına bakabilirsin.
      </p>
    ),
  },
  {
    id: "moderasyon",
    title: "Moderasyon ve yaptırımlar",
    body: (
      <>
        <p>
          Kurallara aykırı ilanlar reddedilir veya yayından kaldırılır; ret gerekçesi satıcıya bildirilir. Tekrarlayan
          veya ağır ihlallerde hesaba uyarı verilebilir, hesap geçici olarak kısıtlanabilir ya da askıya alınabilir.
        </p>
        <p>
          Kısıtlama süresince ilan verme, mesajlaşma ve favorileme kapalıdır. Karara itiraz etmek için{" "}
          <Link href="/destek">destek formunu</Link> kullanabilirsin.
        </p>
      </>
    ),
  },
  {
    id: "icerik-haklari",
    title: "İçerik hakları",
    body: (
      <p>
        İlanlarına eklediğin fotoğraf ve metinlerin hakları sende kalır. Bu içerikleri ilanın yayında olduğu süre
        boyunca platformda göstermemiz, arama motorlarında listelenmesini sağlamamız ve paylaşım önizlemelerinde
        kullanmamız için {SITE.name}&apos;e ücretsiz ve devredilemez bir kullanım izni vermiş olursun. İlanı sildiğinde bu
        izin sona erer.
      </p>
    ),
  },
  {
    id: "sorumluluk",
    title: "Sorumluluğun sınırlandırılması",
    body: (
      <p>
        {SITE.name} ilanların doğruluğunu, ürünlerin kalitesini, kullanıcıların kimliğini veya alım satımın
        gerçekleşmesini garanti etmez. Kullanıcılar arasındaki anlaşmazlıklardan, ürün kusurlarından ve platform
        dışında yapılan ödemelerden doğan zararlardan sorumlu tutulamaz. Hizmet “olduğu gibi” sunulur ve bakım
        nedeniyle geçici olarak kesintiye uğrayabilir.
      </p>
    ),
  },
  {
    id: "hesap-kapatma",
    title: "Hesabın kapatılması",
    body: (
      <p>
        Hesabını dilediğin zaman <Link href="/hesabim/ayarlar">Hesabım › Ayarlar</Link> bölümünden kalıcı olarak
        silebilirsin; ilanların, mesajların ve profil bilgilerin de silinir. Kuralları ağır biçimde ihlal eden hesaplar
        bizim tarafımızdan kapatılabilir.
      </p>
    ),
  },
  {
    id: "degisiklikler",
    title: "Koşullardaki değişiklikler",
    body: (
      <p>
        Bu koşulları zaman zaman güncelleyebiliriz. Önemli değişiklikleri site içi bildirimle duyururuz; güncellemeden
        sonra siteyi kullanmaya devam etmen yeni koşulları kabul ettiğin anlamına gelir.
      </p>
    ),
  },
  {
    id: "iletisim",
    title: "İletişim",
    body: (
      <p>
        Bu koşullarla ilgili soruların için <ContactLine />
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Kullanım koşulları"
      current="/kosullar"
      sections={sections}
      intro={
        <p>
          Bu koşullar, <b>{SITE.name}</b> web sitesini ve hizmetlerini kullanan herkes için geçerlidir. Siteye kayıt
          olarak veya siteyi kullanarak bu koşulları kabul etmiş olursun. Kişisel verilerinin nasıl işlendiğini{" "}
          <Link href="/gizlilik">Gizlilik bildirimi</Link>, çerezleri ise{" "}
          <Link href="/cerez-politikasi">Çerez politikası</Link> anlatır.
        </p>
      }
    />
  );
}
