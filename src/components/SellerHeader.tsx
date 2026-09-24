import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials, memberSince, ratingLabel } from "@/lib/format";
import type { SellerSummary } from "@/lib/queries";

export function SellerHeader({ seller, active }: { seller: SellerSummary; active: "profil" | "yorumlar" }) {
  return (
    <div className="mb-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={initials(seller.displayName)} src={seller.avatarUrl} large />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {seller.displayName}
            {seller.phoneVerified ? (
              <Badge kind="accent" icon={<Icon name="check" className="h-3 w-3" />}>
                Doğrulandı
              </Badge>
            ) : null}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {[ratingLabel(seller.ratingAvg, seller.ratingCount), seller.region, memberSince(seller.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {seller.bio ? <p className="mt-3 max-w-xl text-[13px] leading-relaxed">{seller.bio}</p> : null}
        </div>
        <div className="flex gap-5 text-center text-xs">
          <div>
            <strong className="block text-lg">{seller.activeListings}</strong>
            <span className="text-muted">Aktif ilan</span>
          </div>
          <div>
            <strong className="block text-lg">{seller.soldListings}</strong>
            <span className="text-muted">Satılan</span>
          </div>
        </div>
      </div>
      <div className="flex gap-0 border-b border-border">
        <Link
          href={`/satici/${seller.id}`}
          className={cn(
            "border-b-2 px-1 py-3 text-xs",
            active === "profil" ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
          )}
        >
          Profil ve ilanlar
        </Link>
        <Link
          href={`/satici/${seller.id}/yorumlar`}
          className={cn(
            "ml-6 border-b-2 px-1 py-3 text-xs",
            active === "yorumlar" ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
          )}
        >
          Değerlendirmeler ({seller.ratingCount})
        </Link>
      </div>
    </div>
  );
}
