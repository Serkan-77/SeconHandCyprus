import { cn } from "@/lib/cn";

/** Read-only star rating. The number itself is shown next to it for screen readers and clarity. */
export function Stars({ value, className, size = "sm" }: { value: number; className?: string; size?: "sm" | "md" }) {
  const full = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-px text-sand", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = full >= i ? 1 : full >= i - 0.5 ? 0.5 : 0;
        return (
          <svg key={i} viewBox="0 0 24 24" className={size === "md" ? "h-5 w-5" : "h-3.5 w-3.5"}>
            <defs>
              <linearGradient id={`s${i}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"
              fill={`url(#s${i}-${fill})`}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </span>
  );
}
