"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export function Switch({
  label,
  defaultChecked = false,
  onChange,
}: {
  label: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const id = useId();

  function toggle() {
    const next = !checked;
    setChecked(next);
    onChange?.(next);
  }

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={toggle}
      className={cn(
        "relative h-[26px] w-11 flex-shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
