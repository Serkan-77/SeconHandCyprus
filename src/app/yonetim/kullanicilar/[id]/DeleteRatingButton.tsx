"use client";

import { useTransition } from "react";
import { adminDeleteRating } from "@/lib/actions/admin";

export function DeleteRatingButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await adminDeleteRating(id);
        })
      }
      className="flex-shrink-0 text-[11px] font-medium text-accent disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "Sil"}
    </button>
  );
}
