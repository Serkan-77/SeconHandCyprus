
import * as I18n from "@/components/i18n/Localized";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/icons";
import { initials } from "@/lib/format";
import type { SellerSummary } from "@/lib/queries";

export function SellerCard({ seller }: { seller: SellerSummary }) {
  const isStore = seller.accountType === "store" && Boolean(seller.storeName);
  return (
    <I18n.Link href={`/satici/${seller.id}`} className="flex w-full items-center gap-3 text-left">
      <Avatar initials={initials(seller.displayName)} src={seller.avatarUrl} />
      <span className="min-w-0 flex-1">
        <I18n.span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
          <I18n.Raw>{isStore ? seller.storeName : seller.displayName}</I18n.Raw>
          {isStore ? (
            <I18n.span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-accent">
              {seller.storeVerified ? "Onaylı mağaza" : "Mağaza"}
            </I18n.span>
          ) : null}
        </I18n.span>
        <I18n.span className="mt-1 block text-[11px] text-muted">
          <I18n.Formatted kind="ratingLabel" args={[seller.ratingAvg, seller.ratingCount]} /> · <I18n.Formatted kind="memberSince" args={[seller.createdAt]} />
        </I18n.span>
      </span>
      <Icon name="chevron" className="h-4 w-4 flex-shrink-0 text-muted" />
    </I18n.Link>
  );
}
