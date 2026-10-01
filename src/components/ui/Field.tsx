"use client";

import * as I18n from "@/components/i18n/Localized";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { PasswordInput } from "@/components/ui/PasswordInput";

// Label, control, hint and error are wired together: the label names the
// control, and the hint or error is its accessible description.

type WrapperProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
};

function FieldWrapper({ label, hint, error, optional, children, className }: WrapperProps) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <I18n.label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-text">
        {label}
        {optional ? <I18n.span className="text-[12px] font-normal text-subtle">İsteğe bağlı</I18n.span> : null}
      </I18n.label>
      {children({ id, describedBy: error || hint ? noteId : undefined, invalid: Boolean(error) })}
      {error ? (
        <I18n.p id={noteId} className="text-[12px] font-medium text-danger">
          {error}
        </I18n.p>
      ) : hint ? (
        <I18n.p id={noteId} className="text-[12px] text-muted">
          {hint}
        </I18n.p>
      ) : null}
    </div>
  );
}

export const controlClass =
  "min-h-11 w-full rounded-field border border-border-strong bg-surface px-3.5 text-[15px] text-text transition-colors placeholder:text-subtle hover:border-muted focus:border-accent focus:outline-none aria-[invalid=true]:border-danger disabled:bg-brand-soft disabled:opacity-70";

type Common = { label: string; hint?: ReactNode; error?: string; optional?: boolean; className?: string };

export function Field({ label, hint, error, optional, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) =>
        rest.type === "password" ? (
          <PasswordInput id={id} aria-describedby={describedBy} aria-invalid={invalid} className={controlClass} {...rest} />
        ) : (
          <I18n.input id={id} aria-describedby={describedBy} aria-invalid={invalid} className={controlClass} {...rest} />
        )
      }
    </FieldWrapper>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  className,
  options,
  placeholder,
  ...rest
}: Common & {
  options: (string | { value: string; label: string })[];
  placeholder?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <I18n.select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(controlClass, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10")}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a93a0' stroke-width='2'%3E%3Cpath d='M5 9l7 7 7-7'/%3E%3C/svg%3E\")",
          }}
          {...rest}
        >
          {placeholder ? <I18n.option value="">{placeholder}</I18n.option> : null}
          {options.map((o) =>
            typeof o === "string" ? (
              <I18n.option key={o}>{o}</I18n.option>
            ) : (
              <I18n.option key={o.value} value={o.value}>
                {o.label}
              </I18n.option>
            ),
          )}
        </I18n.select>
      )}
    </FieldWrapper>
  );
}

export function TextareaField({ label, hint, error, optional, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <I18n.textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(controlClass, "min-h-32 resize-y py-2.5 leading-relaxed")}
          {...rest}
        />
      )}
    </FieldWrapper>
  );
}

export function Checkbox({ label, className, ...rest }: { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <I18n.label className={cn("flex cursor-pointer items-start gap-2.5 text-[13px] text-text", className)}>
      <I18n.input type="checkbox" className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-[var(--accent)]" {...rest} />
      <span className="min-w-0">{label}</span>
    </I18n.label>
  );
}
