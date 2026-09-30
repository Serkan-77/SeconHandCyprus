// /api/v1/me — the signed-in user's own data: profile, contact details,
// store, settings, listings, favorites, notifications, verification requests
// and account deletion.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withActor } from "../db/pool.ts";
import { forbidden, validation } from "../lib/errors.ts";
import { requireViewer } from "../http/context.ts";
import { verifyPassword } from "../auth/passwords.ts";
import { imageUrls } from "../storage/images.ts";
import { contactSchema, phoneSchema, profileSchema, storeSchema } from "../../../shared/schemas.ts";
import { LISTING_STATUSES } from "../../../shared/constants.ts";
import { CARD_COLUMNS, pageParams, parse, run, toCard, uuidParam, type CardRow } from "./common.ts";
import { getTaxonomy } from "./taxonomy.ts";
import { purgeUploads } from "./uploads.ts";

const SETTINGS_KEYS = ["notify_messages", "notify_price", "notify_listing", "notify_rating", "notify_announcements"] as const;

export async function unreadCounts(app: FastifyInstance, userId: string) {
  return withActor(app.deps.db, { userId, role: "user" }, async (sql) => {
    const [row] = await sql<{ messages: number; notifications: number }[]>`
      select
        (select count(*)::int from messages m join conversations c on c.id = m.conversation_id
          where ${userId} in (c.buyer_id, c.seller_id) and m.read_at is null and m.sender_id is distinct from ${userId}) as messages,
        (select count(*)::int from notifications n where n.user_id = ${userId} and n.read_at is null) as notifications`;
    return row;
  });
}

