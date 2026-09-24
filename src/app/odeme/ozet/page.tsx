import { ComingSoon } from "@/components/ComingSoon";
import { featureFlags } from "@/lib/featureFlags";

export default function PaymentSummaryPage() {
  return (
    <ComingSoon
      title="Ödeme yakında geliyor."
      desc={
        featureFlags.monetization
          ? "Paket ve ödeme özeti."
          : "Gerçek ödeme sağlayıcısı entegrasyonu Faz 2'de tamamlanacak."
      }
    />
  );
}
