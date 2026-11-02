const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

/** Escape a value for safe interpolation into an HTML template. */
export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Deep-copy a plain object with every string escaped for HTML. Use before
 * building print templates from user-entered data (names, notes, addresses).
 */
export function escapeDeep<T>(value: T): T {
  if (typeof value === "string") return escapeHtml(value) as unknown as T;
  if (Array.isArray(value)) return value.map(escapeDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = escapeDeep(v);
    return out as T;
  }
  return value;
}
