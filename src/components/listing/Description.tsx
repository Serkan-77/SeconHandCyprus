"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

/** The seller's text, as plain text (never HTML), folded when long. */
export function Description({ text }: { text: string }) {
  const { t } = useLocale();
  const long = text.length > 700 || text.split("\n").length > 12;
  const [open, setOpen] = useState(!long);
  return (
    <div className="mt-2">
      <p
        translate="no"
        className={`whitespace-pre-line break-words text-[15px] leading-relaxed text-text ${open ? "" : "line-clamp-[10]"}`}
      >
        {text}
      </p>
      {long ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-[14px] font-semibold text-accent" aria-expanded={open}>
          {t(open ? "Daha az göster" : "Devamını oku")}
        </button>
      ) : null}
    </div>
  );
}
