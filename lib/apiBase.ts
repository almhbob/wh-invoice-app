export const PRODUCTION_API_BASE = "https://fotra-dv1.pages.dev";
export const STAGING_API_BASE = "https://fotra-staging.pages.dev";

export function resolveApiBase(input: {
  platform: string;
  appEnv?: string;
  apiBase?: string;
  legacyApiUrl?: string;
  webOrigin?: string;
}) {
  if (input.platform === "web") return input.webOrigin ?? "";

  const explicitBase = (input.apiBase || input.legacyApiUrl || "").trim().replace(/\/+$/, "");
  const isStaging = input.appEnv?.trim().toLowerCase() === "staging";
  if (isStaging) {
    // Do not let a copied/default production URL silently override staging mode.
    return !explicitBase || explicitBase === PRODUCTION_API_BASE ? STAGING_API_BASE : explicitBase;
  }
  return explicitBase || PRODUCTION_API_BASE;
}