export async function meRoutes(app: FastifyInstance) {
  const { db, config, hub } = app.deps;
  const media = config.MEDIA_URL;

  app.get("", async (req) => {
    const v = requireViewer(req);
    return run(app, req, async (sql) => {
      const [p] = await sql<Record<string, unknown>[]>`
        select p.*, pp.phone, pp.whatsapp_enabled, u.email, u.email_verified_at, u.password_hash is not null as has_password
        from profiles p
        join auth.users u on u.id = p.id
        left join profile_private pp on pp.id = p.id
        where p.id = ${v.id}`;
      const [counts] = await sql<Record<string, number>[]>`
        select
          count(*) filter (where status = 'active')::int as active,
          count(*) filter (where status = 'pending')::int as pending,
          count(*) filter (where status = 'rejected')::int as rejected,
          count(*) filter (where status = 'sold')::int as sold,
          count(*) filter (where status in ('draft', 'removed'))::int as inactive,
          (select count(*)::int from favorites where user_id = ${v.id}) as favorites
        from listings where seller_id = ${v.id}`;
      const [stats] = await sql<{ ratingAvg: number; ratingCount: number }[]>`
        select rating_avg, rating_count from seller_stats where seller_id = ${v.id}`;
      return {
        id: p.id,
        email: p.email,
        emailVerified: Boolean(p.emailVerifiedAt),
        hasPassword: p.hasPassword,
        displayName: p.displayName,
        avatar: imageUrls(media, p.avatarUrl as string | null),
        avatarKey: p.avatarUrl,
        region: p.region,
        bio: p.bio,
        role: p.role,
        status: p.status,
        statusUntil: p.statusUntil,
        phoneVerified: p.phoneVerified,
        settings: p.settings,
        createdAt: p.createdAt,
        accountType: p.accountType,
        store: {
          name: p.storeName,
          verified: p.storeVerified,
          address: p.storeAddress,
          phone: p.storePhone,
          website: p.storeWebsite,
          hours: p.storeHours,
        },
        contact: { phone: p.phone ?? null, whatsapp: Boolean(p.whatsappEnabled) },
        counts,
        rating: { avg: Number(stats?.ratingAvg ?? 0), count: stats?.ratingCount ?? 0 },
      };
    });
  });

  app.get("/counts", async (req) => {
    const v = requireViewer(req);
    return unreadCounts(app, v.id);
  });

  app.patch("/profile", async (req) => {
    const v = requireViewer(req);
    const input = parse(profileSchema, req.body);
    let previousAvatar: string | null = null;
    await run(app, req, async (sql) => {
      const [current] = await sql<{ avatarUrl: string | null; bio: string | null }[]>`
        select avatar_url, bio from profiles where id = ${v.id}`;
      previousAvatar = current?.avatarUrl ?? null;
      const avatar = input.avatar === undefined ? previousAvatar : input.avatar;
      const bio = input.bio === undefined ? (current?.bio ?? null) : input.bio;
      const rows = await sql`
        update profiles set display_name = ${input.name}, region = ${input.region}, bio = ${bio}, avatar_url = ${avatar}
        where id = ${v.id} returning id`;
      if (!rows.length) throw forbidden("Profil kaydedilemedi.");
      if (avatar && avatar !== previousAvatar) {
        await sql`update uploads set attached_at = now() where key = ${avatar} and owner_id = ${v.id}`;
      }
    });
    if (previousAvatar && input.avatar !== undefined && input.avatar !== previousAvatar) await purgeUploads(app, [previousAvatar]);
    return { ok: true };
  });

  app.put("/store", async (req) => {
    const v = requireViewer(req);
    const input = parse(storeSchema, req.body);
    await run(app, req, (sql) => sql`
      update profiles set account_type = 'store', store_name = ${input.storeName}, store_address = ${input.address},
        store_phone = ${input.phone}, store_website = ${input.website}, store_hours = ${input.hours}
      where id = ${v.id}`);
    return { ok: true };
  });

  app.delete("/store", async (req) => {
    const v = requireViewer(req);
    await run(app, req, (sql) => sql`
      update profiles set account_type = 'personal', store_name = null, store_address = null,
        store_phone = null, store_website = null, store_hours = null
      where id = ${v.id}`);
    return { ok: true };
  });

  app.patch("/settings", async (req) => {
    const v = requireViewer(req);
    const patch = parse(z.object(Object.fromEntries(SETTINGS_KEYS.map((k) => [k, z.boolean().optional()]))).strict(), req.body);
    await run(app, req, (sql) => sql`
      update profiles set settings = settings || ${sql.json(patch as never)} where id = ${v.id}`);
    return { ok: true };
  });

  app.put("/contact", async (req) => {
    const v = requireViewer(req);
    const input = parse(contactSchema, req.body);
    if (input.whatsapp && !input.phone) throw validation("WhatsApp ile ulaşılabilmek için telefon numaranı gir.");
    await run(app, req, (sql) => sql`
      update profile_private set phone = ${input.phone}, whatsapp_enabled = ${input.whatsapp} where id = ${v.id}`);
    return { ok: true };
  });

  // ---------------------------------------------------------------- listings & favorites
  app.get("/listings", async (req) => {
    const v = requireViewer(req);
    const status = String((req.query as { status?: string }).status ?? "");
    const taxonomy = await getTaxonomy(db);
    return run(app, req, async (sql) => {
      const rows = await sql<(CardRow & { rejectReason: string | null; favoriteCount: number; conversationCount: number; unreadCount: number })[]>`
        select ${sql.unsafe(CARD_COLUMNS)}, l.reject_reason,
          public.listing_favorite_count(l.id) as favorite_count,
          (select count(*)::int from conversations c where c.listing_id = l.id) as conversation_count,
          (select count(*)::int from messages m join conversations c on c.id = m.conversation_id
             where c.listing_id = l.id and m.read_at is null and m.sender_id is distinct from ${v.id}) as unread_count
        from listings l join profiles p on p.id = l.seller_id
        where l.seller_id = ${v.id}
          ${(LISTING_STATUSES as readonly string[]).includes(status) ? sql`and l.status = ${status}` : sql``}
        order by l.updated_at desc limit 200`;
      return {
        listings: rows.map((r) => ({
          ...toCard(r, taxonomy, media),
          rejectReason: r.rejectReason,
          favoriteCount: r.favoriteCount,
          conversationCount: r.conversationCount,
          unreadCount: r.unreadCount,
          updatedAt: r.updatedAt,
        })),
      };
    });
  });

  app.get("/listings/:id", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const taxonomy = await getTaxonomy(db);
    return run(app, req, async (sql) => {
      const [row] = await sql<(CardRow & { description: string; rejectReason: string | null })[]>`
        select ${sql.unsafe(CARD_COLUMNS)}, l.description, l.reject_reason
        from listings l join profiles p on p.id = l.seller_id where l.id = ${id} and l.seller_id = ${v.id}`;
      if (!row) throw forbidden("Bu ilan senin değil.");
      const images = await sql<{ id: string; path: string; position: number }[]>`
        select id, path, position from listing_images where listing_id = ${id} order by position, created_at`;
      return {
        listing: {
          ...toCard(row, taxonomy, media),
          description: row.description,
          rejectReason: row.rejectReason,
          attributes: row.attributes,
          categoryPath: taxonomy.chain(row.categoryId).map((c) => ({ id: c.id, slug: c.slug, name: c.name, nameEn: c.nameEn })),
          images: images.map((i) => ({ id: i.id, key: i.path, urls: imageUrls(media, i.path) })),
        },
      };
    });
  });

  app.get("/favorites", async (req) => {
    const v = requireViewer(req);
    const taxonomy = await getTaxonomy(db);
    return run(app, req, async (sql) => {
      // Listings that were sold or removed stay in the list, marked, so the
      // user understands why they disappeared from search.
      const rows = await sql<(CardRow & { favoritedAt: Date })[]>`
        select ${sql.unsafe(CARD_COLUMNS)}, f.created_at as favorited_at
        from favorites f join listings l on l.id = f.listing_id join profiles p on p.id = l.seller_id
        where f.user_id = ${v.id}
        order by f.created_at desc limit 500`;
      return { listings: rows.map((r) => ({ ...toCard(r, taxonomy, media), favoritedAt: r.favoritedAt })) };
    });
  });

  app.get("/favorites/ids", async (req) => {
    const v = requireViewer(req);
    const rows = await run(app, req, (sql) => sql<{ listingId: string }[]>`
      select listing_id from favorites where user_id = ${v.id} order by created_at desc limit 2000`);
    return { ids: rows.map((r) => r.listingId) };
  });

  app.put("/favorites/:listingId", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { listingId: string }).listingId);
    await run(app, req, (sql) => sql`
      insert into favorites (user_id, listing_id) values (${v.id}, ${id}) on conflict do nothing`);
    return { favorite: true };
  });

  app.delete("/favorites/:listingId", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { listingId: string }).listingId);
    await run(app, req, (sql) => sql`delete from favorites where user_id = ${v.id} and listing_id = ${id}`);
    return { favorite: false };
  });

  // ---------------------------------------------------------------- notifications
  app.get("/notifications", async (req) => {
    const v = requireViewer(req);
    const page = pageParams(req.query as Record<string, unknown>, { defaultSize: 30, maxSize: 100 });
    return run(app, req, async (sql) => {
      const items = await sql`
        select id, kind, title, body, link, read_at, created_at from notifications
        where user_id = ${v.id} order by created_at desc limit ${page.pageSize} offset ${page.offset}`;
      return { items, page: page.page };
    });
  });

  app.post("/notifications/read-all", async (req) => {
    const v = requireViewer(req);
    await run(app, req, (sql) => sql`update notifications set read_at = now() where user_id = ${v.id} and read_at is null`);
    return { ok: true };
  });

  app.delete("/notifications/:id", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    await run(app, req, (sql) => sql`delete from notifications where id = ${id} and user_id = ${v.id}`);
    return { ok: true };
  });

  // ---------------------------------------------------------------- verification, sanctions, blocks
  app.get("/verification-requests", async (req) => {
    const v = requireViewer(req);
    const items = await run(app, req, (sql) => sql`
      select id, kind, detail, status, created_at, resolved_at from verification_requests
      where user_id = ${v.id} order by created_at desc limit 20`);
    return { items };
  });

  app.post("/verification-requests", async (req) => {
    const v = requireViewer(req);
    const phone = parse(phoneSchema, (req.body as { phone?: unknown } | undefined)?.phone);
    await run(app, req, async (sql) => {
      const [pending] = await sql`
        select id from verification_requests where user_id = ${v.id} and kind = 'phone' and status = 'pending'`;
      if (pending) throw validation("Zaten incelemede olan bir talebin var.");
      await sql`insert into verification_requests (user_id, kind, detail) values (${v.id}, 'phone', ${phone})`;
    });
    return { ok: true };
  });

  app.get("/sanctions", async (req) => {
    const v = requireViewer(req);
    const items = await run(app, req, (sql) => sql`
      select kind, reason, expires_at, created_at from sanctions where user_id = ${v.id} order by created_at desc limit 20`);
    return { items };
  });

  app.get("/blocks", async (req) => {
    const v = requireViewer(req);
    const rows = await run(app, req, (sql) => sql<{ id: string; displayName: string; avatarUrl: string | null; createdAt: Date }[]>`
      select p.id, p.display_name, p.avatar_url, b.created_at
      from blocks b join profiles p on p.id = b.blocked_id where b.blocker_id = ${v.id} order by b.created_at desc`);
    return { blocks: rows.map((r) => ({ id: r.id, name: r.displayName, avatar: imageUrls(media, r.avatarUrl), createdAt: r.createdAt })) };
  });

  // ---------------------------------------------------------------- account deletion
  app.post("/delete", async (req) => {
    const v = requireViewer(req);
    const { password } = parse(z.object({ password: z.string().max(200).optional() }), req.body);
    const [user] = await db<{ passwordHash: string | null }[]>`select password_hash from auth.users where id = ${v.id}`;
    if (user?.passwordHash && !(await verifyPassword(user.passwordHash, password ?? ""))) {
      throw forbidden("Şifren hatalı. Hesabını silmek için şifreni gir.");
    }
    // Files first (the rows that point at them go with the account), then the account.
    const keys = await run(app, req, async (sql) => {
      const rows = await sql<{ key: string }[]>`select key from uploads where owner_id = ${v.id}`;
      await sql`select public.delete_my_account()`;
      return rows.map((r) => r.key);
    });
    await purgeUploads(app, keys);
    hub.closeUser(v.id);
    return { ok: true };
  });
}
