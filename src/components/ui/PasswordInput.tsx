"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Password input with a show/hide toggle. */
export function PasswordInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(className, "pr-12")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-text"
      >
        <Icon name={visible ? "eyeOff" : "eye"} className="h-5 w-5" />
      </button>
    </span>
  );
}
