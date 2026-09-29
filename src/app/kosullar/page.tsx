
import * as I18n from "@/components/i18n/Localized";
import type { Metadata } from "next";
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
        <I18n.p>
          {SITE.name}, Kıbrıs genelindeki kullanıcıların ikinci el eşyalarını ilan olarak yayınlamasını ve ilgilenen
          kişilerle doğrudan iletişim kurmasını sağlayan ücretsiz bir ilan platformudur.
        </I18n.p>
        <I18n.p>
          <I18n.b>Platform alım satımın tarafı değildir.</I18n.b> Ürünün teslimi, ödemesi ve durumu tamamen alıcı ile satıcı
          arasındadır. {SITE.name} ödeme almaz, aracılık etmez, ürün garantisi vermez ve kargo hizmeti sunmaz. Sitede
          gösterilen reklamlar üçüncü taraflarca (Google AdSense) sunulur.
        </I18n.p>
      </>
    ),
  },
  {
    id: "hesap",
    title: "Hesap açma ve güvenliği",
    body: (
      <ul>
        <I18n.li>Hesap açmak için 18 yaşını doldurmuş olmalı ve doğru bilgi vermelisin.</I18n.li>
        <I18n.li>Bir kişi yalnızca bir hesap kullanabilir; hesap devredilemez veya satılamaz.</I18n.li>
        <I18n.li>Şifrenin gizliliğinden sen sorumlusun. Hesabının izinsiz kullanıldığını fark edersen hemen bize bildir.</I18n.li>
        <I18n.li>
          Doğrulama rozeti yalnızca e-posta veya telefon numarasının doğrulandığını gösterir; kimlik, güvenilirlik ya da
          ürün garantisi anlamına gelmez.
        </I18n.li>
      </ul>
    ),
  },
  {
    id: "ilan-kurallari",
    title: "İlan kuralları",
    body: (
      <>
        <I18n.p>Her ilan yayına alınmadan önce moderasyon ekibi tarafından incelenir. İlanlarında:</I18n.p>
        <ul>
          <I18n.li>Satılan ürünün sana ait, gerçek ve satışa hazır olması,</I18n.li>
          <I18n.li>Fotoğrafların ürünün kendisine ait olması (katalog veya başka ilandan kopya olmaması),</I18n.li>
          <I18n.li>Başlık, fiyat, kategori ve ürün durumunun doğru girilmesi,</I18n.li>
          <I18n.li>Her ürün için tek ilan verilmesi, aynı ilanın tekrar tekrar yayınlanmaması,</I18n.li>
          <I18n.li>İlan metnine başka sitelerin bağlantıları, reklam veya iletişim dışı içerik eklenmemesi</I18n.li>
        </ul>
        <I18n.p>gerekir. Satılan ürünü “Satıldı” olarak işaretlemek satıcının sorumluluğundadır.</I18n.p>
      </>
    ),
  },
  {
    id: "yasakli-urunler",
    title: "Yasaklı ürünler ve içerikler",
    body: (
      <>
        <I18n.p>Aşağıdakilerin ilanı kesinlikle yasaktır ve bu tür ilanlar uyarı yapılmadan kaldırılır:</I18n.p>
        <ul>
          <I18n.li>Silah, mermi, patlayıcı ve bunların parçaları; av tüfeği dahil ruhsata tabi ürünler</I18n.li>
          <I18n.li>Uyuşturucu, reçeteli ilaç, tıbbi cihaz ve takviyeler, alkol ve tütün ürünleri</I18n.li>
          <I18n.li>Canlı hayvan ve nesli koruma altındaki türlerden yapılmış ürünler</I18n.li>
          <I18n.li>Sahte, taklit veya çalıntı ürünler; seri numarası silinmiş cihazlar</I18n.li>
          <I18n.li>Kimlik belgesi, plaka, resmi evrak, banka ve hat kartları</I18n.li>
          <I18n.li>Yetişkin içerik, nefret söylemi, şiddet veya ayrımcılık içeren her türlü içerik</I18n.li>
          <I18n.li>Hizmet, iş ilanı, emlak, kiralama ve dijital hesap/lisans satışları</I18n.li>
          <I18n.li>Kıbrıs&apos;ta yürürlükteki mevzuata aykırı diğer tüm ürünler</I18n.li>
        </ul>
      </>
    ),
  },
  {
    id: "iletisim-kurallari",
    title: "Mesajlaşma ve iletişim",
    body: (
      <ul>
        <I18n.li>Mesajlaşma yalnızca ilanla ilgili iletişim içindir; spam, taciz ve reklam yasaktır.</I18n.li>
        <I18n.li>Görmeden kapora veya ön ödeme istemek ya da göndermek güvenli değildir ve şikayet nedenidir.</I18n.li>
        <I18n.li>Rahatsız olduğun kullanıcıyı engelleyebilir ve konuşma menüsünden şikayet edebilirsin.</I18n.li>
        <I18n.li>
          Satıcı izin verdiyse WhatsApp üzerinden de iletişim kurulabilir; bu durumda iletişim platform dışında sürer ve
          {` ${SITE.name}`} bu yazışmaları göremez.
        </I18n.li>
      </ul>
    ),
  },
  {
    id: "guvenli-alisveris",
    title: "Güvenli alışveriş",
    body: (
      <I18n.p>
        Ürünü görmeden ödeme yapma, gündüz ve kalabalık bir yerde buluş, elektronik ürünleri çalışır halde kontrol et.
        Şüpheli bir durumda ilanı veya kullanıcıyı şikayet et. Ayrıntılı ipuçları için{" "}
        <I18n.Link href="/yardim#guvenlik">Yardım &amp; güvenlik</I18n.Link> sayfasına bakabilirsin.
      </I18n.p>
    ),
  },
  {
    id: "moderasyon",
    title: "Moderasyon ve yaptırımlar",
    body: (
      <>
        <I18n.p>
          Kurallara aykırı ilanlar reddedilir veya yayından kaldırılır; ret gerekçesi satıcıya bildirilir. Tekrarlayan
          veya ağır ihlallerde hesaba uyarı verilebilir, hesap geçici olarak kısıtlanabilir ya da askıya alınabilir.
        </I18n.p>
        <I18n.p>
          Kısıtlama süresince ilan verme, mesajlaşma ve favorileme kapalıdır. Karara itiraz etmek için{" "}
          <I18n.Link href="/destek">destek formunu</I18n.Link> kullanabilirsin.
        </I18n.p>
      </>
    ),
  },
  {
    id: "icerik-haklari",
    title: "İçerik hakları",
    body: (
      <I18n.p>
        İlanlarına eklediğin fotoğraf ve metinlerin hakları sende kalır. Bu içerikleri ilanın yayında olduğu süre
        boyunca platformda göstermemiz, arama motorlarında listelenmesini sağlamamız ve paylaşım önizlemelerinde
        kullanmamız için {SITE.name}&apos;e ücretsiz ve devredilemez bir kullanım izni vermiş olursun. İlanı sildiğinde bu
        izin sona erer.
      </I18n.p>
    ),
  },
  {
    id: "sorumluluk",
    title: "Sorumluluğun sınırlandırılması",
    body: (
      <I18n.p>
        {SITE.name} ilanların doğruluğunu, ürünlerin kalitesini, kullanıcıların kimliğini veya alım satımın
        gerçekleşmesini garanti etmez. Kullanıcılar arasındaki anlaşmazlıklardan, ürün kusurlarından ve platform
        dışında yapılan ödemelerden doğan zararlardan sorumlu tutulamaz. Hizmet “olduğu gibi” sunulur ve bakım
        nedeniyle geçici olarak kesintiye uğrayabilir.
      </I18n.p>
    ),
  },
  {
    id: "hesap-kapatma",
    title: "Hesabın kapatılması",
    body: (
      <I18n.p>
        Hesabını dilediğin zaman <I18n.Link href="/hesabim/ayarlar">Hesabım › Ayarlar</I18n.Link> bölümünden kalıcı olarak
        silebilirsin; profil bilgilerin, ilanların ve fotoğrafların da silinir. Gönderdiğin mesajlar karşı tarafın konuşma
        geçmişinde hesabınla ilişkisi kaldırılmış olarak kalır. Hesabın kısıtlıyken silme işlemi yapılamaz; bu durumda
        destek talebi oluşturabilirsin. Kuralları ağır biçimde ihlal eden hesaplar
        bizim tarafımızdan kapatılabilir.
      </I18n.p>
    ),
  },
  {
    id: "degisiklikler",
    title: "Koşullardaki değişiklikler",
    body: (
      <I18n.p>
        Bu koşulları zaman zaman güncelleyebiliriz. Önemli değişiklikleri site içi bildirimle duyururuz; güncellemeden
        sonra siteyi kullanmaya devam etmen yeni koşulları kabul ettiğin anlamına gelir.
      </I18n.p>
    ),
  },
  {
    id: "iletisim",
    title: "İletişim",
    body: (
      <I18n.p>
        Bu koşullarla ilgili soruların için <ContactLine />
      </I18n.p>
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
        <I18n.p>
          Bu koşullar, <I18n.b>{SITE.name}</I18n.b> web sitesini ve hizmetlerini kullanan herkes için geçerlidir. Siteye kayıt
          olarak veya siteyi kullanarak bu koşulları kabul etmiş olursun. Kişisel verilerinin nasıl işlendiğini{" "}
          <I18n.Link href="/gizlilik">Gizlilik bildirimi</I18n.Link>, çerezleri ise{" "}
          <I18n.Link href="/cerez-politikasi">Çerez politikası</I18n.Link> anlatır.
        </I18n.p>
      }
    />
  );
}
