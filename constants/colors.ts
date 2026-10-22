// ── Laviviane "Noir & Ember" identity ──────────────────────────────────────────
// Modern luxury: an ink-black base, crisp neutral stone surfaces and one warm
// signature accent (ember). No gradients, no purple/blue "tech" tones.
// Key names are kept for compatibility (e.g. `gold` is now the ember accent,
// `espresso*` are the ink surfaces) so every screen picks up the new identity.
export const Colors = {
  primary: "#141414",        // ink
  primaryLight: "#2C2C2B",   // graphite
  gold: "#D9602B",           // ember — the single brand accent
  goldLight: "#F2A27A",      // ember on dark surfaces
  accent: "#C8323F",         // crimson (alerts, destructive)
  success: "#1F8A5B",        // emerald
  warning: "#D9971E",        // amber
  info: "#2D6E7E",           // petrol
  purple: "#8C4A5E",         // mulberry (calligraphy)

  background: "#F3F3F1",     // stone
  surface: "#FFFFFF",
  surfaceSecondary: "#ECECE9",

  text: "#141414",
  textSecondary: "#5C5C59",
  textMuted: "#9A9A95",
  textLight: "#FFFFFF",

  border: "#E2E2DE",
  borderLight: "#ECECE8",

  halwa: "#C8743A",          // caramel
  halwaLight: "#EDB98F",
  mawali: "#6B8640",         // olive
  mawaliLight: "#B4C78E",
  chocolate: "#5B3B2B",      // cacao
  chocolateLight: "#A98270",
  cake: "#C9617D",           // framboise
  cakeLight: "#EBA9BA",
  packaging: "#3F6670",      // petrol slate
  packagingLight: "#93B2B9",

  statusPending: "#D9971E",
  statusInProgress: "#2D6E7E",
  statusDone: "#1F8A5B",
  statusCancelled: "#C8323F",

  shadow: "rgba(20, 20, 20, 0.08)",

  // Dark surfaces (headers, hero cards, dark tab bar)
  espressoDeep: "#0D0D0D",
  espressoMid: "#161616",
  espressoSoft: "#232322",
};

/** Brand typography (web loads IBM Plex Sans Arabic as "Laviviane Sans"). */
export const BrandFont = "Laviviane Sans";

/** Shape + depth tokens for a flat, modern look. */
export const Radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export default Colors;
