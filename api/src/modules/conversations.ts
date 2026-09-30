// /api/v1/conversations — buyer/seller messaging, two-sided meeting
// confirmation and ratings. Row level security limits every read and write
// to the two participants; the triggers keep identities, timestamps and each
// side's confirmation tamper-proof (0001_baseline.sql).
import type { FastifyInstance } from "fastify";
import { SYSTEM, withActor, type Tx } from "../db/pool.ts";
import { ApiError, conflict, forbidden, notFound, validation } from "../lib/errors.ts";
import { requireViewer } from "../http/context.ts";
import { imageUrls } from "../storage/images.ts";
import { messageSchema, ratingSchema } from "../../../shared/schemas.ts";
import { parse, publicName, run, uuidParam } from "./common.ts";

export const CHAT_PAGE_SIZE = 50;

type ConversationRow = {
  id: string;
  listingId: string | null;
  buyerId: string | null;
  sellerId: string | null;
  buyerConfirmedAt: Date | null;
  sellerConfirmedAt: Date | null;
  meetingConfirmedAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  otherId: string | null;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  otherAccountType: string | null;
  otherStoreName: string | null;
  lastBody: string | null;
  lastSenderId: string | null;
  lastCreatedAt: Date | null;
  unread: number;
  iBlocked: boolean;
  blockedMe: boolean;
  rated: boolean;
};

const CONVERSATION_SELECT = (sql: Tx, me: string) => sql`
  select c.id, c.listing_id, c.buyer_id, c.seller_id, c.buyer_confirmed_at, c.seller_confirmed_at,
         c.meeting_confirmed_at, c.last_message_at, c.created_at,
         o.id as other_id, o.display_name as other_display_name, o.avatar_url as other_avatar_url,
         o.account_type as other_account_type, o.store_name as other_store_name,
         lm.body as last_body, lm.sender_id as last_sender_id, lm.created_at as last_created_at,
         (select count(*)::int from messages m
            where m.conversation_id = c.id and m.read_at is null and m.sender_id is distinct from ${me}) as unread,
         exists (select 1 from blocks b where b.blocker_id = ${me} and b.blocked_id = o.id) as i_blocked,
         public.is_blocked_between(${me}, o.id) and not exists (select 1 from blocks b where b.blocker_id = ${me} and b.blocked_id = o.id) as blocked_me,
         exists (select 1 from ratings r where r.conversation_id = c.id and r.rater_id = ${me}) as rated
  from conversations c
  left join profiles o on o.id = case when c.buyer_id = ${me} then c.seller_id else c.buyer_id end
  left join lateral (
    select m.body, m.sender_id, m.created_at from messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm on true`;

type ListingSummary = { id: string; title: string; slug: string; price: number; currency: string; status: string; imageKey: string | null };

// Participants may always see what their conversation is about, even after
// the listing was sold or hidden; read as system, summary fields only, and
// only for listings of conversations the caller was allowed to read.
async function listingSummaries(app: FastifyInstance, ids: string[]) {
  if (!ids.length) return new Map<string, ListingSummary>();
  const rows = await withActor(app.deps.db, SYSTEM, (sql) => sql<ListingSummary[]>`
    select l.id, l.title, l.slug, l.price, l.currency, l.status,
           (select i.path from listing_images i where i.listing_id = l.id order by i.position limit 1) as image_key
    from listings l where l.id = any(${ids}::uuid[])`);
  return new Map(rows.map((r) => [r.id, r]));
}

