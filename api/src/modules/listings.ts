// /api/v1/listings — discovery, the listing page, and the seller's own
// listing management. Visibility comes from row level security ("listings
// visible": active and seller not sanctioned, or your own, or admin), so a
// query here can never return a listing its caller may not see.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SYSTEM, withActor, type Tx } from "../db/pool.ts";
import { forbidden, notFound, validation } from "../lib/errors.ts";
import { requireViewer } from "../http/context.ts";
import { imageUrls } from "../storage/images.ts";
import {
  parseAttributeFilters,
  specificationGroups,
  validateAttributes,
  type AttributeFilter,
} from "../../../shared/attributes.ts";
import { CONDITIONS, CURRENCIES, REGION_NAMES } from "../../../shared/constants.ts";
import { listingCreateSchema, listingUpdateSchema, reportSchema } from "../../../shared/schemas.ts";
import { CARD_COLUMNS, isUuid, pageParams, parse, publicName, run, toCard, uuidParam, type CardRow } from "./common.ts";
import { getTaxonomy, type Taxonomy } from "./taxonomy.ts";
import { purgeUploads } from "./uploads.ts";

// Mirror of app.fold(): lowercase ASCII fold with Turkish letters.
const FOLD_FROM = "çğıöşüÇĞIİÖŞÜâîûÂÎÛéÉ";
const FOLD_TO = "cgiosucgiiosuaiuaiuee";
export function fold(s: string) {
  let out = "";
  for (const ch of s) {
    const i = FOLD_FROM.indexOf(ch);
    out += i === -1 ? ch : FOLD_TO[i];
  }
  return out.toLowerCase();
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type SearchQuery = Record<string, string | string[] | undefined>;

function str(q: SearchQuery, key: string) {
  const v = q[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

/** Parsed, validated search parameters; anything unknown is ignored. */
export function parseSearch(q: SearchQuery, taxonomy: Taxonomy) {
  const categoryRaw = str(q, "category");
  const category = categoryRaw
    ? /^\d+$/.test(categoryRaw)
      ? taxonomy.byId.get(Number(categoryRaw))
      : taxonomy.bySlug.get(categoryRaw)
    : undefined;
  const words = (str(q, "q") ?? "")
    .slice(0, 100)
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((w) => w.length >= 1)
    .slice(0, 6);
  const cities = (str(q, "city") ?? "").split(",").filter((c) => REGION_NAMES.includes(c));
  const conditions = (str(q, "condition") ?? "").split(",").filter((c): c is (typeof CONDITIONS)[number] =>
    (CONDITIONS as readonly string[]).includes(c),
  );
  const num = (key: string) => {
    const v = str(q, key);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const currency = str(q, "currency");
  const since = str(q, "since");
  const sort = str(q, "sort");
  const seller = str(q, "seller");
  const exclude = str(q, "exclude");
  const attributeFilters: AttributeFilter[] = category ? parseAttributeFilters(taxonomy.attributesFor(category.id), q) : [];
  return {
    words,
    category: category ?? null,
    cities,
    conditions,
    min: num("min"),
    max: num("max"),
    currency: (CURRENCIES as readonly string[]).includes(currency ?? "") ? (currency as (typeof CURRENCIES)[number]) : undefined,
    since: since === "1" || since === "7" || since === "30" ? Number(since) : undefined,
    negotiable: str(q, "negotiable") === "1",
    stores: str(q, "stores") === "1",
    featured: str(q, "featured") === "1",
    sort: sort === "artan" || sort === "azalan" ? sort : ("yeni" as const),
    seller: isUuid(seller) ? seller : undefined,
    exclude: isUuid(exclude) ? exclude : undefined,
    attributeFilters,
  };
}

export type ParsedSearch = ReturnType<typeof parseSearch>;

function searchWhere(sql: Tx, s: ParsedSearch, taxonomy: Taxonomy, { skipCategory = false } = {}) {
  const conds = [sql`l.status = 'active'`];
  for (const w of s.words) conds.push(sql`l.search_text like ${"%" + escapeLike(fold(w)) + "%"}`);
  if (s.category && !skipCategory) conds.push(sql`l.category_id = any(${taxonomy.subtree(s.category.id)}::int[])`);
  if (s.cities.length) conds.push(sql`l.city = any(${s.cities}::text[])`);
  if (s.conditions.length) conds.push(sql`l.condition = any(${s.conditions}::text[])`);
  if (s.currency) conds.push(sql`l.currency = ${s.currency}`);
  if (s.min != null) conds.push(sql`l.price >= ${s.min}`);
  if (s.max != null) conds.push(sql`l.price <= ${s.max}`);
  if (s.since) conds.push(sql`l.created_at >= now() - make_interval(days => ${s.since})`);
  if (s.negotiable) conds.push(sql`l.negotiable`);
  if (s.stores) conds.push(sql`p.account_type = 'store'`);
  if (s.featured) conds.push(sql`l.featured`);
  if (s.seller) conds.push(sql`l.seller_id = ${s.seller}`);
  if (s.exclude) conds.push(sql`l.id <> ${s.exclude}`);
  for (const f of s.attributeFilters) {
    if (f.kind === "in") {
      // "@>" uses the GIN index on attributes; one containment test per value.
      const tests = f.values.map((v) => sql`(l.attributes @> ${sql.json({ [f.key]: v })} or l.attributes @> ${sql.json({ [f.key]: [v] })})`);
      conds.push(sql`(${tests.reduce((a, b) => sql`${a} or ${b}`)})`);
    } else if (f.kind === "true") {
      conds.push(sql`l.attributes @> ${sql.json({ [f.key]: true })}`);
    } else {
      const value = sql`(case when jsonb_typeof(l.attributes -> ${f.key}) = 'number' then (l.attributes ->> ${f.key})::numeric end)`;
      if (f.min != null) conds.push(sql`${value} >= ${f.min}`);
      if (f.max != null) conds.push(sql`${value} <= ${f.max}`);
    }
  }
  return conds.reduce((a, b) => sql`${a} and ${b}`);
}

function orderBy(sql: Tx, sort: ParsedSearch["sort"]) {
  if (sort === "artan") return sql`l.price asc, l.created_at desc, l.id`;
  if (sort === "azalan") return sql`l.price desc, l.created_at desc, l.id`;
  return sql`l.featured desc, l.created_at desc, l.id`;
}

export async function searchListings(sql: Tx, taxonomy: Taxonomy, mediaUrl: string, s: ParsedSearch, page: { pageSize: number; offset: number }) {
  const where = searchWhere(sql, s, taxonomy);
  const rows = await sql<CardRow[]>`
    select ${sql.unsafe(CARD_COLUMNS)}
    from listings l join profiles p on p.id = l.seller_id
    where ${where}
    order by ${orderBy(sql, s.sort)}
    limit ${page.pageSize} offset ${page.offset}`;
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from listings l join profiles p on p.id = l.seller_id where ${where}`;
  return { items: rows.map((r) => toCard(r, taxonomy, mediaUrl)), total };
}

const SLUG = /^[a-z0-9-]{1,200}$/;

// Views are counted once per address and listing every 6 hours.
const seenViews = new Map<string, number>();
function firstViewIn6h(key: string) {
  const now = Date.now();
  const last = seenViews.get(key);
  if (last && now - last < 6 * 3600_000) return false;
  if (seenViews.size > 50_000) seenViews.clear();
  seenViews.set(key, now);
  return true;
}

export async function listingRoutes(app: FastifyInstance) {
  const { db, config } = app.deps;
  const media = config.MEDIA_URL;

  // ---------------------------------------------------------------- search
  app.get("/listings", async (req) => {
    const taxonomy = await getTaxonomy(db);
    const q = req.query as SearchQuery;
    const s = parseSearch(q, taxonomy);
    const page = pageParams(q, { defaultSize: 24, maxSize: 48 });
    const result = await run(app, req, async (sql) => {
      const found = await searchListings(sql, taxonomy, media, s, page);
      // Counts per category for the same search, for "narrow down" links.
      let facets: { categoryId: number; count: number }[] = [];
      if (q.facets === "1") {
        facets = await sql<{ categoryId: number; count: number }[]>`
          select l.category_id, count(*)::int as count
          from listings l join profiles p on p.id = l.seller_id
          where ${searchWhere(sql, s, taxonomy, { skipCategory: true })}
          group by l.category_id`;
      }
      return { ...found, facets };
    });
    return { ...result, page: page.page, pageSize: page.pageSize };
  });

  // ---------------------------------------------------------------- listing page
  app.get("/listings/:ref", async (req) => {
    const ref = String((req.params as { ref: string }).ref);
    const taxonomy = await getTaxonomy(db);
    const viewer = req.viewer;
    return run(app, req, async (sql) => {
      let [row] = isUuid(ref)
        ? await sql<(CardRow & Record<string, unknown>)[]>`
            select ${sql.unsafe(CARD_COLUMNS)}, l.description, l.reject_reason
            from listings l join profiles p on p.id = l.seller_id where l.id = ${ref}`
        : SLUG.test(ref)
          ? await sql<(CardRow & Record<string, unknown>)[]>`
              select ${sql.unsafe(CARD_COLUMNS)}, l.description, l.reject_reason
              from listings l join profiles p on p.id = l.seller_id where l.slug = ${ref}`
          : [];
      let redirectSlug: string | null = null;
      if (!row && SLUG.test(ref)) {
        // The title (and so the slug) changed: find it by the reference number at the end.
        const refNo = ref.match(/-(\d{4,12})$/)?.[1];
        if (refNo) {
          [row] = await sql<(CardRow & Record<string, unknown>)[]>`
            select ${sql.unsafe(CARD_COLUMNS)}, l.description, l.reject_reason
            from listings l join profiles p on p.id = l.seller_id where l.ref_no = ${Number(refNo)}`;
          if (row) redirectSlug = row.slug;
        }
      }
      if (!row) throw notFound("İlan bulunamadı.");
      const isOwner = viewer?.id === row.sellerId;
      const isAdmin = viewer?.role === "admin";
      const [images, seller, extra] = await Promise.all([
        sql<{ id: string; path: string; position: number; width: number | null; height: number | null }[]>`
          select id, path, position, width, height from listing_images where listing_id = ${row.id} order by position, created_at`,
        sql<Record<string, unknown>[]>`
          select p.id, p.display_name, p.avatar_url, p.region, p.created_at, p.account_type, p.store_name, p.store_verified,
                 p.phone_verified, s.rating_avg, s.rating_count, s.active_listings, s.sold_listings
          from profiles p left join seller_stats s on s.seller_id = p.id where p.id = ${row.sellerId}`,
        sql<{ acceptsWhatsapp: boolean; isFavorite: boolean; conversationId: string | null; favoriteCount: number }[]>`
          select public.listing_accepts_whatsapp(${row.id}) as accepts_whatsapp,
                 exists (select 1 from favorites f where f.listing_id = ${row.id} and f.user_id = ${viewer?.id ?? null}::uuid) as is_favorite,
                 (select c.id from conversations c where c.listing_id = ${row.id} and c.buyer_id = ${viewer?.id ?? null}::uuid) as conversation_id,
                 public.listing_favorite_count(${row.id}) as favorite_count`,
      ]);
      const defs = taxonomy.attributesFor(row.categoryId);
      const s = seller[0] ?? {};
      return {
        listing: {
          ...toCard(row, taxonomy, media),
          description: row.description as string,
          attributes: row.attributes,
          specs: specificationGroups(defs, row.attributes, "tr"),
          specsEn: specificationGroups(defs, row.attributes, "en"),
          rejectReason: isOwner || isAdmin ? ((row.rejectReason as string | null) ?? null) : null,
          updatedAt: row.updatedAt.toISOString(),
          images: images.map((i) => ({ id: i.id, urls: imageUrls(media, i.path), width: i.width, height: i.height })),
          categoryPath: taxonomy.chain(row.categoryId).map((c) => ({ id: c.id, slug: c.slug, name: c.name, nameEn: c.nameEn })),
          acceptsWhatsapp: extra[0].acceptsWhatsapp,
          favoriteCount: extra[0].favoriteCount,
        },
        seller: {
          id: row.sellerId,
          name: publicName(s as never) ?? "",
          displayName: s.displayName ?? null,
          avatar: imageUrls(media, (s.avatarUrl as string | null) ?? null),
          region: s.region ?? null,
          memberSince: s.createdAt ?? null,
          isStore: s.accountType === "store",
          storeVerified: Boolean(s.storeVerified),
          phoneReviewed: Boolean(s.phoneVerified),
          ratingAvg: Number(s.ratingAvg ?? 0),
          ratingCount: Number(s.ratingCount ?? 0),
          activeListings: Number(s.activeListings ?? 0),
          soldListings: Number(s.soldListings ?? 0),
        },
        viewer: {
          isOwner,
          isAdmin,
          isFavorite: extra[0].isFavorite,
          conversationId: extra[0].conversationId,
        },
        redirectSlug,
      };
    });
  });

  app.get("/listings/:id/related", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    const taxonomy = await getTaxonomy(db);
    return run(app, req, async (sql) => {
      const [l] = await sql<{ categoryId: number; sellerId: string; price: number }[]>`
        select category_id, seller_id, price from listings where id = ${id}`;
      if (!l) throw notFound("İlan bulunamadı.");
      // Same category (leaf first, then its parent), closest in price.
      const chain = taxonomy.chain(l.categoryId);
      const scope = chain.length > 1 ? chain[chain.length - 2].id : l.categoryId;
      const similar = await sql<CardRow[]>`
        select ${sql.unsafe(CARD_COLUMNS)}
        from listings l join profiles p on p.id = l.seller_id
        where l.status = 'active' and l.id <> ${id} and l.category_id = any(${taxonomy.subtree(scope)}::int[])
        order by (l.category_id = ${l.categoryId}) desc, abs(l.price - ${l.price}) asc, l.created_at desc
        limit 8`;
      const sellerOthers = await sql<CardRow[]>`
        select ${sql.unsafe(CARD_COLUMNS)}
        from listings l join profiles p on p.id = l.seller_id
        where l.status = 'active' and l.id <> ${id} and l.seller_id = ${l.sellerId}
        order by l.created_at desc limit 6`;
      return {
        similar: similar.map((r) => toCard(r, taxonomy, media)),
        sellerOthers: sellerOthers.map((r) => toCard(r, taxonomy, media)),
      };
    });
  });

  app.post("/listings/:id/view", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    if (firstViewIn6h(`${req.clientIp}:${id}`)) {
      await withActor(db, SYSTEM, (sql) => sql`select public.increment_listing_view(${id})`);
    }
    return { ok: true };
  });

  // ---------------------------------------------------------------- create / edit
  function checkAttributes(taxonomy: Taxonomy, categoryId: number, raw: Record<string, unknown> | undefined) {
    const { values, errors } = validateAttributes(taxonomy.attributesFor(categoryId), raw);
    const keys = Object.keys(errors);
    if (keys.length) {
      throw validation(errors[keys[0]], Object.fromEntries(keys.map((k) => [`attributes.${k}`, errors[k]])));
    }
    return values;
  }

  app.post("/listings", async (req) => {
    const v = requireViewer(req);
    const input = parse(listingCreateSchema, req.body);
    const taxonomy = await getTaxonomy(db);
    const category = taxonomy.byId.get(input.categoryId);
    if (!category || !category.isActive) throw validation("Kategori seç.", { categoryId: "Kategori seç." });
    if (taxonomy.children(category.id).some((c) => c.isActive)) {
      throw validation("Bir alt kategori seç.", { categoryId: "Bir alt kategori seç." });
    }
    const attributes = checkAttributes(taxonomy, category.id, input.attributes);
    const photos = [...new Set(input.photos)];
    return run(app, req, async (sql) => {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from uploads
        where key = any(${photos}::text[]) and owner_id = ${v.id} and kind = 'listing'`;
      // A retry of an already-created listing may reference attached uploads; the function returns it.
      if (n !== photos.length) throw validation("Fotoğraflardan biri bulunamadı. Fotoğrafları yeniden yükle.", { photos: "Fotoğrafları yeniden yükle." });
      const [{ id }] = await sql<{ id: string }[]>`
        select public.create_listing(
          ${input.submissionKey}, ${category.id}, ${input.title}, ${input.description}, ${input.price},
          ${input.currency}, ${input.city}, ${input.district ?? ""}, ${input.condition}, ${input.negotiable},
          ${photos}::text[], ${sql.json(attributes as never)}) as id`;
      const [created] = await sql<{ id: string; slug: string; status: string }[]>`select id, slug, status from listings where id = ${id}`;
      return { listing: created };
    });
  });

  async function loadOwned(sql: Tx, id: string, viewerId: string, isAdmin: boolean) {
    const [l] = await sql<{ id: string; sellerId: string; status: string; categoryId: number }[]>`
      select id, seller_id, status, category_id from listings where id = ${id}`;
    if (!l) throw notFound("İlan bulunamadı.");
    if (l.sellerId !== viewerId && !isAdmin) throw forbidden("Bu ilan senin değil.");
    return l;
  }

  const NOT_EDITABLE = "Bu ilanı şu anda düzenleyemezsin. Hesabın kısıtlı olabilir.";

  app.patch("/listings/:id", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(listingUpdateSchema, req.body);
    const taxonomy = await getTaxonomy(db);
    return run(app, req, async (sql) => {
      const before = await loadOwned(sql, id, v.id, false);
      const attributes = input.attributes === undefined ? undefined : checkAttributes(taxonomy, before.categoryId, input.attributes);
      const rows = await sql<{ status: string; slug: string }[]>`
        update listings set
          title = ${input.title},
          price = ${input.price},
          city = ${input.city},
          district = ${input.district ?? null},
          description = ${input.description},
          currency = coalesce(${input.currency ?? null}, currency),
          condition = coalesce(${input.condition ?? null}, condition),
          negotiable = coalesce(${input.negotiable ?? null}, negotiable),
          attributes = coalesce(${attributes === undefined ? null : sql.json(attributes as never)}, attributes)
        where id = ${id}
        returning status, slug`;
      if (!rows.length) throw forbidden(NOT_EDITABLE);
      return { ok: true, status: rows[0].status, slug: rows[0].slug, review: before.status === "active" && rows[0].status === "pending" };
    });
  });

  app.post("/listings/:id/status", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { status } = parse(z.object({ status: z.enum(["pending", "sold", "removed", "draft"]) }), req.body);
    return run(app, req, async (sql) => {
      await loadOwned(sql, id, v.id, false);
      const rows = await sql<{ status: string }[]>`update listings set status = ${status} where id = ${id} returning status`;
      if (!rows.length) throw forbidden(NOT_EDITABLE);
      return { ok: true, status: rows[0].status };
    });
  });

  app.delete("/listings/:id", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const keys = await run(app, req, async (sql) => {
      await loadOwned(sql, id, v.id, v.role === "admin");
      const images = await sql<{ path: string }[]>`select path from listing_images where listing_id = ${id}`;
      const rows = await sql`delete from listings where id = ${id} returning id`;
      if (!rows.length) throw forbidden("İlan silinemedi.");
      return images.map((i) => i.path);
    });
    await purgeUploads(app, keys);
    return { ok: true };
  });

  // ---------------------------------------------------------------- photos
  app.post("/listings/:id/images", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { keys } = parse(z.object({ keys: z.array(z.string().max(300)).min(1).max(10) }), req.body);
    return run(app, req, async (sql) => {
      const before = await loadOwned(sql, id, v.id, false);
      const [{ start }] = await sql<{ start: number }[]>`
        select coalesce(max(position) + 1, 0)::int as start from listing_images where listing_id = ${id}`;
      for (const [i, key] of keys.entries()) {
        const rows = await sql`
          insert into listing_images (listing_id, path, position, width, height)
          select ${id}, u.key, ${start + i}, u.width, u.height from uploads u
          where u.key = ${key} and u.owner_id = ${v.id} and u.kind = 'listing'
          returning id`;
        if (!rows.length) throw validation("Fotoğraflardan biri bulunamadı. Fotoğrafları yeniden yükle.");
      }
      await sql`update uploads set attached_at = now() where key = any(${keys}::text[]) and owner_id = ${v.id}`;
      const [after] = await sql<{ status: string }[]>`select status from listings where id = ${id}`;
      return { ok: true, review: before.status === "active" && after?.status === "pending" };
    });
  });

  app.delete("/listings/:id/images/:imageId", async (req) => {
    const v = requireViewer(req);
    const { id: rawId, imageId: rawImage } = req.params as { id: string; imageId: string };
    const id = uuidParam(rawId);
    const imageId = uuidParam(rawImage);
    let removedKey: string | null = null;
    const result = await run(app, req, async (sql) => {
      const before = await loadOwned(sql, id, v.id, v.role === "admin");
      const images = await sql<{ id: string; path: string }[]>`select id, path from listing_images where listing_id = ${id}`;
      const image = images.find((i) => i.id === imageId);
      if (!image) throw notFound("Fotoğraf bulunamadı.");
      if (images.length <= 1) throw validation("İlanda en az bir fotoğraf kalmalı.");
      const rows = await sql`delete from listing_images where id = ${imageId} returning id`;
      if (!rows.length) throw forbidden(NOT_EDITABLE);
      removedKey = image.path;
      const [after] = await sql<{ status: string }[]>`select status from listings where id = ${id}`;
      return { ok: true, review: before.status === "active" && after?.status === "pending" };
    });
    if (removedKey) await purgeUploads(app, [removedKey]);
    return result;
  });

  app.put("/listings/:id/images/order", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { ids } = parse(z.object({ ids: z.array(z.uuid()).min(1).max(10) }), req.body);
    return run(app, req, async (sql) => {
      await loadOwned(sql, id, v.id, v.role === "admin");
      const existing = await sql<{ id: string }[]>`select id from listing_images where listing_id = ${id}`;
      const known = new Set(existing.map((e) => e.id));
      if (ids.length !== known.size || ids.some((x) => !known.has(x))) throw validation("Fotoğraf sırası geçersiz.");
      for (const [position, imageId] of ids.entries()) {
        await sql`update listing_images set position = ${position} where id = ${imageId} and listing_id = ${id}`;
      }
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- contact & reports
  app.get("/listings/:id/whatsapp", async (req) => {
    requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const phone = await run(app, req, async (sql) => {
      const [r] = await sql<{ phone: string | null }[]>`select public.get_listing_whatsapp(${id}) as phone`;
      return r.phone;
    });
    if (!phone) throw notFound("Satıcı WhatsApp iletişimini açmamış. Uygulama içinden mesaj gönderebilirsin.");
    return { phone };
  });

  app.post("/listings/:id/report", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(reportSchema, req.body);
    await run(app, req, async (sql) => {
      try {
        await sql`insert into reports (reporter_id, listing_id, reason, detail) values (${v.id}, ${id}, ${input.reason}, ${input.detail})`;
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw validation("Bunu zaten şikayet ettin; ekibimiz inceliyor.");
        throw e;
      }
    });
    return { ok: true };
  });
}
