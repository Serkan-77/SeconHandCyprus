// Account deletion (P1-09): the database removes the account's rows
// (delete_my_account, migration 0012) but SQL cannot delete Storage files, so
// the account's photos and avatar are removed here first, with the user's own
// session (Storage policies allow deleting files in one's own folder only).
// No "@/" imports: tested directly with node --test.
import { accountDeletionMessage } from "./dbErrors.ts";

type DbError = { code?: string; message: string } | null;
type Bucket = {
  list(path: string, options: { limit: number; offset: number }): Promise<{ data: { name: string }[] | null; error: DbError }>;
  remove(paths: string[]): Promise<{ error: DbError }>;
};
export type DeletionClient = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: DbError }>;
  storage: { from(bucket: string): Bucket };
};

/** Buckets whose "<user id>/" folder belongs to the user (src/lib/upload.ts). */
export const USER_BUCKETS = ["listing-images", "avatars"] as const;
const PAGE = 100;
const MAX_PAGES = 50;

export const RESTRICTED_MESSAGE = "Hesabın kısıtlıyken silinemez. İtiraz için destek talebi oluşturabilirsin.";

/** Removes every file under "<userId>/" in the user's buckets. */
export async function removeOwnFiles(client: DeletionClient, userId: string): Promise<{ removed: number; error?: string }> {
  let removed = 0;
  for (const bucket of USER_BUCKETS) {
    const store = client.storage.from(bucket);
    // Removing shifts the listing, so always read the first page again.
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await store.list(userId, { limit: PAGE, offset: 0 });
      if (error) return { removed, error: error.message };
      if (!data?.length) break;
      const { error: removeError } = await store.remove(data.map((f) => `${userId}/${f.name}`));
      if (removeError) return { removed, error: removeError.message };
      removed += data.length;
      if (data.length < PAGE) break;
    }
  }
  return { removed };
}

/**
 * Deletes the signed-in user's account: refuses while restricted (the
 * database checks again), removes their Storage files, then the rows.
 */
export async function deleteOwnAccount(client: DeletionClient, userId: string): Promise<{ ok?: true; error?: string }> {
  const { data: sanctioned, error: checkError } = await client.rpc("is_sanctioned", { p_user: userId });
  if (checkError) return { error: "Hesap silinemedi. Lütfen tekrar dene." };
  if (sanctioned) return { error: RESTRICTED_MESSAGE };
  const files = await removeOwnFiles(client, userId);
  if (files.error) return { error: "Fotoğrafların silinemedi, hesabın silinmedi. Lütfen tekrar dene." };
  const { error } = await client.rpc("delete_my_account");
  if (error) return { error: accountDeletionMessage(error) ?? "Hesap silinemedi. Destek ekibiyle iletişime geç." };
  return { ok: true };
}
