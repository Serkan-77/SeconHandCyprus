import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getCategories } from "@/lib/queries";

export const metadata = { title: "Tasarım sistemi", robots: { index: false } };

const swatches = [
  { name: "Surface", cls: "bg-surface border border-border" },
  { name: "Bg", cls: "bg-bg" },
  { name: "Brand", cls: "bg-brand" },
  { name: "Brand soft", cls: "bg-brand-soft" },
  { name: "Accent", cls: "bg-accent" },
  { name: "Accent soft", cls: "bg-accent-soft" },
];

export default async function SystemPage() {
  const categories = await getCategories();
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6">
      <h1 className="my-8 text-3xl font-bold tracking-tight sm:text-[40px]">
        Bileşenler & tasarım kuralları
      </h1>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">Renkler</h2>
        <div className="flex flex-wrap gap-3">
          {swatches.map((s) => (
            <div key={s.name} className="w-[120px] overflow-hidden rounded-xl border border-border">
              <div className={`h-[76px] ${s.cls}`} />
              <small className="block p-2.5 text-[10px]">{s.name}</small>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Siyah ve beyaz baskın; mavi bağlantı, odak, seçili durum ve küçük vurgular içindir.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">Tipografi</h2>
        <div className="flex flex-col gap-4">
          <p className="text-[40px] font-bold leading-tight">Display / 40</p>
          <p className="text-[28px] font-bold leading-tight">Başlık 1 / 28</p>
          <p className="text-[22px] font-semibold leading-tight">Başlık 2 / 22</p>
          <p className="text-lg font-semibold leading-tight">Başlık 3 / 18</p>
          <p className="text-base">Gövde metni / 16</p>
          <p className="text-sm text-muted">Küçük metin / 14</p>
          <p className="text-xs uppercase tracking-wide text-muted">Caption / 12</p>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Butonlar</h2>
          <div className="flex flex-col gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold">Rozetler</h2>
          <div className="flex flex-wrap gap-2">
            <Badge kind="accent" icon={<Icon name="check" className="h-3 w-3" />}>
              Doğrulandı
            </Badge>
            <Badge kind="neutral">Az kullanılmış</Badge>
            <Badge kind="danger">Kısıtlı</Badge>
          </div>
          <h2 className="mb-4 mt-8 text-lg font-semibold">Avatarlar</h2>
          <div className="flex items-center gap-3">
            <Avatar initials="SE" />
            <Avatar initials="DA" large />
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold">Form alanı</h2>
          <Field label="Örnek alan" placeholder="Değer gir" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Kategori ikonları</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {categories.map((c) => (
            <div key={c.slug} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
              <Icon name={c.icon} className="h-6 w-6" />
              <span className="text-[10px] text-muted">{c.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
