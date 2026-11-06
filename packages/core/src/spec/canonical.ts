/**
 * Canonical form and content hash of a spec object (FMT-122): JSON with RFC 8785 (JSON Canonicalization Scheme)
 * ordering, then SHA-256. Used to detect real changes (history, VER-001) and, later, outdated approvals (MM-700).
 * Web Crypto only, so the same code runs in the browser, the server and the CLI.
 */

/** RFC 8785: object keys sorted by UTF-16 code units, no whitespace, numbers as ECMAScript prints them. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("A spec value cannot be NaN or infinite.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  throw new Error(`Unsupported value in a spec: ${typeof value}`);
}

/** SHA-256 of the canonical form, as `sha256:<hex>`. */
export async function contentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
