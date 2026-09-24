import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default function ListingNotFound() {
  return (
    <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="flex h-24 w-24 -rotate-6 items-center justify-center rounded-[28px] bg-brand-soft text-brand">
        <Icon name="flag" className="h-10 w-10 rotate-6" />
      </span>
      <h1 className="text-2xl font-semibold">Bu ilan artık yayında değil.</h1>
      <p className="max-w-xs text-sm text-muted">
        Ürün satılmış ya da satıcı ilanı kaldırmış olabilir. Benzer ilanlara göz atabilirsin.
      </p>
      <LinkButton href="/ilanlar" full={false} className="min-w-[200px]">
        İlanlara dön
      </LinkButton>
    </div>
  );
}
