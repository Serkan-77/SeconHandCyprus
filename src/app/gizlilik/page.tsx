import type { Metadata } from "next";
import Link from "next/link";
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
        <li>
          <b>Hesap bilgileri:</b> ad soyad (görünen ad), e-posta adresi, isteğe bağlı telefon numarası, bölge, profil
          fotoğrafı ve “Hakkımda” metni.
        </li>
        <li>
          <b>İlan içerikleri:</b> ilan başlığı, açıklaması, fiyatı, fotoğrafları, bölge ve semt bilgisi.
        </li>
        <li>
          <b>Mesajlar ve etkileşimler:</b> platform içi mesajlar, favoriler, değerlendirmeler, şikayetler ve engellemeler.
        </li>
        <li>
          <b>Teknik veriler:</b> oturum bilgisi, tarayıcı ve cihaz türü, IP adresi ve hata kayıtları.
        </li>
        <li>
          <b>Konum:</b> “Konumumu kullan” dediğinde tarayıcının verdiği konum yalnızca en yakın bölgeyi bulmak için cihazında
          kullanılır; koordinatlar sunucuya gönderilmez veya saklanmaz.
        </li>
      </ul>
    ),
  },
  {
    id: "amaclar",
    title: "Verileri hangi amaçla kullanıyoruz?",
    body: (
      <ul>
        <li>Hesabını oluşturmak, giriş yapmanı sağlamak ve hesabını korumak,</li>
        <li>İlanlarını yayınlamak, alıcı ve satıcıların mesajlaşmasını sağlamak,</li>
        <li>İlanları incelemek, şikayetleri değerlendirmek ve dolandırıcılığı önlemek,</li>
        <li>Mesaj, ilan durumu ve fiyat düşüşü gibi bildirimleri göndermek,</li>
        <li>Sitede reklam göstermek ve siteyi geliştirmek için toplu istatistikler çıkarmak,</li>
        <li>Yasal yükümlülüklerimizi yerine getirmek.</li>
      </ul>
    ),
  },
  {
    id: "hukuki-dayanak",
    title: "Hukuki dayanak",
    body: (
      <p>
        Verileri; hizmet sözleşmesinin kurulması ve ifası, meşru menfaatimiz (güvenlik, dolandırıcılığın önlenmesi,
        hizmetin geliştirilmesi), yasal yükümlülükler ve gerektiğinde açık rızan (ör. kişiselleştirilmiş reklam
        çerezleri) dayanaklarıyla işleriz. Kuzey Kıbrıs&apos;taki kullanıcılar için 89/2007 sayılı Kişisel Verileri
        Koruma Yasası, Avrupa Birliği&apos;ndeki kullanıcılar için Genel Veri Koruma Tüzüğü (GDPR) esas alınır.
      </p>
    ),
  },
  {
    id: "kimler-gorur",
    title: "Verilerini kimler görebilir?",
    body: (
      <>
        <ul>
          <li>
            <b>Diğer kullanıcılar:</b> görünen adın, profil fotoğrafın, bölgen, üyelik yılın, ilanların ve aldığın
            değerlendirmeler herkese açıktır. E-posta adresin ve telefon numaran ilanlarda gösterilmez.
          </li>
          <li>
            <b>WhatsApp iletişimi:</b> Ayarlar&apos;da açarsan telefon numaran yalnızca giriş yapmış ve ilanında
            WhatsApp&apos;a dokunan kullanıcılara gösterilir.
          </li>
          <li>
            <b>Moderasyon ekibi:</b> şikayetleri ve ilanları incelerken gerekli bilgilere erişir.
          </li>
          <li>
            <b>Hizmet sağlayıcılar:</b> veritabanı, kimlik doğrulama ve dosya depolama Supabase altyapısında; e-postalar
            e-posta gönderim hizmetleri aracılığıyla; reklamlar Google tarafından sunulur.
          </li>
        </ul>
        <p>Verilerini satmayız. Yasal bir talep olmadıkça üçüncü kişilerle paylaşmayız.</p>
      </>
    ),
  },
  {
    id: "reklamlar",
    title: "Reklamlar ve Google AdSense",
    body: (
      <>
        <p>
          Site, giderlerini karşılamak için Google AdSense reklamları gösterir. Google ve iş ortakları, bu sitedeki ve
          diğer sitelerdeki ziyaretlerine dayanarak reklam sunmak için çerezler kullanabilir. Google&apos;ın reklam
          çerezlerini kullanması, Google ve iş ortaklarının sana bu ve diğer sitelere yaptığın ziyaretlere göre reklam
          göstermesini sağlar.
        </p>
        <p>
          Kişiselleştirilmiş reklamları{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google Reklam Ayarları
          </a>{" "}
          sayfasından kapatabilirsin. Google&apos;ın verileri nasıl kullandığını{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            bu sayfada
          </a>{" "}
          okuyabilirsin. Avrupa Ekonomik Alanı ve Birleşik Krallık&apos;tan gelen ziyaretçilere, reklam çerezlerinden önce
          onay penceresi gösterilir. Ayrıntılar <Link href="/cerez-politikasi">Çerez politikasında</Link>.
        </p>
      </>
    ),
  },
  {
    id: "saklama",
    title: "Saklama süreleri",
    body: (
      <ul>
        <li>
          Hesap ve ilan verileri: hesabın açık olduğu sürece. Hesabını sildiğinde profilin, iletişim bilgilerin (e-posta,
          telefon), ilanların, favorilerin, bildirimlerin ve değerlendirmelerin kalıcı olarak silinir.
        </li>
        <li>Silinen ilanların ve hesabın fotoğrafları (profil fotoğrafı dahil) depolamadan da kaldırılır.</li>
        <li>
          Mesajlar: gönderdiğin mesajlar, hesabını silsen de karşı tarafın konuşma geçmişinde kalır; mesajlar artık
          hesabınla ilişkilendirilmez ve “Silinmiş kullanıcı” olarak görünür. Bu konuşmaya yeni mesaj gönderilemez.
        </li>
        <li>
          Şikayet ve yaptırım kayıtları: güvenlik amacıyla ilgili ilan veya hesap silinse de, şikayet anındaki ilan
          bilgileriyle birlikte makul bir süre saklanabilir. Hesabın kısıtlıyken hesap silme işlemi yapılamaz.
        </li>
        <li>
          Destek talepleri: talebin çözülmesinden sonra en fazla 2 yıl. Hesabını sildiğinde taleplerindeki e-posta
          adresin anonimleştirilir.
        </li>
      </ul>
    ),
  },
  {
    id: "haklarin",
    title: "Hakların",
    body: (
      <>
        <p>
          Verilerine erişme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme, verilerinin taşınmasını
          isteme ve verdiğin rızayı geri çekme hakkın vardır. Profil bilgilerini{" "}
          <Link href="/hesabim/duzenle">Profili düzenle</Link> sayfasından değiştirebilir, hesabını{" "}
          <Link href="/hesabim/ayarlar">Ayarlar</Link> bölümünden silebilirsin.
        </p>
        <p>Diğer talepler için <ContactLine /></p>
      </>
    ),
  },
  {
    id: "guvenlik",
    title: "Güvenlik",
    body: (
      <p>
        Bağlantılar şifrelidir (HTTPS); şifreler geri döndürülemez biçimde saklanır. Veritabanında her kullanıcı
        yalnızca kendi özel verilerine erişebilecek şekilde satır düzeyinde erişim kuralları uygulanır.
      </p>
    ),
  },
  {
    id: "cocuklar",
    title: "Çocukların gizliliği",
    body: <p>Hizmet 18 yaş altına yönelik değildir; bilerek 18 yaş altı kişilerden veri toplamayız.</p>,
  },
  {
    id: "degisiklikler",
    title: "Değişiklikler",
    body: (
      <p>
        Bu bildirimi güncelleyebiliriz. Önemli değişiklikleri site içi bildirimle duyururuz; sayfanın başındaki tarih
        son güncellemeyi gösterir.
      </p>
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
        <p>
          <b>{SITE.name}</b> olarak kişisel verilerini yalnızca hizmeti sunmak için gerekli olduğu kadar işliyoruz. Bu
          bildirim hangi verileri topladığımızı, neden kullandığımızı, kimlerle paylaştığımızı ve hangi haklara sahip
          olduğunu açıklar.
        </p>
      }
    />
  );
}
