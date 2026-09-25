// Rate limits (P1-07) are counted in the database (migration 0010) and raised
// as SQLSTATE PT429 with a Turkish message meant for the user.
// No "@/" imports: tested directly with node --test.

type DbError = { code?: string; message: string } | null | undefined;

/** The user-facing message of a rate-limit error, or null for any other error. */
export function rateLimitMessage(error: DbError): string | null {
  return error?.code === "PT429" && error.message ? error.message : null;
}
