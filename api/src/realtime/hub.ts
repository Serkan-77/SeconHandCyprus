// Realtime delivery over WebSocket (replaces Supabase Realtime).
//
// - The socket is authenticated before anything is sent: by the kie_at cookie
//   during the handshake (only from our own origin, which blocks cross-site
//   WebSocket hijacking) or by an {"type":"auth","token":…} first frame
//   (mobile). Unauthenticated sockets are closed after 10 seconds.
// - Clients cannot subscribe to anything. Each socket belongs to one user and
//   receives only events whose recipient list, computed by the database from
//   the conversation row (0003_realtime.sql), contains that user.
// - Payloads are read with the recipient's own identity, so row level
//   security still applies to what is pushed.
// - Sessions are re-checked every few minutes; a signed-out session's
//   sockets are closed.
import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";
import type { Db } from "../db/pool.ts";
import { withActor } from "../db/pool.ts";

type Conn = { socket: WebSocket; userId: string; sessionId: string; alive: boolean };

type DbEvent =
  | { t: "message"; c: string; id: string; users: string[] }
  | { t: "read"; c: string; at: string; users: string[] }
  | { t: "conversation"; c: string; users: string[] }
  | { t: "notification"; id: string; users: string[] };

const MAX_SOCKETS_PER_USER = 6;

export class RealtimeHub {
  private byUser = new Map<string, Set<Conn>>();
  private timers: NodeJS.Timeout[] = [];
  private unlisten: (() => Promise<void>) | null = null;

  constructor(
    private db: Db,
    private log: FastifyBaseLogger,
  ) {}

  async start() {
    const listener = await this.db.listen("app_events", (payload) => {
      void this.dispatch(payload).catch((error) => this.log.warn({ err: error }, "realtime dispatch failed"));
    });
    this.unlisten = () => listener.unlisten();
    this.timers.push(setInterval(() => this.heartbeat(), 30_000));
    this.timers.push(setInterval(() => void this.recheckSessions().catch(() => {}), 5 * 60_000));
  }

  async stop() {
    this.timers.forEach(clearInterval);
    await this.unlisten?.();
    for (const set of this.byUser.values()) for (const c of set) c.socket.close(1001, "server shutting down");
    this.byUser.clear();
  }

  get connectionCount() {
    let n = 0;
    for (const set of this.byUser.values()) n += set.size;
    return n;
  }

  add(socket: WebSocket, userId: string, sessionId: string) {
    const set = this.byUser.get(userId) ?? new Set<Conn>();
    if (set.size >= MAX_SOCKETS_PER_USER) {
      // Oldest connection makes room for the newest tab.
      const oldest = set.values().next().value;
      if (oldest) {
        oldest.socket.close(4008, "too many connections");
        set.delete(oldest);
      }
    }
    const conn: Conn = { socket, userId, sessionId, alive: true };
    set.add(conn);
    this.byUser.set(userId, set);
    socket.on("pong", () => (conn.alive = true));
    socket.on("close", () => {
      set.delete(conn);
      if (!set.size) this.byUser.delete(userId);
    });
    this.send(conn, { type: "ready" });
  }

  closeSession(sessionId: string) {
    for (const set of this.byUser.values()) {
      for (const c of set) if (c.sessionId === sessionId) c.socket.close(4001, "signed out");
    }
  }

  closeUser(userId: string) {
    for (const c of this.byUser.get(userId) ?? []) c.socket.close(4001, "signed out");
  }

  private send(conn: Conn, data: unknown) {
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(data));
  }

  private heartbeat() {
    for (const set of this.byUser.values()) {
      for (const c of set) {
        if (!c.alive) {
          c.socket.terminate();
          continue;
        }
        c.alive = false;
        c.socket.ping();
      }
    }
  }

  private async recheckSessions() {
    const ids = [...new Set([...this.byUser.values()].flatMap((s) => [...s].map((c) => c.sessionId)))];
    if (!ids.length) return;
    const live = new Set(
      (
        await this.db<{ id: string }[]>`
          select id from auth.sessions where id = any(${ids}::uuid[]) and revoked_at is null and expires_at > now()`
      ).map((r) => r.id),
    );
    for (const id of ids) if (!live.has(id)) this.closeSession(id);
  }

  private async dispatch(raw: string) {
    const event = JSON.parse(raw) as DbEvent;
    const recipients = (event.users ?? []).filter((u) => this.byUser.has(u));
    for (const userId of recipients) {
      const data = await this.payloadFor(event, userId);
      if (!data) continue;
      for (const conn of this.byUser.get(userId) ?? []) this.send(conn, data);
    }
  }

  // Reads the row as the recipient (row level security applies).
  private async payloadFor(event: DbEvent, userId: string) {
    return withActor(this.db, { userId, role: "user" }, async (sql) => {
      switch (event.t) {
        case "message": {
          const [m] = await sql`
            select id, conversation_id, sender_id, body, created_at, read_at from messages where id = ${event.id}`;
          return m ? { type: "message", conversationId: event.c, message: m } : null;
        }
        case "read":
          return { type: "read", conversationId: event.c, at: event.at };
        case "conversation": {
          const [c] = await sql`
            select id, buyer_id, seller_id, buyer_confirmed_at, seller_confirmed_at, meeting_confirmed_at
            from conversations where id = ${event.c}`;
          return c ? { type: "conversation", conversation: c } : null;
        }
        case "notification": {
          const [n] = await sql`
            select id, kind, title, body, link, read_at, created_at from notifications where id = ${event.id}`;
          if (!n) return null;
          return { type: "notification", notification: n };
        }
        default:
          return null;
      }
    });
  }
}
