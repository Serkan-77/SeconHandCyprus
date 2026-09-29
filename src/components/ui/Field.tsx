
import * as I18n from "@/components/i18n/Localized";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { PasswordInput } from "@/components/ui/PasswordInput";

type FieldWrapperProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

function FieldWrapper({ label, hint, error, children, className }: FieldWrapperProps) {
  return (
    <I18n.label className={cn("flex flex-col gap-2 text-[13px] font-semibold text-text", className)}>
      {label}
      {children}
      {error ? (
        <I18n.small className="text-[11px] font-normal text-danger">{error}</I18n.small>
      ) : hint ? (
        <I18n.small className="text-[11px] font-normal text-muted">{hint}</I18n.small>
      ) : null}
    </I18n.label>
  );
}

const inputClass =
  "min-h-12 w-full rounded-field border border-border bg-surface px-4 text-base font-normal text-text placeholder:text-muted focus:outline-none data-[error=true]:border-danger";

export function Field({
  label,
  hint,
  error,
  className,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      {rest.type === "password" ? (
        <PasswordInput className={inputClass} data-error={Boolean(error)} {...rest} />
      ) : (
        <I18n.input className={inputClass} data-error={Boolean(error)} {...rest} />
      )}
    </FieldWrapper>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  options,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  options: string[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <I18n.select className={inputClass} {...rest} aria-label={rest["aria-label"] ?? label}>
        {options.map((option) => (
          <I18n.option key={option}>{option}</I18n.option>
        ))}
      </I18n.select>
    </FieldWrapper>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <I18n.textarea className={cn(inputClass, "min-h-32 resize-y py-3")} {...rest} />
    </FieldWrapper>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <I18n.label className={cn("flex items-start gap-2.5 text-[12px] text-muted", className)}>
      <I18n.input
        type="checkbox"
        className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-brand"
        {...rest}
      />
      {label}
    </I18n.label>
  );
}
