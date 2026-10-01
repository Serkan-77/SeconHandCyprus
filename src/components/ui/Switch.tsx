"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/i18n/LocaleProvider";

/** An on/off switch (role="switch"). Controlled when `checked` is passed. */
export function Switch({
  label,
  checked: controlled,
  defaultChecked = false,
  onChange,
  disabled,
  id,
}: {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useLocale();
  const [inner, setInner] = useState(defaultChecked);
  const checked = controlled ?? inner;

  function toggle() {
    const next = !checked;
    if (controlled === undefined) setInner(next);
    onChange?.(next);
  }

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={t(label)}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-[left]",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
