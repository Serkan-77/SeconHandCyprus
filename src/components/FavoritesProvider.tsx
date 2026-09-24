"use client";

import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toggleFavorite as toggleFavoriteAction } from "@/lib/actions/listings";

type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  pending: boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ initialIds, children }: { initialIds: string[]; children: ReactNode }) {
  const [ids, setIds] = useState(() => new Set(initialIds));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const toggleFavorite = useCallback(
    (id: string) => {
      const wasFavorite = ids.has(id);
      // Optimistic update, rolled back if the server rejects it.
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
      startTransition(async () => {
        const result = await toggleFavoriteAction(id);
        if (result.error) {
          setIds((prev) => {
            const next = new Set(prev);
            if (wasFavorite) next.add(id);
            else next.delete(id);
            return next;
          });
          if (result.error === "auth") router.push(`/giris-gerekli?returnTo=${encodeURIComponent(pathname)}`);
          else router.push("/hesap-kisitlandi");
        }
      });
    },
    [ids, pathname, router],
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds: ids, toggleFavorite, pending }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside FavoritesProvider");
  return value;
}
