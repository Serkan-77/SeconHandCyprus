import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormError, Notice } from "@/components/ui/FormError";
import { Stars } from "@/components/ui/Stars";
import { getTaxonomy } from "@/lib/api/server";
import { buildTree } from "@/lib/taxonomy";

// A living reference of the design system: tokens and components as they
// render in the current theme. Not indexed.
export const metadata: Metadata = { title: "Tasarım sistemi", robots: { index: false } };

const COLORS = [
  ["bg", "Sayfa zemini"],
  ["surface", "Yüzey"],
  ["brand-soft", "Nötr yumuşak"],
  ["brand", "Mürekkep (ana eylem)"],
  ["accent", "Akdeniz mavisi (bağlantı, seçili)"],
  ["accent-soft", "Mavi yumuşak"],
  ["sand", "Kum (Vitrin)"],
  ["success", "Başarı"],
  ["warning", "Uyarı"],
  ["danger", "Hata"],
];

export default async function DesignSystem() {
  const taxonomy = await getTaxonomy();
  const icons = [...new Set(buildTree(taxonomy.categories).flatMap((c) => [c.icon, ...c.children.map((s) => s.icon)]))] as IconName[];
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-12 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tasarım sistemi</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Mürekkep ve kâğıt nötrleri markayı taşır; tek bir Akdeniz mavisi eylemleri ve bağlantıları, kum tonu yalnızca Vitrin&apos;i işaretler. Durum renkleri
          (başarı, uyarı, hata) yalnızca durum bildirmek için kullanılır.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Renkler</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COLORS.map(([token, label]) => (
            <div key={token} className="overflow-hidden rounded-card border border-border">
              <div className="h-16" style={{ background: `var(--${token})` }} />
              <p className="px-3 py-2 text-[12px]">
                <code>{token}</code>
                <span className="block text-muted">{label}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tipografi</h2>
        <div className="space-y-2">
          <p className="text-[38px] font-bold leading-tight tracking-tight">Başlık 38 / bold</p>
          <p className="text-[28px] font-bold tracking-tight">Sayfa başlığı 28</p>
          <p className="text-[20px] font-bold">Bölüm başlığı 20</p>
          <p className="text-[15px]">Gövde metni 15 — okunaklı satır aralığı ve yeterli kontrast.</p>
          <p className="text-[13px] text-muted">İkincil metin 13 — tarih, konum, yardımcı açıklamalar.</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Etiket 11 — en küçük boyut</p>
          <p className="text-[24px] font-bold tabular">18.500 TL · 1.250 €</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Düğmeler</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Birincil</Button>
          <Button variant="accent">Vurgu</Button>
          <Button variant="secondary">İkincil</Button>
          <Button variant="outline">Çerçeveli</Button>
          <Button variant="ghost">Sade</Button>
          <Button variant="danger">Tehlikeli</Button>
          <Button loading>Yükleniyor</Button>
          <Button size="sm" icon={<Icon name="plus" className="h-4 w-4" />}>
            Küçük
          </Button>
          <Button size="lg">Büyük</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Rozetler, yıldızlar, avatarlar</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Nötr</Badge>
          <Badge kind="accent">Pazarlığa açık</Badge>
          <Badge kind="sand" icon={<Icon name="spark" className="h-3 w-3" />}>
            Vitrin
          </Badge>
          <Badge kind="success">Yayında</Badge>
          <Badge kind="warning">İncelemede</Badge>
          <Badge kind="danger">Reddedildi</Badge>
          <Badge kind="outline">Taslak</Badge>
          <Stars value={4.5} size="md" />
          <Avatar name="Deniz Kaya" size="md" />
          <Avatar name="Girne Ev" size="lg" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Notice>Bilgi notu: ne olacağını önceden söyler.</Notice>
        <Notice tone="success" icon="check">
          Başarı: işlem tamamlandı.
        </Notice>
        <Notice tone="warning">Uyarı: dikkat gerektiren bir durum.</Notice>
        <FormError>Hata: ne ters gittiğini ve nasıl düzeltileceğini söyler.</FormError>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Boş durum</h2>
        <EmptyState icon="heart" title="Henüz favorin yok" action={<Button>İlanlara göz at</Button>}>
          Beğendiğin ilanlardaki kalbe dokun; hepsi burada toplanır.
        </EmptyState>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Kategori simgeleri</h2>
        <div className="flex flex-wrap gap-2">
          {icons.map((name) => (
            <span key={name} className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-card border border-border text-[10px] text-muted">
              <Icon name={name} className="h-5 w-5 text-text" />
              {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
