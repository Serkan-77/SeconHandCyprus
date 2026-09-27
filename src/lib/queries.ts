import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { IconName } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicImageUrl } from "@/lib/supabase/env";

export type Category = { id: number; slug: string; name: string; icon: IconName; sortOrder: number };

export type ListingStatus = "draft" | "pending" | "active" | "rejected" | "sold" | "removed";

export type ListingCardData = {
  id: string;
  refNo: number;
  slug: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  district: string | null;
  condition: string;
  status: ListingStatus;
  featured: boolean;
  viewCount: number;
  createdAt: string;
  category: { name: string; slug: string };
  image: string;
};

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  region: string | null;
  bio: string | null;
  role: "user" | "admin";
  status: "active" | "warned" | "restricted" | "suspended";
  statusUntil: string | null;
  phoneVerified: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  /** Store accounts (migration 0014). */
  accountType: "personal" | "store";
  storeName: string | null;
  storeVerified: boolean;
  storeAddress: string | null;
  storePhone: string | null;
  storeWebsite: string | null;
  storeHours: string | null;
};

export type SellerSummary = Profile & { ratingAvg: number; ratingCount: number; activeListings: number; soldListings: number };

// PostgREST embeds come back as objects or arrays depending on the relation;
// normalise to a single row.
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export const LISTING_CARD_SELECT =
  "id, ref_no, slug, title, price, currency, city, district, condition, status, featured, view_count, created_at, category:categories(name, slug), images:listing_images(path, position)";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toCard(row: any): ListingCardData {
  const images = [...(row.images ?? [])].sort((a: any, b: any) => a.position - b.position);
  const category = one(row.category) as { name: string; slug: string } | null;
  return {
    id: row.id,
    refNo: row.ref_no,
    slug: row.slug,
    title: row.title,
    price: Number(row.price),
    currency: row.currency,
    city: row.city,
    district: row.district,
    condition: row.condition,
    status: row.status,
    featured: row.featured,
    viewCount: row.view_count ?? 0,
    createdAt: row.created_at,
    category: category ?? { name: "", slug: "" },
    image: publicImageUrl(images[0]?.path),
  };
}

export function toProfile(row: any): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ? publicImageUrl(row.avatar_url, "avatars") : null,
    region: row.region,
    bio: row.bio,
    role: row.role,
    status: row.status,
    statusUntil: row.status_until,
    phoneVerified: row.phone_verified,
    settings: row.settings ?? {},
    createdAt: row.created_at,
    accountType: row.account_type === "store" ? "store" : "personal",
    storeName: row.store_name ?? null,
    storeVerified: Boolean(row.store_verified),
    storeAddress: row.store_address ?? null,
    storePhone: row.store_phone ?? null,
    storeWebsite: row.store_website ?? null,
    storeHours: row.store_hours ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A store is shown under its store name, everyone else under their display name. */
export function publicName(p: Pick<Profile, "accountType" | "storeName" | "displayName">) {
  return p.accountType === "store" && p.storeName ? p.storeName : p.displayName;
}

export function locationLabel(l: { city: string; district: string | null }) {
  return l.district ? `${l.city}, ${l.district}` : l.city;
}

/** The signed-in user and their profile, memoised per request. */
export const getViewer = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!data) return null;
  return { user, profile: toProfile(data) };
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, sortOrder: c.sort_order }));
});

export type ListingFilters = {
  q?: string;
  category?: string;
  city?: string;
  min?: number;
  max?: number;
  currency?: string;
  conditions?: string[];
  since?: "1" | "7" | "30";
  negotiable?: boolean;
  sort?: "yeni" | "artan" | "azalan";
  page?: number;
  pageSize?: number;
  sellerId?: string;
  excludeId?: string;
  /** Only listings of store accounts (migration 0014). */
  storesOnly?: boolean;
};

export async function searchListings(filters: ListingFilters = {}) {
  if (!isSupabaseConfigured) return { items: [] as ListingCardData[], total: 0 };
  const supabase = await createClient();
  const pageSize = filters.pageSize ?? 12;
  const page = Math.max(1, filters.page ?? 1);

  const categoryId = filters.category
    ? (await getCategories()).find((c) => c.slug === filters.category)?.id
    : undefined;

  let query = supabase
    .from("listings")
    .select(
      filters.storesOnly ? `${LISTING_CARD_SELECT}, seller:profiles!listings_seller_id_fkey!inner(account_type)` : LISTING_CARD_SELECT,
      { count: "exact" },
    )
    .eq("status", "active");
  if (filters.storesOnly) query = query.eq("seller.account_type", "store");

  if (filters.q) {
    // Characters that would break the PostgREST or() filter syntax.
    const term = filters.q.replace(/[%,()"\\*:]/g, " ").trim();
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (categoryId) query = query.eq("category_id", categoryId);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.min != null && !Number.isNaN(filters.min)) query = query.gte("price", filters.min);
  if (filters.max != null && !Number.isNaN(filters.max)) query = query.lte("price", filters.max);
  if (filters.conditions?.length) query = query.in("condition", filters.conditions);
  if (filters.negotiable) query = query.eq("negotiable", true);
  if (filters.sellerId) query = query.eq("seller_id", filters.sellerId);
  if (filters.excludeId) query = query.neq("id", filters.excludeId);
  if (filters.since) {
    const since = new Date(Date.now() - Number(filters.since) * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", since.toISOString());
  }

  if (filters.sort === "artan") query = query.order("price", { ascending: true });
  else if (filters.sort === "azalan") query = query.order("price", { ascending: false });
  else query = query.order("featured", { ascending: false }).order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const { data, count } = await query.range(from, from + pageSize - 1);
  return { items: (data ?? []).map(toCard), total: count ?? 0 };
}

export async function getSellerSummary(id: string): Promise<SellerSummary | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("seller_stats").select("*").eq("seller_id", id).maybeSingle(),
  ]);
  if (!profile) return null;
  return {
    ...toProfile(profile),
    ratingAvg: Number(stats?.rating_avg ?? 0),
    ratingCount: stats?.rating_count ?? 0,
    activeListings: stats?.active_listings ?? 0,
    soldListings: stats?.sold_listings ?? 0,
  };
}

export async function getFavoriteIds(): Promise<string[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", viewer.user.id);
  return (data ?? []).map((f) => f.listing_id);
}

export async function getUnreadCounts() {
  const viewer = await getViewer();
  if (!viewer) return { messages: 0, notifications: 0 };
  const supabase = await createClient();
  const [{ count: notifications }, { data: convs }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.user.id)
      .is("read_at", null),
    supabase
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${viewer.user.id},seller_id.eq.${viewer.user.id}`),
  ]);
  let messages = 0;
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .neq("sender_id", viewer.user.id)
      .is("read_at", null);
    messages = count ?? 0;
  }
  return { messages, notifications: notifications ?? 0 };
}

/**
 * Admin pages call this first. Real enforcement happens in the database (RLS
 * policies use is_admin()), this only decides what to render.
 */
export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer) redirect("/yonetim/giris");
  if (viewer.profile.role !== "admin") redirect("/yonetim/giris?yetki=yok");
  return viewer;
}
