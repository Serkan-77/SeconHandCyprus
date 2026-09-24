import { Badge } from "@/components/ui/Badge";
import type { ListingStatus } from "@/lib/queries";

export const statusLabel: Record<ListingStatus, string> = {
  active: "Yayında",
  pending: "İncelemede",
  rejected: "Reddedildi",
  sold: "Satıldı",
  removed: "Kaldırıldı",
  draft: "Taslak",
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const kind = status === "active" || status === "pending" ? "accent" : status === "rejected" ? "danger" : "neutral";
  return <Badge kind={kind}>{statusLabel[status]}</Badge>;
}
