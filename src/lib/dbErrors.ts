// Rate limits (P1-07) are counted in the database (migration 0010) and raised
// as SQLSTATE PT429 with a Turkish message meant for the user.
// No "@/" imports: tested directly with node --test.

type DbError = { code?: string; message: string } | null | undefined;

/** The user-facing message of a rate-limit error, or null for any other error. */
export function rateLimitMessage(error: DbError): string | null {
  return error?.code === "PT429" && error.message ? error.message : null;
}

/** Messages for a refused report (P1-08, migration 0011), or null for any other error. */
export function reportErrorMessage(error: DbError): string | null {
  if (error?.code === "23505") return "Bunu zaten şikayet ettin; ekibimiz inceliyor.";
  // Own listing / yourself / listing not published: the trigger's message is for the user.
  if (error?.code === "23514" && error.message && !error.message.includes("violates check constraint")) return error.message;
  return rateLimitMessage(error);
}

/** The message of a refused account deletion while restricted (0011), or null. */
export function accountDeletionMessage(error: DbError): string | null {
  return error?.code === "PT403" && error.message ? error.message : null;
}
