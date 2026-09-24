import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

export function MapPreview({
  className,
  height = "h-[220px]",
  label = "Girne",
}: {
  className?: string;
  height?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-[#e5e9ef] text-[#344154] grayscale", height, className)}>
      <svg viewBox="0 0 350 220" className="h-full w-full" aria-hidden="true">
        <rect width="350" height="220" fill="#e8ebef" />
        <path d="M0 10L110 25 175 0 250 25 350 0V70L290 65 210 80 145 60 80 90 0 70Z" fill="#cbd3df" />
        <path
          d="M-20 180L100 125 220 160 370 110M100 125L80 65M220 160L240 60M-10 120L180 98 380 170"
          fill="none"
          stroke="#ffffff"
          strokeWidth={14}
        />
        <path
          d="M-20 180L100 125 220 160 370 110M100 125L80 65M220 160L240 60"
          fill="none"
          stroke="#bdc6d4"
          strokeWidth={2}
        />
        <text x="28" y="52" fontFamily="Inter,Arial" fontSize="11" fill="#63748d">
          Akdeniz
        </text>
        <text x="251" y="196" fontFamily="Inter,Arial" fontSize="13" fill="#5f6b7d">
          {label}
        </text>
      </svg>
      <span className="absolute left-4 top-3.5 rounded bg-white/88 px-2 py-1 text-[9px] tracking-wide text-[#606c7c]">
        ŞEMATİK KONUM ÖNİZLEMESİ
      </span>
      <span className="absolute left-[28%] top-[18%] h-[155px] w-[155px] rounded-full border border-[#11131855] bg-[#11131811]" />
      <span className="absolute left-[45%] top-[38%] text-accent">
        <Icon name="pin" className="h-9 w-9" fill="currentColor" stroke="white" />
      </span>
    </div>
  );
}
