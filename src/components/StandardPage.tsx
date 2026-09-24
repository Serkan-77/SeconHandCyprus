import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { cn } from "@/lib/cn";

export function StandardPage({
  crumbs,
  title,
  sub,
  action,
  wide = false,
  children,
}: {
  crumbs: string[];
  title: string;
  sub?: string;
  action?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1328px] px-4 sm:px-6">
      <Breadcrumbs items={crumbs} />
      <section className={cn("mx-auto mb-14 mt-1", wide ? "max-w-[1060px]" : "max-w-[760px]")}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[32px]">{title}</h1>
            {sub ? <p className="mt-2 text-[13px] text-muted">{sub}</p> : null}
          </div>
          {action}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex flex-col gap-5 p-5 sm:p-7">{children}</div>
        </div>
      </section>
    </div>
  );
}
