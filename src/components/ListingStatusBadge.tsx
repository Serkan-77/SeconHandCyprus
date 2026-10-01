import { Badge } from "@/components/ui/Badge";
import type { ListingStatus } from "@/lib/api/types";

export const statusLabel: Record<ListingStatus, string> = {
  active: "Yayında",
  pending: "İncelemede",
  rejected: "Reddedildi",
  sold: "Satıldı",
  removed: "Kaldırıldı",
  draft: "Taslak",
};

const kinds = { active: "success", pending: "warning", rejected: "danger", sold: "neutral", removed: "outline", draft: "outline" } as const;

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge kind={kinds[status]}>{statusLabel[status]}</Badge>;
}
