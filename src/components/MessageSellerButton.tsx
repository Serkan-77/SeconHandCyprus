"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { FormError } from "@/components/ui/FormError";
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
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
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
          setError("");
          startTransition(async () => {
            const result = await startConversation(listingId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Açılıyor…" : compact ? "Mesaj gönder" : "Satıcıya mesaj gönder"}
      </Button>
      {error ? <FormError className="mt-2">{error}</FormError> : null}
    </>
  );
}
