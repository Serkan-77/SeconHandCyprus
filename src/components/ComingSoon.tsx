import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-20 text-center">
      <span className="grid h-[85px] w-[85px] place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name="spark" className="h-9 w-9" />
      </span>
      <span className="rounded-md bg-brand-soft px-2.5 py-1 text-[9px] font-bold tracking-wider text-brand">
        ÇOK YAKINDA
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-xs text-sm text-muted">{desc}</p>
      <LinkButton href="/" full={false} variant="outline" className="min-w-[200px]">
        Ana sayfaya dön
      </LinkButton>
    </div>
  );
}
