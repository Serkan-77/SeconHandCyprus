// PostgreSQL access. Every request runs its queries in one transaction that
// first tells the database who is calling (app.user_id, app.role), so row
// level security and the guard triggers apply exactly as they did on
// Supabase. Queries are tagged templates: values are always sent as
// parameters, never concatenated into SQL.
import postgres from "postgres";

export type Db = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;
export type Sql = Db | Tx;

/** Who the database should treat as the caller. 'system' is trusted server code only. */
export type Actor = { userId: string | null; role: "anon" | "user" | "system" };

export const ANON: Actor = { userId: null, role: "anon" };
export const SYSTEM: Actor = { userId: null, role: "system" };

export function createDb(url: string, max = 10): Db {
  return postgres(url, {
    max,
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    onnotice: () => {},
    transform: { ...postgres.camel, undefined: null },
    types: {
      // numeric (prices) and bigint (ref_no, counts) as JS numbers: every
      // value in this schema is far below 2^53.
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
    connection: { application_name: "kie-api" },
  }) as unknown as Db;
}

/** Runs fn in a transaction as `actor`. */
export async function withActor<T>(db: Db, actor: Actor, fn: (sql: Tx) => Promise<T>): Promise<T> {
  return (await db.begin(async (sql) => {
    await sql`select set_config('app.user_id', ${actor.userId ?? ""}, true), set_config('app.role', ${actor.role}, true)`;
    return fn(sql as Tx);
  })) as T;
}
