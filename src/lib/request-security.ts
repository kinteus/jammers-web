/** Reject browser cross-origin writes; clients without browser headers remain supported. */
export function isCrossOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
  return request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin !== null && origin !== expected);
}

export class RequestBodyTooLargeError extends Error {}

// Count bytes in the stream, not just the untrusted Content-Length header.
export async function readLimitedJson(request: Request, limit = 16_384): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) throw new RequestBodyTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
