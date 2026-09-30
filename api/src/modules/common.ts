// Helpers shared by the route modules.
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { z } from "zod";
import { withActor, type Tx } from "../db/pool.ts";
import { actorOf } from "../http/context.ts";
import { badRequest } from "../lib/errors.ts";
import { imageUrls, type ImageUrls } from "../storage/images.ts";
import { highlightFacts } from "../../../shared/attributes.ts";
import type { Taxonomy } from "./taxonomy.ts";

/** Runs fn in a transaction as the requesting user (row level security applies). */
export function run<T>(app: FastifyInstance, req: FastifyRequest, fn: (sql: Tx) => Promise<T>) {
  return withActor(app.deps.db, actorOf(req), fn);
}

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data ?? {});
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidParam(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw badRequest();
  return value.toLowerCase();
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function intParam(value: unknown, { min = 1, max = 1_000_000 } = {}): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest();
  return n;
}

export function pageParams(query: Record<string, unknown>, { defaultSize = 24, maxSize = 48 } = {}) {
  const page = Math.min(500, Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(String(query.pageSize ?? defaultSize), 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function publicName(p: { accountType?: string | null; storeName?: string | null; displayName?: string | null }) {
  if (!p.displayName && !p.storeName) return null;
  return p.accountType === "store" && p.storeName ? p.storeName : (p.displayName ?? null);
}

// ---------------------------------------------------------------------------
// Listing cards
// ---------------------------------------------------------------------------

/** Columns every card query selects (alias l = listings, p = seller profile). */
export const CARD_COLUMNS = `
  l.id, l.ref_no, l.slug, l.title, l.price, l.currency, l.city, l.district, l.condition, l.status,
  l.featured, l.negotiable, l.view_count, l.created_at, l.published_at, l.updated_at, l.category_id, l.attributes,
  l.seller_id, p.display_name as seller_display_name, p.account_type as seller_account_type,
  p.store_name as seller_store_name, p.store_verified as seller_store_verified,
  (select i.path from listing_images i where i.listing_id = l.id order by i.position, i.created_at limit 1) as image_key,
  (select count(*)::int from listing_images i where i.listing_id = l.id) as photo_count`;

export type CardRow = {
  id: string;
  refNo: number;
  slug: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  district: string | null;
  condition: string;
  status: string;
  featured: boolean;
  negotiable: boolean;
  viewCount: number;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryId: number;
  attributes: Record<string, unknown>;
  sellerId: string;
  sellerDisplayName: string;
  sellerAccountType: string;
  sellerStoreName: string | null;
  sellerStoreVerified: boolean;
  imageKey: string | null;
  photoCount: number;
};

export type ListingCard = {
  id: string;
  refNo: number;
  slug: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  district: string | null;
  condition: string;
  status: string;
  featured: boolean;
  negotiable: boolean;
  viewCount: number;
  createdAt: string;
  publishedAt: string | null;
  category: { id: number; slug: string; name: string; nameEn: string | null } | null;
  image: ImageUrls | null;
  photoCount: number;
  facts: string[];
  factsEn: string[];
  seller: { id: string; name: string; isStore: boolean; storeVerified: boolean };
};

export function toCard(row: CardRow, taxonomy: Taxonomy, mediaUrl: string): ListingCard {
  const category = taxonomy.byId.get(row.categoryId);
  const defs = taxonomy.attributesFor(row.categoryId);
  return {
    id: row.id,
    refNo: row.refNo,
    slug: row.slug,
    title: row.title,
    price: row.price,
    currency: row.currency,
    city: row.city,
    district: row.district,
    condition: row.condition,
    status: row.status,
    featured: row.featured,
    negotiable: row.negotiable,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    category: category ? { id: category.id, slug: category.slug, name: category.name, nameEn: category.nameEn } : null,
    image: imageUrls(mediaUrl, row.imageKey),
    photoCount: row.photoCount,
    facts: highlightFacts(defs, row.attributes, "tr"),
    factsEn: highlightFacts(defs, row.attributes, "en"),
    seller: {
      id: row.sellerId,
      name: publicName({ accountType: row.sellerAccountType, storeName: row.sellerStoreName, displayName: row.sellerDisplayName }) ?? "",
      isStore: row.sellerAccountType === "store",
      storeVerified: row.sellerStoreVerified,
    },
  };
}

export async function audit(
  sql: Tx,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | number | null,
  detail: Record<string, unknown> = {},
) {
  await sql`
    insert into admin_audit_log (admin_id, action, target_type, target_id, detail)
    values (${adminId}, ${action}, ${targetType}, ${targetId == null ? null : String(targetId)}, ${sql.json(detail as never)})`;
}
