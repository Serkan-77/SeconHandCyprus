// /api/v1/admin — moderation and operations. Every route calls requireAdmin
// first, the database checks is_admin() again in its policies, and every
// change to someone else's data is written to admin_audit_log.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Tx } from "../db/pool.ts";
import { conflict, notFound, validation } from "../lib/errors.ts";
import { requireAdmin } from "../http/context.ts";
import { imageUrls } from "../storage/images.ts";
import { validateAttributes } from "../../../shared/attributes.ts";
import { CONDITIONS, CURRENCIES, LISTING_STATUSES, REGION_NAMES } from "../../../shared/constants.ts";
import { phoneSchema, priceSchema, profileSchema, storeSchema } from "../../../shared/schemas.ts";
import { CARD_COLUMNS, audit, intParam, pageParams, parse, publicName, run, toCard, uuidParam, type CardRow } from "./common.ts";
import { getTaxonomy, invalidateTaxonomy } from "./taxonomy.ts";
import { purgeUploads } from "./uploads.ts";
import { fold } from "./listings.ts";

const likeParam = (q: string) => `%${fold(q).replace(/[\\%_]/g, "")}%`;

export async function adminRoutes(app: FastifyInstance) {
  const { db, config, hub } = app.deps;
  const media = config.MEDIA_URL;

  // All routes in this plugin are admin-only.
  app.addHook("preHandler", async (req) => {
    requireAdmin(req);
  });

  const admin = (req: FastifyRequest) => requireAdmin(req);
  const tx = <T>(req: FastifyRequest, fn: (sql: Tx) => Promise<T>) => run(app, req, fn);

  // ---------------------------------------------------------------- dashboard
  app.get("/dashboard", async (req) =>
    tx(req, async (sql) => {
      const [m] = await sql<Record<string, number>[]>`
        select
          (select count(*)::int from profiles) as users,
          (select count(*)::int from profiles where created_at > now() - interval '30 days') as new_users,
          (select count(*)::int from listings where status = 'active') as active,
          (select count(*)::int from listings where status = 'active' and created_at > now() - interval '7 days') as active_this_week,
          (select count(*)::int from listings where created_at >= date_trunc('day', now())) as today,
          (select count(*)::int from listings where status = 'pending') as pending,
          (select count(*)::int from reports where status <> 'resolved') as open_reports,
          (select count(*)::int from verification_requests where status = 'pending') as pending_verifications,
          (select count(*)::int from support_tickets where status = 'open') as open_tickets,
          (select count(*)::int from messages where created_at > now() - interval '24 hours') as messages_24h`;
      const daily = await sql<{ day: string; count: number }[]>`
        select to_char(d, 'YYYY-MM-DD') as day,
               (select count(*)::int from listings l where l.created_at >= d and l.created_at < d + interval '1 day') as count
        from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
        order by d`;
      const reports = await sql`
        select r.id, r.reason, r.status, r.created_at, l.title as listing_title, p.display_name as reported_name, r.target_snapshot
        from reports r left join listings l on l.id = r.listing_id left join profiles p on p.id = r.reported_user_id
        where r.status <> 'resolved' order by r.created_at desc limit 6`;
      return { metrics: m, daily, reports, realtimeConnections: hub.connectionCount };
    }),
  );

  // ---------------------------------------------------------------- listings
  app.get("/listings", async (req) => {
    const q = req.query as { status?: string; q?: string; page?: string };
    const page = pageParams(q, { defaultSize: 30, maxSize: 100 });
    const status = q.status === "hepsi" ? null : (LISTING_STATUSES as readonly string[]).includes(q.status ?? "") ? q.status! : "pending";
    const text = (q.q ?? "").trim().slice(0, 80);
    const taxonomy = await getTaxonomy(db);
    return tx(req, async (sql) => {
      const where = sql`true
        ${status ? sql`and l.status = ${status}` : sql``}
        ${text ? (/^\d{4,12}$/.test(text) ? sql`and l.ref_no = ${Number(text)}` : sql`and l.search_text like ${likeParam(text)}`) : sql``}`;
      const rows = await sql<(CardRow & { reportCount: number })[]>`
        select ${sql.unsafe(CARD_COLUMNS)},
          (select count(*)::int from reports r where r.listing_id = l.id and r.status <> 'resolved') as report_count
        from listings l join profiles p on p.id = l.seller_id where ${where}
        order by case when l.status = 'pending' then l.updated_at end asc nulls last, l.created_at desc
        limit ${page.pageSize} offset ${page.offset}`;
      const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from listings l where ${where}`;
      const [counts] = await sql<Record<string, number>[]>`
        select count(*) filter (where status = 'pending')::int as pending, count(*) filter (where status = 'active')::int as active,
               count(*) filter (where status = 'rejected')::int as rejected, count(*)::int as all from listings`;
      return { listings: rows.map((r) => ({ ...toCard(r, taxonomy, media), reportCount: r.reportCount })), total, counts, page: page.page };
    });
  });

  app.get("/listings/:id", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    const taxonomy = await getTaxonomy(db);
    return tx(req, async (sql) => {
      const [row] = await sql<(CardRow & { description: string; rejectReason: string | null })[]>`
        select ${sql.unsafe(CARD_COLUMNS)}, l.description, l.reject_reason
        from listings l join profiles p on p.id = l.seller_id where l.id = ${id}`;
      if (!row) throw notFound("İlan bulunamadı.");
      const images = await sql<{ id: string; path: string }[]>`
        select id, path from listing_images where listing_id = ${id} order by position, created_at`;
      const reports = await sql`
        select r.id, r.reason, r.detail, r.status, r.created_at, p.display_name as reporter_name
        from reports r left join profiles p on p.id = r.reporter_id where r.listing_id = ${id} order by r.created_at desc`;
      const [seller] = await sql`
        select p.id, p.display_name, p.status, p.status_until, p.created_at, u.email,
               (select count(*)::int from listings where seller_id = p.id) as listing_count,
               (select count(*)::int from reports where reported_user_id = p.id or listing_id in (select id from listings where seller_id = p.id)) as report_count
        from profiles p join auth.users u on u.id = p.id where p.id = ${row.sellerId}`;
      return {
        listing: {
          ...toCard(row, taxonomy, media),
          description: row.description,
          rejectReason: row.rejectReason,
          attributes: row.attributes,
          categoryPath: taxonomy.chain(row.categoryId).map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
          images: images.map((i) => ({ id: i.id, urls: imageUrls(media, i.path) })),
        },
        reports,
        seller,
      };
    });
  });

  app.post("/listings/:id/approve", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    return tx(req, async (sql) => {
      const rows = await sql`update listings set status = 'active', reject_reason = null where id = ${id} returning id`;
      if (!rows.length) throw notFound("İlan bulunamadı.");
      await audit(sql, v.id, "listing.approve", "listing", id);
      return { ok: true };
    });
  });

  app.post("/listings/:id/reject", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { reason, note } = parse(z.object({ reason: z.string().trim().min(2).max(120), note: z.string().trim().max(360).default("") }), req.body);
    const text = note ? `${reason}. ${note}` : reason;
    return tx(req, async (sql) => {
      const rows = await sql`update listings set status = 'rejected', reject_reason = ${text} where id = ${id} returning id`;
      if (!rows.length) throw notFound("İlan bulunamadı.");
      await audit(sql, v.id, "listing.reject", "listing", id, { reason: text });
      return { ok: true };
    });
  });

  app.post("/listings/:id/featured", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { featured } = parse(z.object({ featured: z.boolean() }), req.body);
    return tx(req, async (sql) => {
      const rows = await sql`update listings set featured = ${featured} where id = ${id} and (status = 'active' or not ${featured}) returning id`;
      if (!rows.length) throw validation("Yalnızca yayındaki ilanlar vitrine alınabilir.");
      await audit(sql, v.id, featured ? "listing.feature" : "listing.unfeature", "listing", id);
      return { ok: true };
    });
  });

  const adminListingSchema = z.object({
    title: z.string().trim().min(3, "Başlık en az 3 karakter olmalı.").max(120, "Başlık en fazla 120 karakter olabilir."),
    categoryId: z.number({ error: "Kategori seç." }).int().positive("Kategori seç."),
    price: priceSchema,
    currency: z.enum(CURRENCIES, { error: "Para birimini seç." }),
    condition: z.enum(CONDITIONS, { error: "Ürün durumunu seç." }),
    city: z.enum(REGION_NAMES as [string, ...string[]], { error: "Listeden bir bölge seç." }),
    district: z.string().trim().max(60, "Semt en fazla 60 karakter olabilir.").transform((v) => v || null),
    description: z.string().trim().max(5000, "Açıklama en fazla 5000 karakter olabilir."),
    negotiable: z.boolean(),
    status: z.enum(LISTING_STATUSES, { error: "Geçersiz ilan durumu." }),
    attributes: z.record(z.string(), z.unknown()).default({}),
  });

  app.put("/listings/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(adminListingSchema, req.body);
    const taxonomy = await getTaxonomy(db);
    if (!taxonomy.byId.get(input.categoryId)) throw validation("Kategori seç.");
    // Admins may keep values the current form no longer offers (legacy data), but not invalid ones.
    const { values, errors } = validateAttributes(
      taxonomy.attributesFor(input.categoryId).map((d) => ({ ...d, required: false })),
      input.attributes,
    );
    const firstKey = Object.keys(errors)[0];
    if (firstKey) throw validation(errors[firstKey]);
    return tx(req, async (sql) => {
      const rows = await sql`
        update listings set title = ${input.title}, category_id = ${input.categoryId}, price = ${input.price},
          currency = ${input.currency}, condition = ${input.condition}, city = ${input.city}, district = ${input.district},
          description = ${input.description}, negotiable = ${input.negotiable}, status = ${input.status},
          attributes = ${sql.json(values as never)},
          reject_reason = case when ${input.status} = 'active' then null else reject_reason end
        where id = ${id} returning id`;
      if (!rows.length) throw notFound("İlan bulunamadı.");
      await audit(sql, v.id, "listing.edit", "listing", id, { status: input.status, categoryId: input.categoryId });
      return { ok: true };
    });
  });

  app.delete("/listings/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const keys = await tx(req, async (sql) => {
      const images = await sql<{ path: string }[]>`select path from listing_images where listing_id = ${id}`;
      const [l] = await sql<{ title: string; sellerId: string }[]>`delete from listings where id = ${id} returning title, seller_id`;
      if (!l) throw notFound("İlan bulunamadı.");
      await audit(sql, v.id, "listing.delete", "listing", id, { title: l.title, sellerId: l.sellerId });
      return images.map((i) => i.path);
    });
    await purgeUploads(app, keys);
    return { ok: true };
  });

  app.delete("/listing-images/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const key = await tx(req, async (sql) => {
      const [img] = await sql<{ path: string; listingId: string }[]>`delete from listing_images where id = ${id} returning path, listing_id`;
      if (!img) throw notFound("Fotoğraf bulunamadı.");
      await audit(sql, v.id, "listing.image_remove", "listing", img.listingId);
      return img.path;
    });
    await purgeUploads(app, [key]);
    return { ok: true };
  });

  // ---------------------------------------------------------------- users
  app.get("/users", async (req) => {
    const q = req.query as { q?: string; filter?: string };
    const page = pageParams(q, { defaultSize: 30, maxSize: 100 });
    const text = (q.q ?? "").trim().slice(0, 80);
    return tx(req, async (sql) => {
      const rows = await sql`
        select p.id, p.display_name, p.avatar_url, p.region, p.role, p.status, p.status_until, p.created_at,
               p.account_type, p.store_name, p.store_verified, u.email, u.email_verified_at, u.last_sign_in_at,
               coalesce(s.active_listings, 0) as active_listings, coalesce(s.sold_listings, 0) as sold_listings
        from profiles p join auth.users u on u.id = p.id left join seller_stats s on s.seller_id = p.id
        where true
          ${text ? sql`and (app.fold(p.display_name) like ${likeParam(text)} or u.email::text like ${likeParam(text)} or app.fold(coalesce(p.store_name, '')) like ${likeParam(text)})` : sql``}
          ${q.filter === "sanctioned" ? sql`and p.status in ('restricted', 'suspended', 'warned')` : sql``}
          ${q.filter === "admins" ? sql`and p.role = 'admin'` : sql``}
          ${q.filter === "stores" ? sql`and p.account_type = 'store'` : sql``}
        order by p.created_at desc limit ${page.pageSize} offset ${page.offset}`;
      return { users: rows.map((r) => ({ ...r, avatar: imageUrls(media, r.avatarUrl as string | null) })), page: page.page };
    });
  });

  app.get("/users/:id", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    const taxonomy = await getTaxonomy(db);
    return tx(req, async (sql) => {
      const [profile] = await sql<Record<string, unknown>[]>`
        select p.*, pp.phone, pp.whatsapp_enabled, u.email, u.email_verified_at, u.last_sign_in_at,
               s.rating_avg, s.rating_count, s.active_listings, s.sold_listings
        from profiles p join auth.users u on u.id = p.id
        left join profile_private pp on pp.id = p.id left join seller_stats s on s.seller_id = p.id
        where p.id = ${id}`;
      if (!profile) throw notFound("Kullanıcı bulunamadı.");
      const listings = await sql<CardRow[]>`
        select ${sql.unsafe(CARD_COLUMNS)} from listings l join profiles p on p.id = l.seller_id
        where l.seller_id = ${id} order by l.created_at desc limit 50`;
      const sanctions = await sql`
        select s.id, s.kind, s.reason, s.created_at, s.expires_at, a.display_name as created_by_name
        from sanctions s left join profiles a on a.id = s.created_by
        where s.subject_user_id = ${id} order by s.created_at desc`;
      const reports = await sql`
        select r.id, r.reason, r.status, r.created_at, l.title as listing_title
        from reports r left join listings l on l.id = r.listing_id
        where r.reported_user_id = ${id} or l.seller_id = ${id} order by r.created_at desc limit 50`;
      const ratings = await sql`
        select r.id, r.score, r.comment, r.created_at, p.display_name as rater_name
        from ratings r left join profiles p on p.id = r.rater_id where r.ratee_id = ${id} order by r.created_at desc limit 50`;
      const [sessions] = await sql<{ n: number }[]>`
        select count(*)::int as n from auth.sessions where user_id = ${id} and revoked_at is null and expires_at > now()`;
      return {
        profile: { ...profile, avatar: imageUrls(media, profile.avatarUrl as string | null), name: publicName(profile as never) },
        listings: listings.map((l) => toCard(l, taxonomy, media)),
        sanctions,
        reports,
        ratings,
        activeSessions: sessions.n,
      };
    });
  });

  const adminUserSchema = z.object({
    name: z.string(),
    region: z.string(),
    bio: z.string().default(""),
    phone: z.string().default(""),
    phoneVerified: z.boolean(),
    role: z.enum(["user", "admin"]),
    accountType: z.enum(["personal", "store"]),
    store: z.object({ storeName: z.string(), address: z.string(), phone: z.string(), website: z.string(), hours: z.string() }),
    storeVerified: z.boolean(),
  });

  app.put("/users/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(adminUserSchema, req.body);
    if (id === v.id && input.role !== "admin") throw validation("Kendi yönetici yetkini kaldıramazsın.");
    const profile = parse(profileSchema, { name: input.name, region: input.region, bio: input.bio });
    const phone = input.phone.trim() ? parse(phoneSchema, input.phone) : null;
    const store = input.accountType === "store" ? parse(storeSchema, input.store) : null;
    return tx(req, async (sql) => {
      const rows = await sql`
        update profiles set display_name = ${profile.name}, region = ${profile.region}, bio = ${profile.bio ?? null},
          role = ${input.role}, account_type = ${input.accountType},
          store_name = ${store?.storeName ?? null}, store_address = ${store?.address ?? null}, store_phone = ${store?.phone ?? null},
          store_website = ${store?.website ?? null}, store_hours = ${store?.hours ?? null},
          store_verified = ${Boolean(store) && input.storeVerified}
        where id = ${id} returning id`;
      if (!rows.length) throw notFound("Kullanıcı bulunamadı.");
      await sql`update profile_private set phone = ${phone}, whatsapp_enabled = whatsapp_enabled and ${phone !== null} where id = ${id}`;
      // A phone change resets the flag in the database, so set it afterwards.
      await sql`update profiles set phone_verified = ${Boolean(phone) && input.phoneVerified} where id = ${id}`;
      await audit(sql, v.id, "user.edit", "user", id, { role: input.role, accountType: input.accountType, storeVerified: input.storeVerified });
      return { ok: true };
    });
  });

  app.delete("/users/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const keys = await tx(req, async (sql) => {
      const files = await sql<{ key: string }[]>`select key from uploads where owner_id = ${id}`;
      const [p] = await sql<{ displayName: string }[]>`select display_name from profiles where id = ${id}`;
      await sql`select public.admin_delete_user(${id})`;
      await audit(sql, v.id, "user.delete", "user", id, { displayName: p?.displayName ?? null });
      return files.map((f) => f.key);
    });
    await purgeUploads(app, keys);
    hub.closeUser(id);
    return { ok: true };
  });

  const SANCTIONS = { warn: null, restrict: 7, suspend: null, lift: null } as const;

  app.post("/users/:id/sanctions", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(
      z.object({
        kind: z.enum(["warn", "restrict", "suspend", "lift"]),
        reason: z.string().trim().min(5, "Gerekçe en az 5 karakter olmalı.").max(500),
        days: z.number().int().min(1).max(365).optional(),
      }),
      req.body,
    );
    if (id === v.id) throw validation("Kendine yaptırım uygulayamazsın.");
    const days = input.kind === "restrict" ? (input.days ?? SANCTIONS.restrict) : input.kind === "suspend" ? input.days : undefined;
    return tx(req, async (sql) => {
      await sql`
        insert into sanctions (user_id, kind, reason, created_by, expires_at)
        values (${id}, ${input.kind}, ${input.reason}, ${v.id}, ${days ? sql`now() + make_interval(days => ${days})` : null})`;
      await audit(sql, v.id, `user.sanction.${input.kind}`, "user", id, { reason: input.reason, days: days ?? null });
      return { ok: true };
    });
  });

  app.post("/users/:id/sign-out", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    await tx(req, async (sql) => {
      await sql`update auth.sessions set revoked_at = now(), revoke_reason = 'admin' where user_id = ${id} and revoked_at is null`;
      await audit(sql, v.id, "user.sign_out", "user", id);
    });
    hub.closeUser(id);
    return { ok: true };
  });

  app.delete("/ratings/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    return tx(req, async (sql) => {
      const [r] = await sql`delete from ratings where id = ${id} returning ratee_id, score`;
      if (!r) throw notFound("Değerlendirme bulunamadı.");
      await audit(sql, v.id, "rating.delete", "rating", id, { rateeId: r.rateeId, score: r.score });
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- reports
  app.get("/reports", async (req) => {
    const q = req.query as { status?: string; page?: string };
    const page = pageParams(q, { defaultSize: 30, maxSize: 100 });
    const status = ["pending", "reviewing", "resolved"].includes(q.status ?? "") ? q.status! : null;
    return tx(req, async (sql) => {
      const rows = await sql`
        select r.id, r.reason, r.detail, r.status, r.created_at, r.resolved_at, r.listing_id, r.reported_user_id, r.target_snapshot,
               l.title as listing_title, l.slug as listing_slug, rp.display_name as reported_name, rep.display_name as reporter_name
        from reports r
        left join listings l on l.id = r.listing_id
        left join profiles rp on rp.id = r.reported_user_id
        left join profiles rep on rep.id = r.reporter_id
        where ${status ? sql`r.status = ${status}` : sql`r.status <> 'resolved'`}
        order by r.created_at desc limit ${page.pageSize} offset ${page.offset}`;
      return { reports: rows, page: page.page };
    });
  });

  app.get("/reports/:id", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    return tx(req, async (sql) => {
      const [r] = await sql<Record<string, unknown>[]>`
        select r.*, l.title as listing_title, l.slug as listing_slug, l.status as listing_status, l.seller_id as listing_seller_id,
               rp.display_name as reported_name, rep.display_name as reporter_name
        from reports r
        left join listings l on l.id = r.listing_id
        left join profiles rp on rp.id = r.reported_user_id
        left join profiles rep on rep.id = r.reporter_id
        where r.id = ${id}`;
      if (!r) throw notFound("Şikayet bulunamadı.");
      const snapshot = r.targetSnapshot as { listing?: { images?: string[] } } | null;
      const images = (snapshot?.listing?.images ?? []).map((k) => imageUrls(media, k));
      return { report: r, snapshotImages: images };
    });
  });

  app.post("/reports/:id/status", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(z.object({ status: z.enum(["reviewing", "resolved"]), note: z.string().trim().max(1000).optional() }), req.body);
    return tx(req, async (sql) => {
      const rows = await sql`
        update reports set status = ${input.status},
          resolution_note = case when ${input.status} = 'resolved' then ${input.note || null} else resolution_note end,
          resolved_at = case when ${input.status} = 'resolved' then now() else resolved_at end
        where id = ${id} returning id`;
      if (!rows.length) throw notFound("Şikayet bulunamadı.");
      await audit(sql, v.id, `report.${input.status}`, "report", id, { note: input.note ?? null });
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- verification requests & support
  app.get("/verifications", async (req) =>
    tx(req, async (sql) => ({
      items: await sql`
        select vr.id, vr.kind, vr.detail, vr.status, vr.created_at, vr.resolved_at, vr.user_id, p.display_name
        from verification_requests vr join profiles p on p.id = vr.user_id
        order by (vr.status = 'pending') desc, vr.created_at desc limit 200`,
    })),
  );

  app.post("/verifications/:id", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { approve } = parse(z.object({ approve: z.boolean() }), req.body);
    return tx(req, async (sql) => {
      const rows = await sql`
        update verification_requests set status = ${approve ? "approved" : "rejected"}, resolved_at = now()
        where id = ${id} and status = 'pending' returning user_id`;
      if (!rows.length) throw conflict("Talep bulunamadı ya da zaten sonuçlandı.");
      await audit(sql, v.id, approve ? "verification.approve" : "verification.reject", "user", rows[0].userId as string);
      return { ok: true };
    });
  });

  app.get("/support", async (req) =>
    tx(req, async (sql) => ({
      items: await sql`
        select t.id, t.email, t.topic, t.message, t.status, t.created_at, t.user_id, p.display_name
        from support_tickets t left join profiles p on p.id = t.user_id
        order by (t.status = 'open') desc, t.created_at desc limit 200`,
    })),
  );

  app.post("/support/:id/close", async (req) => {
    const v = admin(req);
    const id = uuidParam((req.params as { id: string }).id);
    return tx(req, async (sql) => {
      await sql`update support_tickets set status = 'closed' where id = ${id}`;
      await audit(sql, v.id, "support.close", "support_ticket", id);
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- announcements
  app.get("/announcements", async (req) =>
    tx(req, async (sql) => ({
      items: await sql`select id, audience, title, body, recipients, created_at from announcements order by created_at desc limit 50`,
    })),
  );

  app.post("/announcements", async (req) => {
    const v = admin(req);
    const input = parse(
      z.object({
        audience: z.enum(["Tüm kullanıcılar", "Aktif satıcılar", "Yeni kullanıcılar"]),
        title: z.string().trim().min(3).max(120),
        body: z.string().trim().min(3).max(2000),
      }),
      req.body,
    );
    return tx(req, async (sql) => {
      const [r] = await sql<{ n: number }[]>`select public.send_announcement(${input.audience}, ${input.title}, ${input.body}) as n`;
      await audit(sql, v.id, "announcement.send", "announcement", null, { audience: input.audience, recipients: r.n });
      return { ok: true, count: r.n };
    });
  });

  // ---------------------------------------------------------------- categories & attributes
  app.get("/categories", async (req) =>
    tx(req, async (sql) => {
      const categories = await sql`
        select c.*, (select count(*)::int from listings l where l.category_id = c.id) as listing_count
        from categories c order by c.parent_id nulls first, c.sort_order, c.name`;
      const attributes = await sql`select * from category_attributes order by category_id nulls first, sort_order, id`;
      return { categories, attributes };
    }),
  );

  const categorySchema = z.object({
    name: z.string().trim().min(2, "Kategori adı en az 2 karakter olmalı.").max(60),
    nameEn: z.string().trim().max(60).optional().transform((v) => v || null),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adres yalnızca küçük harf, rakam ve tire içerebilir.").max(60).optional(),
    parentId: z.number().int().positive().nullable().default(null),
    icon: z.string().trim().min(1).max(40).default("grid"),
    description: z.string().trim().max(300).optional().transform((v) => v || null),
    sortOrder: z.number().int().min(0).max(10000).default(0),
    isActive: z.boolean().default(true),
  });

  const slugOf = (name: string) =>
    fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  app.post("/categories", async (req) => {
    const v = admin(req);
    const input = parse(categorySchema, req.body);
    const slug = input.slug ?? slugOf(input.name);
    if (!slug) throw validation("Kategori adında en az bir harf ya da rakam olmalı.");
    const result = await tx(req, async (sql) => {
      try {
        const [c] = await sql<{ id: number }[]>`
          insert into categories (parent_id, slug, name, name_en, icon, description, sort_order, is_active)
          values (${input.parentId}, ${slug}, ${input.name}, ${input.nameEn}, ${input.icon}, ${input.description}, ${input.sortOrder}, ${input.isActive})
          returning id`;
        await audit(sql, v.id, "category.create", "category", c.id, { name: input.name, slug });
        return { ok: true, id: c.id };
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw conflict("Bu adresle bir kategori zaten var.");
        throw e;
      }
    });
    invalidateTaxonomy();
    return result;
  });

  app.put("/categories/:id", async (req) => {
    const v = admin(req);
    const id = intParam((req.params as { id: string }).id);
    const input = parse(categorySchema, req.body);
    if (input.parentId === id) throw validation("Bir kategori kendi altına taşınamaz.");
    const taxonomy = await getTaxonomy(db);
    if (input.parentId && taxonomy.subtree(id).includes(input.parentId)) throw validation("Bir kategori kendi alt kategorisinin altına taşınamaz.");
    const result = await tx(req, async (sql) => {
      // The slug is part of public URLs; it is never changed after creation.
      const rows = await sql`
        update categories set parent_id = ${input.parentId}, name = ${input.name}, name_en = ${input.nameEn}, icon = ${input.icon},
          description = ${input.description}, sort_order = ${input.sortOrder}, is_active = ${input.isActive}
        where id = ${id} returning id`;
      if (!rows.length) throw notFound("Kategori bulunamadı.");
      await audit(sql, v.id, "category.edit", "category", id, { name: input.name, isActive: input.isActive });
      return { ok: true };
    });
    invalidateTaxonomy();
    return result;
  });

  app.delete("/categories/:id", async (req) => {
    const v = admin(req);
    const id = intParam((req.params as { id: string }).id);
    const result = await tx(req, async (sql) => {
      const [{ listings, children }] = await sql<{ listings: number; children: number }[]>`
        select (select count(*)::int from listings where category_id = ${id}) as listings,
               (select count(*)::int from categories where parent_id = ${id}) as children`;
      if (listings > 0) throw validation("Bu kategoride ilanlar var; önce ilanları taşı ya da kategoriyi gizle.");
      if (children > 0) throw validation("Önce alt kategorileri taşı ya da sil.");
      const rows = await sql`delete from categories where id = ${id} returning name`;
      if (!rows.length) throw notFound("Kategori bulunamadı.");
      await audit(sql, v.id, "category.delete", "category", id, { name: rows[0].name });
      return { ok: true };
    });
    invalidateTaxonomy();
    return result;
  });

  const attributeSchema = z
    .object({
      categoryId: z.number().int().positive().nullable(),
      key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Anahtar küçük harf, rakam ve alt çizgi içerebilir."),
      label: z.string().trim().min(1).max(60),
      labelEn: z.string().trim().max(60).optional().transform((v) => v || null),
      type: z.enum(["text", "number", "select", "multiselect", "boolean", "year"]),
      unit: z.string().trim().max(12).optional().transform((v) => v || null),
      options: z
        .array(z.object({ value: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(60), label_en: z.string().trim().max(60).optional() }))
        .max(200)
        .default([]),
      required: z.boolean().default(false),
      filterable: z.boolean().default(false),
      highlight: z.boolean().default(false),
      min: z.number().nullable().default(null),
      max: z.number().nullable().default(null),
      maxLength: z.number().int().min(1).max(500).nullable().default(null),
      placeholder: z.string().trim().max(80).optional().transform((v) => v || null),
      help: z.string().trim().max(200).optional().transform((v) => v || null),
      group: z.string().trim().min(1).max(40).default("Özellikler"),
      sortOrder: z.number().int().min(0).max(10000).default(0),
      isActive: z.boolean().default(true),
    })
    .refine((a) => !["select", "multiselect"].includes(a.type) || a.options.length > 0 || !a.isActive, "Seçenekli alanlara en az bir seçenek ekle.")
    .refine((a) => new Set(a.options.map((o) => o.value)).size === a.options.length, "Seçenek değerleri benzersiz olmalı.");

  app.post("/attributes", async (req) => {
    const v = admin(req);
    const a = parse(attributeSchema, req.body);
    const result = await tx(req, async (sql) => {
      try {
        const [row] = await sql<{ id: number }[]>`
          insert into category_attributes (category_id, key, label, label_en, type, unit, options, required, filterable, highlight,
            min_value, max_value, max_length, placeholder, help, group_name, sort_order, is_active)
          values (${a.categoryId}, ${a.key}, ${a.label}, ${a.labelEn}, ${a.type}, ${a.unit}, ${sql.json(a.options as never)}, ${a.required},
            ${a.filterable}, ${a.highlight}, ${a.min}, ${a.max}, ${a.maxLength}, ${a.placeholder}, ${a.help}, ${a.group}, ${a.sortOrder}, ${a.isActive})
          returning id`;
        await audit(sql, v.id, "attribute.create", "attribute", row.id, { key: a.key, categoryId: a.categoryId });
        return { ok: true, id: row.id };
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw conflict("Bu kategoride bu anahtarla bir alan zaten var.");
        throw e;
      }
    });
    invalidateTaxonomy();
    return result;
  });

  app.put("/attributes/:id", async (req) => {
    const v = admin(req);
    const id = intParam((req.params as { id: string }).id);
    const a = parse(attributeSchema, req.body);
    const result = await tx(req, async (sql) => {
      // Key and category identify stored values; they stay as created.
      const rows = await sql`
        update category_attributes set label = ${a.label}, label_en = ${a.labelEn}, type = ${a.type}, unit = ${a.unit},
          options = ${sql.json(a.options as never)}, required = ${a.required}, filterable = ${a.filterable}, highlight = ${a.highlight},
          min_value = ${a.min}, max_value = ${a.max}, max_length = ${a.maxLength}, placeholder = ${a.placeholder}, help = ${a.help},
          group_name = ${a.group}, sort_order = ${a.sortOrder}, is_active = ${a.isActive}
        where id = ${id} returning id`;
      if (!rows.length) throw notFound("Alan bulunamadı.");
      await audit(sql, v.id, "attribute.edit", "attribute", id, { key: a.key });
      return { ok: true };
    });
    invalidateTaxonomy();
    return result;
  });

  app.delete("/attributes/:id", async (req) => {
    const v = admin(req);
    const id = intParam((req.params as { id: string }).id);
    const result = await tx(req, async (sql) => {
      const rows = await sql`delete from category_attributes where id = ${id} returning key`;
      if (!rows.length) throw notFound("Alan bulunamadı.");
      await audit(sql, v.id, "attribute.delete", "attribute", id, { key: rows[0].key });
      return { ok: true };
    });
    invalidateTaxonomy();
    return result;
  });

  // ---------------------------------------------------------------- audit log
  app.get("/audit", async (req) => {
    const page = pageParams(req.query as Record<string, unknown>, { defaultSize: 50, maxSize: 200 });
    return tx(req, async (sql) => ({
      items: await sql`
        select a.id, a.action, a.target_type, a.target_id, a.detail, a.created_at, p.display_name as admin_name
        from admin_audit_log a left join profiles p on p.id = a.admin_id
        order by a.created_at desc limit ${page.pageSize} offset ${page.offset}`,
    }));
  });
}
