// Errors from the API, with its Turkish message and field errors.

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const NETWORK_MESSAGE = "Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.";
export const SERVER_MESSAGE = "Beklenmeyen bir sorun oluştu. Lütfen tekrar dene.";

export async function toApiError(res: Response): Promise<ApiRequestError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; fields?: Record<string, string> } };
    if (body?.error?.message) return new ApiRequestError(res.status, body.error.code ?? "error", body.error.message, body.error.fields);
  } catch {
    // Not JSON (proxy error page, timeout): fall through.
  }
  return new ApiRequestError(res.status, "error", res.status >= 500 ? SERVER_MESSAGE : "İstek tamamlanamadı.");
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return NETWORK_MESSAGE;
}
