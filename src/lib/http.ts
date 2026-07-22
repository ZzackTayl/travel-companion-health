const JSON_CONTENT_TYPE = "application/json";

export class RequestBodyError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    readonly code:
      | "INVALID_JSON"
      | "PAYLOAD_TOO_LARGE"
      | "UNSUPPORTED_MEDIA_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function readJsonBody(request: Request, maximumBytes = 16 * 1024) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    throw new RequestBodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new RequestBodyError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body is too large",
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new RequestBodyError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON",
    );
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new RequestBodyError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body is too large",
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new RequestBodyError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON",
    );
  }
}
