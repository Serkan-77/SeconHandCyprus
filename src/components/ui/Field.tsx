import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldWrapperProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

function FieldWrapper({ label, hint, error, children, className }: FieldWrapperProps) {
  return (
    <label className={cn("flex flex-col gap-2 text-[13px] font-semibold text-text", className)}>
      {label}
      {children}
      {error ? (
        <small className="text-[11px] font-normal text-danger">{error}</small>
      ) : hint ? (
        <small className="text-[11px] font-normal text-muted">{hint}</small>
      ) : null}
    </label>
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
      <input className={inputClass} data-error={Boolean(error)} {...rest} />
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
      <select className={inputClass} {...rest}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
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
      <textarea className={cn(inputClass, "min-h-32 resize-y py-3")} {...rest} />
    </FieldWrapper>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("flex items-start gap-2.5 text-[12px] text-muted", className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-brand"
        {...rest}
      />
      {label}
    </label>
  );
}
