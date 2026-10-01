"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiRequestError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/Toast";

type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  signedIn: boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Favorites feel instant: the heart flips at once and the request follows;
 * a refused request (network, restricted account) flips it back and says why.
 * Rapid double-taps on one listing collapse into the final state.
 */
export function FavoritesProvider({
  userKey,
  initialIds,
  children,
}: {
  userKey: string;
  initialIds: string[];
  children: ReactNode;
}) {
  const [ids, setIds] = useState(() => new Set(initialIds));
  // A different user (sign-in, sign-out) starts from their own favourites,
  // without remounting the page tree.
  const [forUser, setForUser] = useState(userKey);
  if (forUser !== userKey) {
    setForUser(userKey);
    setIds(new Set(initialIds));
  }
  const inflight = useRef(new Map<string, boolean>());
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const signedIn = userKey !== "guest";

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!signedIn) {
        router.push(`/giris?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const want = !ids.has(id);
      setIds((prev) => {
        const next = new Set(prev);
        if (want) next.add(id);
        else next.delete(id);
        return next;
      });
      const busy = inflight.current.has(id);
      inflight.current.set(id, want);
      if (busy) return;
      const run = async () => {
        while (inflight.current.has(id)) {
          const target = inflight.current.get(id)!;
          try {
            await (target ? api.put(`/me/favorites/${id}`) : api.del(`/me/favorites/${id}`));
            if (inflight.current.get(id) === target) {
              inflight.current.delete(id);
              if (target) toast.show("Favorilere eklendi");
            }
          } catch (e) {
            inflight.current.delete(id);
            setIds((prev) => {
              const next = new Set(prev);
              if (target) next.delete(id);
              else next.add(id);
              return next;
            });
            if (e instanceof ApiRequestError && e.status === 401) router.push(`/giris?returnTo=${encodeURIComponent(pathname)}`);
            else toast.show(e instanceof ApiRequestError ? e.message : "Favori kaydedilemedi. Tekrar dene.", { tone: "error" });
          }
        }
      };
      void run();
    },
    [ids, pathname, router, signedIn, toast],
  );

  return <FavoritesContext.Provider value={{ favoriteIds: ids, toggleFavorite, signedIn }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside FavoritesProvider");
  return value;
}
