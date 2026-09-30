// GET /api/v1/ws — the realtime socket. See realtime/hub.ts for the model.
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { ACCESS_COOKIE } from "../http/context.ts";

const AUTH_TIMEOUT_MS = 10_000;

export async function realtimeRoutes(app: FastifyInstance) {
  const { db, signer, hub, config } = app.deps;

  async function authenticate(token: string | undefined) {
    if (!token) return null;
    const claims = await signer.verify(token);
    if (claims === "expired" || claims === "invalid") return null;
    const [row] = await db`
      select 1 from auth.sessions where id = ${claims.sid} and user_id = ${claims.sub} and revoked_at is null and expires_at > now()`;
    return row ? claims : null;
  }

  app.get("/api/v1/ws", { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
    let done = false;
    const accept = (claims: { sub: string; sid: string }) => {
      done = true;
      clearTimeout(timer);
      hub.add(socket, claims.sub, claims.sid);
    };
    const timer = setTimeout(() => {
      if (!done) socket.close(4401, "authentication required");
    }, AUTH_TIMEOUT_MS);

    // Cookie authentication only for our own pages: browsers attach cookies
    // to WebSocket handshakes from any site (cross-site WebSocket hijacking).
    const origin = req.headers.origin;
    const cookieToken = typeof origin === "string" && config.allowedOrigins.has(origin) ? req.cookies[ACCESS_COOKIE] : undefined;
    if (cookieToken) {
      void authenticate(cookieToken).then((claims) => (claims ? accept(claims) : socket.close(4401, "authentication failed")));
    }

    socket.on("message", (raw) => {
      let msg: { type?: string; token?: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
      } else if (msg.type === "auth" && !done && !cookieToken) {
        void authenticate(msg.token).then((claims) => (claims ? accept(claims) : socket.close(4401, "authentication failed")));
      }
    });
    socket.on("close", () => clearTimeout(timer));
  });
}
