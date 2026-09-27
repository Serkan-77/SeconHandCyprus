"use client";

import { useState, useTransition } from "react";
import { adminDeleteRating } from "@/lib/actions/admin";

/** Two clicks: "Sil", then "Emin misin?", so a stray click deletes nothing. */
export function DeleteRatingButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (error) return <span className="flex-shrink-0 text-[11px] text-danger">{error}</span>;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        startTransition(async () => {
          const result = await adminDeleteRating(id);
          if (result.error) setError(result.error);
        });
      }}
      onBlur={() => setConfirming(false)}
      className="flex-shrink-0 text-[11px] font-medium text-accent disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : confirming ? "Emin misin? Sil" : "Sil"}
    </button>
  );
}