function present(app: FastifyInstance, row: ConversationRow, me: string, listing: ListingSummary | undefined) {
  const media = app.deps.config.MEDIA_URL;
  const role = row.buyerId === me ? "buyer" : "seller";
  const mine = role === "buyer" ? row.buyerConfirmedAt : row.sellerConfirmedAt;
  const theirs = role === "buyer" ? row.sellerConfirmedAt : row.buyerConfirmedAt;
  const otherGone = !row.otherId;
  return {
    id: row.id,
    role,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    unread: row.unread,
    lastMessage: row.lastCreatedAt
      ? { body: row.lastBody, mine: row.lastSenderId === me, createdAt: row.lastCreatedAt }
      : null,
    other: otherGone
      ? null
      : {
          id: row.otherId,
          name: publicName({ accountType: row.otherAccountType, storeName: row.otherStoreName, displayName: row.otherDisplayName }),
          avatar: imageUrls(media, row.otherAvatarUrl),
          isStore: row.otherAccountType === "store",
        },
    listing: listing
      ? {
          id: listing.id,
          title: listing.title,
          slug: listing.slug,
          price: listing.price,
          currency: listing.currency,
          status: listing.status,
          image: imageUrls(media, listing.imageKey),
        }
      : null,
    meeting: {
      mine: Boolean(mine),
      theirs: Boolean(theirs),
      confirmedAt: row.meetingConfirmedAt,
    },
    rated: row.rated,
    iBlocked: row.iBlocked,
    blockedMe: row.blockedMe,
    canSend: !otherGone && !row.iBlocked && !row.blockedMe,
  };
}

