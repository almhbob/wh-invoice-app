// Shared by the app and tests: no React Native imports here.

/** Firestore rejects `undefined` anywhere (even inside arrays/maps) — strip it recursively. */
export function deepClean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => deepClean(v)).filter((v) => v !== undefined) as unknown as T;
  // Only plain objects are rebuilt. Firestore sentinels (arrayUnion, serverTimestamp,
  // Timestamp…) are class instances and must reach the SDK untouched — copying them
  // into a plain map silently corrupted `events` and broke later status updates.
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = deepClean(v);
    }
    return out as T;
  }
  return value;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
