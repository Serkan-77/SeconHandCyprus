
import * as I18n from "@/components/i18n/Localized";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="flex h-24 w-24 -rotate-6 items-center justify-center rounded-[28px] bg-brand-soft text-brand">
        <Icon name="search" className="h-10 w-10 rotate-6" />
      </span>
      <I18n.h1 className="text-2xl font-semibold">Bu sayfayı bulamadık.</I18n.h1>
      <I18n.p className="max-w-xs text-sm text-muted">
        Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.
      </I18n.p>
      <LinkButton href="/" full={false} className="min-w-[200px]">
        Ana sayfaya dön
      </LinkButton>
    </div>
  );
}
