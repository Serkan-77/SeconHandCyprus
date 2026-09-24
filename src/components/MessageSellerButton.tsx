"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { startConversation } from "@/lib/actions/listings";

export function MessageSellerButton({
  listingId,
  loggedIn,
  compact = false,
}: {
  listingId: string;
  loggedIn: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Button
      full={!compact}
      className={compact ? "min-w-[170px]" : undefined}
      disabled={pending}
      icon={<Icon name="chat" className="h-4 w-4" />}
      onClick={() => {
        if (!loggedIn) {
          router.push(`/giris-gerekli?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        startTransition(() => startConversation(listingId));
      }}
    >
      {pending ? "Açılıyor…" : compact ? "Mesaj gönder" : "Satıcıya mesaj gönder"}
    </Button>
  );
}
