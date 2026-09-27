import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials, memberSince, ratingLabel } from "@/lib/format";
import type { SellerSummary } from "@/lib/queries";

export function SellerHeader({ seller, active }: { seller: SellerSummary; active: "profil" | "yorumlar" }) {
  const isStore = seller.accountType === "store" && Boolean(seller.storeName);
  return (
    <div className="mb-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={initials(seller.displayName)} src={seller.avatarUrl} large />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {isStore ? seller.storeName : seller.displayName}
            {isStore ? (
              <Badge kind="accent" icon={<Icon name={seller.storeVerified ? "shield" : "store"} className="h-3 w-3" />}>
                {seller.storeVerified ? "Onaylı mağaza" : "Mağaza"}
              </Badge>
            ) : null}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {[ratingLabel(seller.ratingAvg, seller.ratingCount), seller.region, memberSince(seller.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {seller.bio ? <p className="mt-3 max-w-xl text-[13px] leading-relaxed">{seller.bio}</p> : null}
          {isStore ? (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
              {seller.storeAddress ? (
                <li className="flex items-center gap-1.5">
                  <Icon name="pin" className="h-3.5 w-3.5 text-accent" />
                  {seller.storeAddress}
                </li>
              ) : null}
              {seller.storeHours ? (
                <li className="flex items-center gap-1.5">
                  <Icon name="clock" className="h-3.5 w-3.5 text-accent" />
                  {seller.storeHours}
                </li>
              ) : null}
              {seller.storePhone ? (
                <li>
                  <a href={`tel:${seller.storePhone}`} className="flex items-center gap-1.5 text-accent">
                    <Icon name="phone" className="h-3.5 w-3.5" />
                    {seller.storePhone}
                  </a>
                </li>
              ) : null}
              {seller.storeWebsite ? (
                <li>
                  <a
                    href={seller.storeWebsite}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1.5 text-accent"
                  >
                    <Icon name="globe" className="h-3.5 w-3.5" />
                    {seller.storeWebsite.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
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
          {isStore ? "Mağaza ve ürünler" : "Profil ve ilanlar"}
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
