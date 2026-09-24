import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default function AccountSuspendedPage() {
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="grid h-24 w-24 -rotate-6 items-center justify-center rounded-[28px] bg-brand-soft text-brand">
        <Icon name="shield" className="h-10 w-10 rotate-6" />
      </span>
      <h1 className="text-2xl font-semibold">Hesabın geçici olarak kısıtlandı.</h1>
      <p className="max-w-xs text-sm text-muted">
        Kullanım koşullarımıza aykırı bir işlem tespit edildiği için hesabın kısıtlandı. İlan
        verme, mesajlaşma ve favorileme geçici olarak devre dışı.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <LinkButton href="/destek">İtiraz et / destek al</LinkButton>
        <LinkButton href="/kosullar" variant="outline">
          Kullanım koşullarını gör
        </LinkButton>
      </div>
    </div>
  );
}
