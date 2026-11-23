export type ApiErrorKind = "timeout" | "unavailable" | "validation" | "not_found" | "server";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
}

export function messageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.detail === "string") return record.detail;
  if (Array.isArray(record.detail)) {
    const messages = record.detail
      .map((d) => {
        if (!d || typeof d !== "object") return null;
        const item = d as { msg?: unknown; loc?: unknown };
        const field = Array.isArray(item.loc) ? item.loc.at(-1) : null;
        const msg = typeof item.msg === "string" ? item.msg.replace(/^Value error, /, "") : null;
        return msg
          ? typeof field === "string" && field !== "body"
            ? `${field}: ${msg}`
            : msg
          : null;
      })
      .filter(Boolean);
    if (messages.length) return messages.join(". ");
  }
  return null;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export async function request<T>(base: string, path: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), options.timeoutMs);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort);

  let response: Response;
  try {
    response = await fetch(joinUrl(base, path), {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new ApiError("timeout", "The server took too long to answer.");
    }
    throw new ApiError("unavailable", "Couldn't reach the server.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (response.ok) return body as T;

  const message = messageFromBody(body);
  if (response.status === 404) {
    throw new ApiError("not_found", message ?? "That item no longer exists.", 404);
  }
  if (response.status === 400 || response.status === 409 || response.status === 422) {
    throw new ApiError("validation", message ?? "Some details need another look.", response.status);
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new ApiError(
      "unavailable",
      message ?? "The service is temporarily unavailable.",
      response.status,
    );
  }
  throw new ApiError("server", message ?? "Something went wrong on our side.", response.status);
}
