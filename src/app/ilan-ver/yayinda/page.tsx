
import * as I18n from "@/components/i18n/Localized";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export const metadata = { title: "İlan incelemeye gönderildi" };

export default async function ListingSubmittedPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-20 text-center">
      <span className="grid h-[85px] w-[85px] place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name="check" className="h-9 w-9" />
      </span>
      <I18n.h1 className="text-2xl font-semibold">İlanın incelemeye gönderildi.</I18n.h1>
      <I18n.p className="max-w-xs text-sm text-muted">
        İlanın onaylandığında yayına alınacak ve sana bildirim göndereceğiz. Bu genellikle birkaç saat içinde tamamlanır.
      </I18n.p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <LinkButton href={id ? `/hesabim/ilanlar/${id}` : "/hesabim/ilanlar?sekme=inceleme"}>İlanımı gör</LinkButton>
        <LinkButton href="/ilan-ver/fotograflar" variant="outline">
          Bir ilan daha ver
        </LinkButton>
      </div>
    </div>
  );
}
