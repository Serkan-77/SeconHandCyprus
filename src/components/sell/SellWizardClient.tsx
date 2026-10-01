"use client";

import dynamic from "next/dynamic";

// The listing form keeps its draft in this browser (localStorage), so it is
// rendered in the browser only; the server sends a light placeholder.
export const SellWizardClient = dynamic(() => import("./SellWizard").then((m) => m.SellWizard), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-3xl px-4 py-10" aria-busy="true">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton mt-6 h-2 w-full" />
      <div className="skeleton mt-8 h-72 w-full" />
    </div>
  ),
});