export async function conversationRoutes(app: FastifyInstance) {
  app.get("/conversations", async (req) => {
    const v = requireViewer(req);
    const q = String((req.query as { q?: string }).q ?? "").trim().slice(0, 60);
    const rows = await run(app, req, (sql) => sql<ConversationRow[]>`
      ${CONVERSATION_SELECT(sql, v.id)}
      where ${v.id} in (c.buyer_id, c.seller_id)
      order by c.last_message_at desc
      limit 200`);
    const listings = await listingSummaries(app, rows.map((r) => r.listingId).filter((x): x is string => Boolean(x)));
    let items = rows.map((r) => present(app, r, v.id, r.listingId ? listings.get(r.listingId) : undefined));
    if (q) {
      const needle = q.toLocaleLowerCase("tr-TR");
      items = items.filter(
        (c) =>
          c.listing?.title.toLocaleLowerCase("tr-TR").includes(needle) ||
          c.other?.name?.toLocaleLowerCase("tr-TR").includes(needle),
      );
    }
    return { conversations: items };
  });

  app.post("/conversations", async (req) => {
    const v = requireViewer(req);
    const listingId = uuidParam((req.body as { listingId?: string } | undefined)?.listingId);
    return run(app, req, async (sql) => {
      const [listing] = await sql<{ sellerId: string; status: string }[]>`select seller_id, status from listings where id = ${listingId}`;
      if (!listing) throw notFound("İlan bulunamadı.");
      if (listing.sellerId === v.id) throw validation("Kendi ilanına mesaj gönderemezsin.");
      const [existing] = await sql<{ id: string }[]>`
        select id from conversations where listing_id = ${listingId} and buyer_id = ${v.id}`;
      if (existing) return { id: existing.id, created: false };
      if (listing.status !== "active") throw validation("Bu ilan artık yayında değil, yeni konuşma başlatılamaz.");
      try {
        const [created] = await sql<{ id: string }[]>`
          insert into conversations (listing_id, buyer_id, seller_id)
          values (${listingId}, ${v.id}, ${listing.sellerId}) returning id`;
        return { id: created.id, created: true };
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "23505") throw conflict("Bu ilan için zaten bir konuşman var. Sayfayı yenile.");
        if (code === "42501") throw forbidden("Şu anda bu satıcıyla konuşma başlatılamıyor. Hesabın kısıtlı olabilir.");
        throw e;
      }
    });
  });

  async function loadConversation(sql: Tx, id: string, me: string) {
    const [row] = await sql<ConversationRow[]>`${CONVERSATION_SELECT(sql, me)} where c.id = ${id}`;
    // Row level security returns nothing for non-participants: same answer as a missing id.
    if (!row || (row.buyerId !== me && row.sellerId !== me)) throw notFound("Konuşma bulunamadı.");
    return row;
  }

  app.get("/conversations/:id", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const row = await run(app, req, (sql) => loadConversation(sql, id, v.id));
    const listings = await listingSummaries(app, row.listingId ? [row.listingId] : []);
    return { conversation: present(app, row, v.id, row.listingId ? listings.get(row.listingId) : undefined) };
  });

  app.get("/conversations/:id/messages", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const query = req.query as { before?: string; beforeId?: string; limit?: string };
    const limit = Math.min(100, Math.max(1, Number(query.limit) || CHAT_PAGE_SIZE));
    const before = query.before && !Number.isNaN(Date.parse(query.before)) && query.beforeId ? { at: query.before, id: uuidParam(query.beforeId) } : null;
    return run(app, req, async (sql) => {
      await loadConversation(sql, id, v.id);
      // Newest first with one extra row to know whether older ones remain (keyset paging).
      const rows = await sql<{ id: string; senderId: string | null; body: string; createdAt: Date; readAt: Date | null }[]>`
        select id, sender_id, body, created_at, read_at from messages
        where conversation_id = ${id}
          ${before ? sql`and (created_at, id) < (${before.at}::timestamptz, ${before.id}::uuid)` : sql``}
        order by created_at desc, id desc
        limit ${limit + 1}`;
      return { messages: rows.slice(0, limit).reverse(), hasMore: rows.length > limit };
    });
  });

  app.post("/conversations/:id/messages", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const body = parse(messageSchema, (req.body as { body?: unknown } | undefined)?.body);
    return run(app, req, async (sql) => {
      const convo = await loadConversation(sql, id, v.id);
      if (!convo.otherId) throw new ApiError(403, "recipient_gone", "Bu kullanıcı hesabını silmiş; mesaj gönderilemez.");
      if (convo.iBlocked || convo.blockedMe) throw new ApiError(403, "blocked", "Bu kullanıcıyla mesajlaşma engellendi.");
      try {
        const [message] = await sql<{ id: string; senderId: string; body: string; createdAt: Date; readAt: Date | null }[]>`
          insert into messages (conversation_id, sender_id, body) values (${id}, ${v.id}, ${body})
          returning id, sender_id, body, created_at, read_at`;
        return { message };
      } catch (e) {
        if ((e as { code?: string }).code === "42501") {
          throw forbidden("Mesaj gönderilemedi. Hesabın kısıtlı olabilir.");
        }
        throw e;
      }
    });
  });

  app.post("/conversations/:id/read", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    await run(app, req, async (sql) => {
      await loadConversation(sql, id, v.id);
      await sql`
        update messages set read_at = now()
        where conversation_id = ${id} and sender_id is distinct from ${v.id} and read_at is null`;
      await sql`
        update notifications set read_at = now()
        where user_id = ${v.id} and link = ${`/mesajlar?c=${id}`} and read_at is null`;
    });
    return { ok: true };
  });

  app.post("/conversations/:id/meeting", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    return run(app, req, async (sql) => {
      const convo = await loadConversation(sql, id, v.id);
      const column = convo.buyerId === v.id ? sql`buyer_confirmed_at` : sql`seller_confirmed_at`;
      // The trigger stamps the server time and fills meeting_confirmed_at when both sides are in.
      const [row] = await sql<{ meetingConfirmedAt: Date | null }[]>`
        update conversations set ${column} = now() where id = ${id} returning meeting_confirmed_at`;
      if (!row) throw forbidden("Buluşma onaylanamadı.");
      return { ok: true, bothConfirmed: Boolean(row.meetingConfirmedAt) };
    });
  });

  app.post("/conversations/:id/rating", async (req) => {
    const v = requireViewer(req);
    const id = uuidParam((req.params as { id: string }).id);
    const input = parse(ratingSchema, req.body);
    return run(app, req, async (sql) => {
      const convo = await loadConversation(sql, id, v.id);
      if (!convo.otherId) throw validation("Bu kullanıcı hesabını silmiş.");
      if (convo.rated) throw conflict("Bu buluşma için zaten değerlendirme yaptın.");
      if (!convo.buyerConfirmedAt || !convo.sellerConfirmedAt) {
        throw forbidden("Değerlendirme için iki tarafın da buluşmayı onaylaması gerekiyor.");
      }
      await sql`
        insert into ratings (rater_id, ratee_id, conversation_id, score, comment)
        values (${v.id}, ${convo.otherId}, ${id}, ${input.score}, ${input.comment})`;
      return { ok: true };
    });
  });
}
