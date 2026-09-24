export const accountStatus: Record<string, { label: string; kind: "accent" | "neutral" | "danger" }> = {
  active: { label: "Aktif", kind: "accent" },
  warned: { label: "Uyarılı", kind: "neutral" },
  restricted: { label: "Kısıtlı", kind: "danger" },
  suspended: { label: "Askıda", kind: "danger" },
};

export const reportStatus: Record<string, { label: string; kind: "accent" | "neutral" | "danger" }> = {
  pending: { label: "Bekliyor", kind: "danger" },
  reviewing: { label: "İnceleniyor", kind: "neutral" },
  resolved: { label: "Çözüldü", kind: "accent" },
};

export const sanctionLabel: Record<string, string> = {
  warn: "Uyarı",
  restrict: "Geçici kısıtlama",
  suspend: "Hesap askıya alındı",
  lift: "Kısıtlama kaldırıldı",
};
