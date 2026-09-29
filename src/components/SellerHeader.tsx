
import * as I18n from "@/components/i18n/Localized";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { SellerSummary } from "@/lib/queries";

export function SellerHeader({ seller, active }: { seller: SellerSummary; active: "profil" | "yorumlar" }) {
  const isStore = seller.accountType === "store" && Boolean(seller.storeName);
  return (
    <div className="mb-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={initials(seller.displayName)} src={seller.avatarUrl} large />
        <I18n.div className="min-w-0 flex-1">
          <I18n.h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <I18n.Raw>{isStore ? seller.storeName : seller.displayName}</I18n.Raw>
            {isStore ? (
              <Badge kind="accent" icon={<Icon name={seller.storeVerified ? "shield" : "store"} className="h-3 w-3" />}>
                {seller.storeVerified ? "Onaylı mağaza" : "Mağaza"}
              </Badge>
            ) : null}
          </I18n.h1>
          <I18n.p className="mt-1.5 text-[13px] text-muted">
            <I18n.Formatted kind="ratingLabel" args={[seller.ratingAvg, seller.ratingCount]} />
            {seller.region ? <> · <I18n.Raw>{seller.region}</I18n.Raw></> : null}
            {" · "}<I18n.Formatted kind="memberSince" args={[seller.createdAt]} />
          </I18n.p>
          {seller.bio ? <I18n.p className="mt-3 max-w-xl text-[13px] leading-relaxed"><I18n.Raw>{seller.bio}</I18n.Raw></I18n.p> : null}
          {isStore ? (
            <I18n.ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
              {seller.storeAddress ? (
                <I18n.li className="flex items-center gap-1.5">
                  <Icon name="pin" className="h-3.5 w-3.5 text-accent" />
                  <I18n.Raw>{seller.storeAddress}</I18n.Raw>
                </I18n.li>
              ) : null}
              {seller.storeHours ? (
                <I18n.li className="flex items-center gap-1.5">
                  <Icon name="clock" className="h-3.5 w-3.5 text-accent" />
                  <I18n.Raw>{seller.storeHours}</I18n.Raw>
                </I18n.li>
              ) : null}
              {seller.storePhone ? (
                <li>
                  <I18n.a href={`tel:${seller.storePhone}`} className="flex items-center gap-1.5 text-accent">
                    <Icon name="phone" className="h-3.5 w-3.5" />
                    {seller.storePhone}
                  </I18n.a>
                </li>
              ) : null}
              {seller.storeWebsite ? (
                <li>
                  <I18n.a
                    href={seller.storeWebsite}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1.5 text-accent"
                  >
                    <Icon name="globe" className="h-3.5 w-3.5" />
                    {seller.storeWebsite.replace(/^https?:\/\//, "")}
                  </I18n.a>
                </li>
              ) : null}
            </I18n.ul>
          ) : null}
        </I18n.div>
        <div className="flex gap-5 text-center text-xs">
          <div>
            <I18n.strong className="block text-lg">{seller.activeListings}</I18n.strong>
            <I18n.span className="text-muted">Aktif ilan</I18n.span>
          </div>
          <div>
            <I18n.strong className="block text-lg">{seller.soldListings}</I18n.strong>
            <I18n.span className="text-muted">Satılan</I18n.span>
          </div>
        </div>
      </div>
      <div className="flex gap-0 border-b border-border">
        <I18n.Link
          href={`/satici/${seller.id}`}
          className={cn(
            "border-b-2 px-1 py-3 text-xs",
            active === "profil" ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
          )}
        >
          {isStore ? "Mağaza ve ürünler" : "Profil ve ilanlar"}
        </I18n.Link>
        <I18n.Link
          href={`/satici/${seller.id}/yorumlar`}
          className={cn(
            "ml-6 border-b-2 px-1 py-3 text-xs",
            active === "yorumlar" ? "border-brand font-semibold text-brand" : "border-transparent text-muted",
          )}
        >
          Değerlendirmeler ({seller.ratingCount})
        </I18n.Link>
      </div>
    </div>
  );
}
