"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[500px] flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="flex h-24 w-24 -rotate-6 items-center justify-center rounded-[28px] bg-brand-soft text-brand">
        <Icon name="info" className="h-10 w-10 rotate-6" />
      </span>
      <h1 className="text-2xl font-semibold">Bir şeyler ters gitti.</h1>
      <p className="max-w-xs text-sm text-muted">
        Sayfa yüklenirken bir sorun oluştu. Bağlantını kontrol edip tekrar dene.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button full={false} className="min-w-[180px]" onClick={() => retry()}>
          Tekrar dene
        </Button>
        <LinkButton href="/" variant="outline" full={false} className="min-w-[180px]">
          Ana sayfaya dön
        </LinkButton>
      </div>
    </div>
  );
}
