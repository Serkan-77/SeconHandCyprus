import Link from "next/link";
import { cn } from "@/lib/cn";

/** Section title row: a strong title, an optional quiet count/subtitle, a link on the right. */
export function SectionHead({
  title,
  meta,
  href,
  linkLabel,
  className,
  id,
}: {
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4 sm:mb-5", className)}>
      <h2 id={id} className="flex min-w-0 items-baseline gap-3 text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[26px]">
        <span className="truncate">{title}</span>
        {meta ? <span className="flex-shrink-0 text-[14px] font-medium tracking-normal text-muted">{meta}</span> : null}
      </h2>
      {href && linkLabel ? (
        <Link href={href} className="flex-shrink-0 border-b-2 border-brand pb-0.5 text-[14px] font-semibold hover:border-accent hover:text-accent">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
