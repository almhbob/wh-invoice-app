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

/** Repairs an `events` timeline that an older build stored as a map instead of an array. */
export function normalizeEvents<E extends { at: string }>(raw: unknown): E[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.filter((e) => e && typeof e === "object" && typeof (e as E).at === "string") as E[];
  if (typeof raw === "object") {
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) return normalizeEvents<E>(v);
    }
  }
  return [];
}
