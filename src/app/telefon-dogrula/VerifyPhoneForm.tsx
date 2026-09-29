"use client";
import * as I18n from "@/components/i18n/Localized";


import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/icons";
import { signInWithPhone, verifyPhoneOtp } from "@/lib/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `+${digits.slice(0, digits.length - 9)} ${digits.slice(-9, -8)}•• ••• •• ${digits.slice(-2)}`;
}

export function VerifyPhoneForm({ phone }: { phone: string }) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [state, action, pending] = useActionState(verifyPhoneOtp, undefined);
  const [resendError, setResendError] = useState("");
  const [resending, startResend] = useTransition();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  function updateDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole code.
      const next = clean.slice(0, CODE_LENGTH).split("");
      setDigits([...next, ...Array(CODE_LENGTH - next.length).fill("")]);
      inputs.current[Math.min(next.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function resend() {
    startResend(async () => {
      const form = new FormData();
      form.set("phone", phone);
      // signInWithPhone redirects back here on success.
      const result = await signInWithPhone(undefined, form);
      if (result?.error) setResendError(result.error);
      else {
        setSeconds(RESEND_SECONDS);
        setDigits(Array(CODE_LENGTH).fill(""));
      }
    });
  }

  const expired = state?.error && state.error.includes("süresi");

  if (expired) {
    return (
      <AuthLayout title="Kodun süresi doldu." backHref="/giris" backLabel="Girişe dön">
        <I18n.div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex h-[85px] w-[85px] items-center justify-center rounded-full bg-brand-soft text-brand">
            <Icon name="clock" className="h-9 w-9" />
          </span>
          <I18n.p className="max-w-xs text-sm text-muted">
            Girdiğin kodun süresi doldu ya da hatalıydı. Yeni bir doğrulama kodu isteyebilirsin.
          </I18n.p>
          {resendError ? <FormError>{resendError}</FormError> : null}
          <Button onClick={resend} disabled={resending} full={false} className="min-w-[220px]">
            {resending ? "Gönderiliyor…" : "Yeni kod gönder"}
          </Button>
        </I18n.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Telefonunu doğrula." backHref="/giris" backLabel="Girişe dön">
      <I18n.p className="text-sm text-muted">{maskPhone(phone)} numarasına gönderilen 6 haneli kodu gir.</I18n.p>
      <ActionForm action={action} className="mt-6 flex flex-col gap-6">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="token" value={digits.join("")} />
        <I18n.div className="flex gap-2">
          {digits.map((digit, i) => (
            <I18n.input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={digit}
              onChange={(e) => updateDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digit && i > 0) inputs.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`${i + 1}. hane`}
              className="h-[59px] w-full min-w-0 rounded-field border border-border bg-surface text-center text-xl text-text focus:outline-none"
            />
          ))}
        </I18n.div>
        {state?.error ? <FormError>{state.error}</FormError> : null}
        <Button type="submit" disabled={pending || digits.some((d) => !d)}>
          {pending ? "Doğrulanıyor…" : "Doğrula"}
        </Button>
        <I18n.p className="text-center text-xs text-muted">
          {seconds > 0 ? (
            `Kodu ${seconds} saniye içinde tekrar gönderebilirsin.`
          ) : (
            <I18n.button type="button" onClick={resend} disabled={resending} className="font-semibold text-accent">
              Kodu tekrar gönder
            </I18n.button>
          )}
        </I18n.p>
      </ActionForm>
    </AuthLayout>
  );
}
