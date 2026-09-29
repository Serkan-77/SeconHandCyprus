
import * as I18n from "@/components/i18n/Localized";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default async function AuthRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const next = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="grid h-24 w-24 -rotate-6 items-center justify-center rounded-[28px] bg-brand-soft text-brand">
        <Icon name="lock" className="h-10 w-10 rotate-6" />
      </span>
      <I18n.h1 className="text-2xl font-semibold">Devam etmek için giriş yap.</I18n.h1>
      <I18n.p className="max-w-xs text-sm text-muted">
        Bu işlem için bir hesabın olması gerekiyor. Giriş yaptıktan sonra kaldığın yerden devam
        edersin.
      </I18n.p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <LinkButton href={`/giris${next}`}>Giriş yap</LinkButton>
        <LinkButton href={`/kayit${next}`} variant="outline">
          Hesap oluştur
        </LinkButton>
      </div>
    </div>
  );
}
