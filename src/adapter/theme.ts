/**
 * adapter/theme.ts — Defensive access to OpenCode theme tokens.
 *
 * `api.theme` exposes the host's reactive token tree. Token names have been
 * verified on the 2.0.30 runtime (text.base, text.muted, …), but components
 * must degrade gracefully on unknown themes: every accessor validates
 * structurally (string, or {r,g,b} numeric — the host's RGBA shape) and the
 * component falls back to sensible defaults (inherit / no color) rather than
 * throwing. NOTE: `instanceof` against our npm RGBA copy would REJECT host
 * instances (different module identity) — structural checks only.
 */

import type { ColorValue, ThemeTokens } from "./opencode-api.ts";

/** Shared palette for components (title accent, text, muted, border). */
export interface ComponentPalette {
  readonly title?: ColorValue;
  readonly text?: ColorValue;
  readonly muted?: ColorValue;
  readonly border?: ColorValue;
}

/** Tone → theme token mapping for the panel accent. */
export function paletteFor(theme: ThemeTokens | undefined, tone: string): ComponentPalette {
  if (!theme) return {};
  const feedback = feedbackColor(theme, tone);
  const palette: { -readonly [K in keyof ComponentPalette]: ComponentPalette[K] } = {};
  const text = theme.text?.base;
  if (isColorValue(text)) palette.text = text;
  const muted = theme.text?.muted;
  if (isColorValue(muted)) palette.muted = muted;
  if (isColorValue(feedback)) {
    palette.title = feedback;
    palette.border = feedback;
  }
  return palette;
}

/**
 * Semantic tones map to the theme's feedback tokens when available.
 * Unknown/neutral tones return undefined → components inherit defaults.
 */
function feedbackColor(theme: ThemeTokens, tone: string): ColorValue | undefined {
  const text = theme.text as Record<string, unknown> | undefined;
  if (!text) return undefined;
  const feedback = text["feedback"] as Record<string, Record<string, unknown>> | undefined;
  if (!feedback) return undefined;
  const branch = feedback[tone] as Record<string, unknown> | undefined;
  return branch?.["base"] as ColorValue | undefined;
}

/** Structural color check: non-empty string, or host RGBA shape {r,g,b numeric}. */
function isColorValue(value: unknown): value is ColorValue {
  if (typeof value === "string") return value.length > 0;
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["r"] === "number" &&
    typeof record["g"] === "number" &&
    typeof record["b"] === "number"
  );
}

