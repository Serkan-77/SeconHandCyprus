"use client";

import { startTransition, type FormEvent, type FormHTMLAttributes } from "react";

/**
 * A form that runs a server action (from useActionState) without React's
 * automatic form reset, so an error never wipes what the user typed.
 */
export function ActionForm({
  action,
  ...rest
}: { action: (formData: FormData) => void } & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  }
  return <form {...rest} onSubmit={onSubmit} />;
}
