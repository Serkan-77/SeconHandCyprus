"use client";
import * as I18n from "@/components/i18n/Localized";


import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="grid h-24 w-24 -rotate-6 items-center justify-center rounded-[28px] bg-brand-soft text-brand">
        <Icon name="wifi" className="h-10 w-10 rotate-6" />
      </span>
      <I18n.h1 className="text-2xl font-semibold">Bağlantı yok.</I18n.h1>
      <I18n.p className="max-w-xs text-sm text-muted">
        İnternet bağlantını kontrol et ve tekrar dene. Bazı sayfalar önbellekten gösteriliyor
        olabilir.
      </I18n.p>
      <Button full={false} className="min-w-[200px]" onClick={() => window.location.reload()}>
        Yeniden dene
      </Button>
    </div>
  );
}
