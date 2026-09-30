// One error shape for every endpoint:
//   { "error": { "code": "forbidden", "message": "Türkçe açıklama", "fields"?: {…} } }
// Database errors are translated here; their text reaches the user only when
// it is one of our own Turkish messages raised by a trigger or function.
// Stack traces, SQL and constraint names never leave the server.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message = "Geçersiz istek.", fields?: Record<string, string>) =>
  new ApiError(400, "bad_request", message, fields);
export const validation = (message: string, fields?: Record<string, string>) =>
  new ApiError(422, "validation_failed", message, fields);
export const unauthorized = (message = "Devam etmek için giriş yap.", code = "unauthorized") =>
  new ApiError(401, code, message);
export const forbidden = (message = "Bu işlem için yetkin yok.") => new ApiError(403, "forbidden", message);
export const notFound = (message = "Bulunamadı.") => new ApiError(404, "not_found", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
export const tooMany = (message = "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.") =>
  new ApiError(429, "rate_limited", message);

type PgError = { code?: string; message?: string; constraint_name?: string };

function isPgError(e: unknown): e is PgError {
  return typeof e === "object" && e !== null && "code" in e && typeof (e as PgError).code === "string";
}

// Messages written by our own triggers/functions are Turkish sentences; the
// server's built-in ones are English and technical.
function ownMessage(message: string | undefined) {
  return Boolean(message) && /[çğıöşüÇĞİÖŞÜ]/.test(message!) && !/violates|constraint|relation|column/i.test(message!);
}

export function fromDbError(e: unknown): ApiError | null {
  if (!isPgError(e)) return null;
  const { code, message } = e;
  switch (code) {
    case "PT429":
      return new ApiError(429, "rate_limited", ownMessage(message) ? message! : "Çok fazla istek. Biraz bekle.");
    case "PT403":
      return new ApiError(403, "forbidden", ownMessage(message) ? message! : "Bu işlem şu anda yapılamaz.");
    case "42501":
      if (message?.includes("row-level security")) {
        return new ApiError(403, "forbidden", "Bu işlem için yetkin yok ya da hesabın kısıtlı.");
      }
      return new ApiError(403, "forbidden", ownMessage(message) ? message! : "Bu işlem için yetkin yok.");
    case "23514":
      return new ApiError(422, "validation_failed", ownMessage(message) ? message! : "Girdiğin bilgileri kontrol et.");
    case "23505":
      return new ApiError(409, "conflict", "Bu kayıt zaten var.");
    case "23503":
      return new ApiError(422, "validation_failed", "İlgili kayıt bulunamadı.");
    case "23502":
    case "22023":
      return new ApiError(422, "validation_failed", ownMessage(message) ? message! : "Girdiğin bilgileri kontrol et.");
    case "22P02":
    case "22003":
    case "22007":
      return new ApiError(400, "bad_request", "Geçersiz istek.");
    default:
      return null;
  }
}
