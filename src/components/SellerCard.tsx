import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { initials, memberSince, ratingLabel } from "@/lib/format";
import type { SellerSummary } from "@/lib/queries";

export function SellerCard({ seller }: { seller: SellerSummary }) {
  return (
    <Link href={`/satici/${seller.id}`} className="flex w-full items-center gap-3 text-left">
      <Avatar initials={initials(seller.displayName)} src={seller.avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
          {seller.displayName}
          {seller.phoneVerified ? (
            <Badge kind="accent" icon={<Icon name="check" className="h-3 w-3" />}>
              Doğrulandı
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block text-[11px] text-muted">
          {ratingLabel(seller.ratingAvg, seller.ratingCount)} · {memberSince(seller.createdAt)}
        </span>
      </span>
      <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-muted" />
    </Link>
  );
}
