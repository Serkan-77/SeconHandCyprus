// /api/v1/users — public seller profiles, their ratings, stores, and the
// per-user actions (block, report). Only public profile fields leave here:
// no e-mail, phone, role, status or settings.
import type { FastifyInstance } from "fastify";
import { ANON, withActor } from "../db/pool.ts";
import { notFound, validation } from "../lib/errors.ts";
import { requireViewer } from "../http/context.ts";
import { imageUrls } from "../storage/images.ts";
import { reportSchema, supportSchema } from "../../../shared/schemas.ts";
import { CARD_COLUMNS, pageParams, parse, publicName, run, toCard, uuidParam, type CardRow } from "./common.ts";
import { getTaxonomy } from "./taxonomy.ts";
import { fold } from "./listings.ts";

type PublicProfileRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  region: string | null;
  bio: string | null;
  createdAt: Date;
  accountType: string;
  storeName: string | null;
  storeVerified: boolean;
  storeAddress: string | null;
  storePhone: string | null;
  storeWebsite: string | null;
  storeHours: string | null;
  phoneVerified: boolean;
  status: string;
  statusUntil: Date | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  activeListings: number | null;
  soldListings: number | null;
  emailVerified?: boolean | null;
};

export function presentProfile(row: PublicProfileRow, mediaUrl: string) {
  const isStore = row.accountType === "store";
  const sanctioned =
    (row.status === "restricted" || row.status === "suspended") && (!row.statusUntil || row.statusUntil.getTime() >= Date.now());
  return {
    id: row.id,
    name: publicName(row) ?? "",
    displayName: row.displayName,
    avatar: imageUrls(mediaUrl, row.avatarUrl),
    region: row.region,
    bio: row.bio,
    memberSince: row.createdAt,
    isStore,
    store: isStore
      ? {
          name: row.storeName,
          verified: row.storeVerified,
          address: row.storeAddress,
          phone: row.storePhone,
          website: row.storeWebsite,
          hours: row.storeHours,
        }
      : null,
    emailVerified: Boolean(row.emailVerified),
    // Hidden sellers' profiles stay reachable (old links, conversations) but say so.
    unavailable: sanctioned,
    stats: {
      ratingAvg: Number(row.ratingAvg ?? 0),
      ratingCount: Number(row.ratingCount ?? 0),
      activeListings: Number(row.activeListings ?? 0),
      soldListings: Number(row.soldListings ?? 0),
    },
  };
}

