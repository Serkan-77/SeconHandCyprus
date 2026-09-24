import Image from "next/image";
import type { ReactNode } from "react";
import { TextLink } from "@/components/ui/TextLink";

export function AuthLayout({
  title,
  children,
  backHref = "/",
  backLabel = "Keşfetmeye dön",
}: {
  title: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto my-6 grid max-w-[1180px] grid-cols-1 overflow-hidden rounded-2xl border-0 sm:my-12 sm:border sm:border-border lg:grid-cols-2">
      <aside className="relative hidden min-h-[740px] overflow-hidden bg-bg p-11 lg:block">
        <span className="relative z-10 text-[9px] font-semibold tracking-[1.8px] text-accent">
          ADANIN İKİNCİ EL BULUŞMASI
        </span>
        <h1 className="relative z-10 my-6 text-[47px] font-medium leading-[1.1] tracking-[-2px]">
          İyi eşyalara
          <br />
          yeni hikâyeler.
        </h1>
        <p className="relative z-10 text-sm text-muted">
          Birinin vedası,
          <br />
          senin en güzel keşfin olabilir.
        </p>
        <div className="absolute bottom-0 left-0 h-[56%] w-full">
          <Image
            src="/images/demo-chair.jpg"
            alt="Güneşli bir köşede krem berjer"
            fill
            className="object-cover"
          />
        </div>
        <div className="absolute bottom-6 left-7 right-7 rounded-lg bg-white/93 p-3 text-[11px] text-[#111318]">
          Yerel keşfet. Kolayca iletişim kur.
        </div>
      </aside>
      <section className="min-w-0 px-0 py-0 sm:px-6">
        <div className="flex justify-end">
          <TextLink href={backHref}>{backLabel}</TextLink>
        </div>
        <div className="px-1 py-4">
          <h2 className="mt-0 text-[31px] font-semibold">{title}</h2>
          <div className="mt-5">{children}</div>
        </div>
      </section>
    </div>
  );
}
