
import * as I18n from "@/components/i18n/Localized";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default function ManageListingNotFound() {
  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name="bag" className="h-7 w-7" />
      </span>
      <I18n.h1 className="text-xl font-semibold">Bu ilan bulunamadı.</I18n.h1>
      <LinkButton href="/hesabim/ilanlar" full={false} className="min-w-[200px]">
        İlanlarıma dön
      </LinkButton>
    </div>
  );
}
