"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function PackagePicker({ packages }: { packages: { id: number; days: number; price: string }[] }) {
  const [selected, setSelected] = useState(packages[1]?.id ?? packages[0]?.id);
  const router = useRouter();

  if (packages.length === 0) {
    return <p className="text-sm text-muted">Şu anda satışta paket yok.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Paket">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            role="radio"
            aria-checked={selected === pkg.id}
            onClick={() => setSelected(pkg.id)}
            className={
              "flex items-center gap-4 rounded-2xl border p-5 text-left " +
              (selected === pkg.id ? "border-2 border-brand bg-brand-soft" : "border-border")
            }
          >
            <span className="text-2xl font-semibold tracking-tight">
              {pkg.days}
              <small className="block text-[10px] font-medium">gün</small>
            </span>
            <span className="ml-auto text-xl font-semibold">{pkg.price}</span>
          </button>
        ))}
      </div>
      <Button className="mt-6" onClick={() => router.push(`/odeme/ozet?paket=${selected}`)}>
        Devam et
      </Button>
    </>
  );
}
