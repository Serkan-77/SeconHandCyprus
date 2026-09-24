"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { resolveVerification } from "@/lib/actions/admin";

export function VerificationActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        full={false}
        className="min-h-9 text-xs"
        disabled={pending}
        icon={<Icon name="check" className="h-4 w-4" />}
        onClick={() => startTransition(async () => void (await resolveVerification(id, true)))}
      >
        Onayla
      </Button>
      <Button
        full={false}
        variant="outline"
        className="min-h-9 text-xs"
        disabled={pending}
        onClick={() => startTransition(async () => void (await resolveVerification(id, false)))}
      >
        Reddet
      </Button>
    </div>
  );
}