export async function userRoutes(app: FastifyInstance) {
  const { db, config } = app.deps;
  const media = config.MEDIA_URL;

  app.get("/users/:id", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    const taxonomy = await getTaxonomy(db);
    return run(app, req, async (sql) => {
      const [row] = await sql<PublicProfileRow[]>`
        select p.id, p.display_name, p.avatar_url, p.region, p.bio, p.created_at, p.account_type, p.store_name,
               p.store_verified, p.store_address, p.store_phone, p.store_website, p.store_hours, p.phone_verified,
               p.status, p.status_until, s.rating_avg, s.rating_count, s.active_listings, s.sold_listings,
               (select u.email_verified_at is not null from auth.users u where u.id = p.id) as email_verified
        from profiles p left join seller_stats s on s.seller_id = p.id where p.id = ${id}`;
      if (!row) throw notFound("Kullanıcı bulunamadı.");
      const listings = await sql<CardRow[]>`
        select ${sql.unsafe(CARD_COLUMNS)} from listings l join profiles p on p.id = l.seller_id
        where l.seller_id = ${id} and l.status = 'active' order by l.featured desc, l.created_at desc limit 48`;
      const recentRatings = await sql<{ id: string; score: number; comment: string | null; createdAt: Date; raterName: string | null; raterId: string }[]>`
        select r.id, r.score, r.comment, r.created_at, r.rater_id, p.display_name as rater_name
        from ratings r left join profiles p on p.id = r.rater_id
        where r.ratee_id = ${id} order by r.created_at desc limit 3`;
      const viewer = req.viewer;
      const [blocked] = viewer
        ? await sql<{ blocked: boolean }[]>`select exists (select 1 from blocks where blocker_id = ${viewer.id} and blocked_id = ${id}) as blocked`
        : [{ blocked: false }];
      return {
        profile: presentProfile(row, media),
        listings: listings.map((l) => toCard(l, taxonomy, media)),
        recentRatings,
        viewer: { blocked: blocked.blocked, isSelf: viewer?.id === id },
      };
    });
  });

  app.get("/users/:id/ratings", async (req) => {
    const id = uuidParam((req.params as { id: string }).id);
    const page = pageParams(req.query as Record<string, unknown>, { defaultSize: 20, maxSize: 50 });
    return run(app, req, async (sql) => {
      const items = await sql`
        select r.id, r.score, r.comment, r.created_at, r.rater_id, p.display_name as rater_name,
               l.title as listing_title, l.slug as listing_slug
        from ratings r
        left join profiles p on p.id = r.rater_id
        left join listings l on l.id = r.listing_id
        where r.ratee_id = ${id}
        order by r.created_at desc limit ${page.pageSize} offset ${page.offset}`;
      const [s] = await sql<{ total: number; avg: number | null; s1: number; s2: number; s3: number; s4: number; s5: number }[]>`
        select count(*)::int as total, avg(score)::numeric(3,2) as avg,
               count(*) filter (where score = 1)::int as s1, count(*) filter (where score = 2)::int as s2,
               count(*) filter (where score = 3)::int as s3, count(*) filter (where score = 4)::int as s4,
               count(*) filter (where score = 5)::int as s5
        from ratings where ratee_id = ${id}`;
      return {
        items,
        total: s.total,
        average: Number(s.avg ?? 0),
        distribution: { 1: s.s1, 2: s.s2, 3: s.s3, 4: s.s4, 5: s.s5 },
        page: page.page,
        pageSize: page.pageSize,
      };
    });
  });

  app.get("/stores", async (req) => {
    const q = String((req.query as { q?: string }).q ?? "").trim().slice(0, 60);
    const page = pageParams(req.query as Record<string, unknown>, { defaultSize: 24, maxSize: 48 });
    return run(app, req, async (sql) => {
      const rows = await sql<PublicProfileRow[]>`
        select p.id, p.display_name, p.avatar_url, p.region, p.bio, p.created_at, p.account_type, p.store_name,
               p.store_verified, p.store_address, p.store_phone, p.store_website, p.store_hours, p.phone_verified,
               p.status, p.status_until, s.rating_avg, s.rating_count, s.active_listings, s.sold_listings
        from profiles p left join seller_stats s on s.seller_id = p.id
        where p.account_type = 'store' and not public.is_sanctioned(p.id)
          ${q ? sql`and app.fold(p.store_name) like ${"%" + fold(q).replace(/[\\%_]/g, "") + "%"}` : sql``}
        order by p.store_verified desc, s.active_listings desc nulls last, p.created_at
        limit ${page.pageSize} offset ${page.offset}`;
      return { stores: rows.map((r) => presentProfile(r, media)), page: page.page };
    });
  });

  app.post("/users/:id/block", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    if (id === v.id) throw validation("Kendini engelleyemezsin.");
    await run(app, req, (sql) => sql`
      insert into blocks (blocker_id, blocked_id) values (${v.id}, ${id}) on conflict do nothing`);
    return { ok: true };
  });

  app.delete("/users/:id/block", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    await run(app, req, (sql) => sql`delete from blocks where blocker_id = ${v.id} and blocked_id = ${id}`);
    return { ok: true };
  });

  app.post("/users/:id/report", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(reportSchema, req.body);
    await run(app, req, async (sql) => {
      try {
        await sql`insert into reports (reporter_id, reported_user_id, reason, detail) values (${v.id}, ${id}, ${input.reason}, ${input.detail})`;
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw validation("Bunu zaten şikayet ettin; ekibimiz inceliyor.");
        throw e;
      }
    });
    return { ok: true };
  });

  // Public, aggregate numbers for the about page (no personal data).
  let statsCache: { at: number; value: Record<string, number> } | null = null;
  app.get("/stats", async (_req, reply) => {
    if (!statsCache || Date.now() - statsCache.at > 5 * 60_000) {
      const [row] = await withActor(db, ANON, (sql) => sql<Record<string, number>[]>`
        select (select count(*)::int from listings where status = 'active') as active_listings,
               (select count(*)::int from profiles) as members,
               (select count(*)::int from profiles where account_type = 'store') as stores`);
      statsCache = { at: Date.now(), value: row };
    }
    reply.header("cache-control", "public, max-age=300");
    return statsCache.value;
  });

  // Support tickets can be sent signed in or anonymously.
  app.post("/support", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Honeypot: bots that fill every field get a normal answer and nothing is stored.
    if (typeof body.website === "string" && body.website.trim()) return { ok: true };
    const input = parse(supportSchema, body);
    await run(app, req, (sql) => sql`
      insert into support_tickets (user_id, email, topic, message)
      values (${req.viewer?.id ?? null}, ${input.email}, ${input.topic}, ${input.message})`);
    return { ok: true };
  });
}
