
import * as I18n from "@/components/i18n/Localized";
import type { Metadata } from "next";
import { ContactLine, LegalDocument, type LegalSection } from "@/components/LegalDocument";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gizlilik bildirimi",
  description: `${SITE.name} hangi kişisel verileri, hangi amaçla işler; reklam ve çerez kullanımı ve haklarınız.`,
  alternates: { canonical: "/gizlilik" },
};

const sections: LegalSection[] = [
  {
    id: "toplanan-veriler",
    title: "Hangi verileri topluyoruz?",
    body: (
      <ul>
        <I18n.li>
          <I18n.b>Hesap bilgileri:</I18n.b> ad soyad (görünen ad), e-posta adresi, isteğe bağlı telefon numarası, bölge, profil
          fotoğrafı ve “Hakkımda” metni.
        </I18n.li>
        <I18n.li>
          <I18n.b>İlan içerikleri:</I18n.b> ilan başlığı, açıklaması, fiyatı, fotoğrafları, bölge ve semt bilgisi.
        </I18n.li>
        <I18n.li>
          <I18n.b>Mesajlar ve etkileşimler:</I18n.b> platform içi mesajlar, favoriler, değerlendirmeler, şikayetler ve engellemeler.
        </I18n.li>
        <I18n.li>
          <I18n.b>Teknik veriler:</I18n.b> oturum bilgisi, tarayıcı ve cihaz türü, IP adresi ve hata kayıtları.
        </I18n.li>
        <I18n.li>
          <I18n.b>Konum:</I18n.b> “Konumumu kullan” dediğinde tarayıcının verdiği konum yalnızca en yakın bölgeyi bulmak için cihazında
          kullanılır; koordinatlar sunucuya gönderilmez veya saklanmaz.
        </I18n.li>
      </ul>
    ),
  },
  {
    id: "amaclar",
    title: "Verileri hangi amaçla kullanıyoruz?",
    body: (
      <ul>
        <I18n.li>Hesabını oluşturmak, giriş yapmanı sağlamak ve hesabını korumak,</I18n.li>
        <I18n.li>İlanlarını yayınlamak, alıcı ve satıcıların mesajlaşmasını sağlamak,</I18n.li>
        <I18n.li>İlanları incelemek, şikayetleri değerlendirmek ve dolandırıcılığı önlemek,</I18n.li>
        <I18n.li>Mesaj, ilan durumu ve fiyat düşüşü gibi bildirimleri göndermek,</I18n.li>
        <I18n.li>Sitede reklam göstermek ve siteyi geliştirmek için toplu istatistikler çıkarmak,</I18n.li>
        <I18n.li>Yasal yükümlülüklerimizi yerine getirmek.</I18n.li>
      </ul>
    ),
  },
  {
    id: "hukuki-dayanak",
    title: "Hukuki dayanak",
    body: (
      <I18n.p>
        Verileri; hizmet sözleşmesinin kurulması ve ifası, meşru menfaatimiz (güvenlik, dolandırıcılığın önlenmesi,
        hizmetin geliştirilmesi), yasal yükümlülükler ve gerektiğinde açık rızan (ör. kişiselleştirilmiş reklam
        çerezleri) dayanaklarıyla işleriz. Kuzey Kıbrıs&apos;taki kullanıcılar için 89/2007 sayılı Kişisel Verileri
        Koruma Yasası, Avrupa Birliği&apos;ndeki kullanıcılar için Genel Veri Koruma Tüzüğü (GDPR) esas alınır.
      </I18n.p>
    ),
  },
  {
    id: "kimler-gorur",
    title: "Verilerini kimler görebilir?",
    body: (
      <>
        <ul>
          <I18n.li>
            <I18n.b>Diğer kullanıcılar:</I18n.b> görünen adın, profil fotoğrafın, bölgen, üyelik yılın, ilanların ve aldığın
            değerlendirmeler herkese açıktır. E-posta adresin ve telefon numaran ilanlarda gösterilmez.
          </I18n.li>
          <I18n.li>
            <I18n.b>WhatsApp iletişimi:</I18n.b> Ayarlar&apos;da açarsan telefon numaran yalnızca giriş yapmış ve ilanında
            WhatsApp&apos;a dokunan kullanıcılara gösterilir.
          </I18n.li>
          <I18n.li>
            <I18n.b>Moderasyon ekibi:</I18n.b> şikayetleri ve ilanları incelerken gerekli bilgilere erişir.
          </I18n.li>
          <I18n.li>
            <I18n.b>Hizmet sağlayıcılar:</I18n.b> veritabanı, kimlik doğrulama ve dosya depolama Supabase altyapısında; e-postalar
            e-posta gönderim hizmetleri aracılığıyla; reklamlar Google tarafından sunulur.
          </I18n.li>
        </ul>
        <I18n.p>Verilerini satmayız. Yasal bir talep olmadıkça üçüncü kişilerle paylaşmayız.</I18n.p>
      </>
    ),
  },
  {
    id: "reklamlar",
    title: "Reklamlar ve Google AdSense",
    body: (
      <>
        <I18n.p>
          Site, giderlerini karşılamak için Google AdSense reklamları gösterir. Google ve iş ortakları, bu sitedeki ve
          diğer sitelerdeki ziyaretlerine dayanarak reklam sunmak için çerezler kullanabilir. Google&apos;ın reklam
          çerezlerini kullanması, Google ve iş ortaklarının sana bu ve diğer sitelere yaptığın ziyaretlere göre reklam
          göstermesini sağlar.
        </I18n.p>
        <I18n.p>
          Kişiselleştirilmiş reklamları{" "}
          <I18n.a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google Reklam Ayarları
          </I18n.a>{" "}
          sayfasından kapatabilirsin. Google&apos;ın verileri nasıl kullandığını{" "}
          <I18n.a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            bu sayfada
          </I18n.a>{" "}
          okuyabilirsin. Avrupa Ekonomik Alanı ve Birleşik Krallık&apos;tan gelen ziyaretçilere, reklam çerezlerinden önce
          onay penceresi gösterilir. Ayrıntılar <I18n.Link href="/cerez-politikasi">Çerez politikasında</I18n.Link>.
        </I18n.p>
      </>
    ),
  },
  {
    id: "saklama",
    title: "Saklama süreleri",
    body: (
      <ul>
        <I18n.li>
          Hesap ve ilan verileri: hesabın açık olduğu sürece. Hesabını sildiğinde profilin, iletişim bilgilerin (e-posta,
          telefon), ilanların, favorilerin, bildirimlerin ve değerlendirmelerin kalıcı olarak silinir.
        </I18n.li>
        <I18n.li>Silinen ilanların ve hesabın fotoğrafları (profil fotoğrafı dahil) depolamadan da kaldırılır.</I18n.li>
        <I18n.li>
          Mesajlar: gönderdiğin mesajlar, hesabını silsen de karşı tarafın konuşma geçmişinde kalır; mesajlar artık
          hesabınla ilişkilendirilmez ve “Silinmiş kullanıcı” olarak görünür. Bu konuşmaya yeni mesaj gönderilemez.
        </I18n.li>
        <I18n.li>
          Şikayet ve yaptırım kayıtları: güvenlik amacıyla ilgili ilan veya hesap silinse de, şikayet anındaki ilan
          bilgileriyle birlikte makul bir süre saklanabilir. Hesabın kısıtlıyken hesap silme işlemi yapılamaz.
        </I18n.li>
        <I18n.li>
          Destek talepleri: talebin çözülmesinden sonra en fazla 2 yıl. Hesabını sildiğinde taleplerindeki e-posta
          adresin anonimleştirilir.
        </I18n.li>
      </ul>
    ),
  },
  {
    id: "haklarin",
    title: "Hakların",
    body: (
      <>
        <I18n.p>
          Verilerine erişme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme, verilerinin taşınmasını
          isteme ve verdiğin rızayı geri çekme hakkın vardır. Profil bilgilerini{" "}
          <I18n.Link href="/hesabim/duzenle">Profili düzenle</I18n.Link> sayfasından değiştirebilir, hesabını{" "}
          <I18n.Link href="/hesabim/ayarlar">Ayarlar</I18n.Link> bölümünden silebilirsin.
        </I18n.p>
        <I18n.p>Diğer talepler için <ContactLine /></I18n.p>
      </>
    ),
  },
  {
    id: "guvenlik",
    title: "Güvenlik",
    body: (
      <I18n.p>
        Bağlantılar şifrelidir (HTTPS); şifreler geri döndürülemez biçimde saklanır. Veritabanında her kullanıcı
        yalnızca kendi özel verilerine erişebilecek şekilde satır düzeyinde erişim kuralları uygulanır.
      </I18n.p>
    ),
  },
  {
    id: "cocuklar",
    title: "Çocukların gizliliği",
    body: <I18n.p>Hizmet 18 yaş altına yönelik değildir; bilerek 18 yaş altı kişilerden veri toplamayız.</I18n.p>,
  },
  {
    id: "degisiklikler",
    title: "Değişiklikler",
    body: (
      <I18n.p>
        Bu bildirimi güncelleyebiliriz. Önemli değişiklikleri site içi bildirimle duyururuz; sayfanın başındaki tarih
        son güncellemeyi gösterir.
      </I18n.p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Gizlilik bildirimi"
      current="/gizlilik"
      sections={sections}
      intro={
        <I18n.p>
          <I18n.b>{SITE.name}</I18n.b> olarak kişisel verilerini yalnızca hizmeti sunmak için gerekli olduğu kadar işliyoruz. Bu
          bildirim hangi verileri topladığımızı, neden kullandığımızı, kimlerle paylaştığımızı ve hangi haklara sahip
          olduğunu açıklar.
        </I18n.p>
      }
    />
  );
}
