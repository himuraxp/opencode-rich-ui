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

/** Tone → theme token mapping for the component accent. */
export function paletteFor(theme: ThemeTokens | undefined, tone: string): ComponentPalette {
  if (!theme) return {};
  const feedback = feedbackColor(theme, tone);
  const palette: { -readonly [K in keyof ComponentPalette]: ComponentPalette[K] } = {};
  const text = theme.text?.base;
  if (isColorValue(text)) palette.text = text;
  const muted = theme.text?.muted;
  if (isColorValue(muted)) palette.muted = muted;
  // Accent carries the tone ONLY through the title: borders use the neutral
  // border token so the accent keeps its role as a visual signal (design
  // review, P0-2). No border token → components inherit the host default.
  if (isColorValue(feedback)) palette.title = feedback;
  if (isColorValue(theme.border)) palette.border = theme.border;
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

/**
 * Normalize a host ColorValue to a CSS color string (SVG/CSS consumers).
 * The host RGBA class exposes its components as NORMALIZED floats through
 * the r/g/b getters (127 → 0.498) — reading them verbatim silently renders
 * black (the contrast bug caught in the Étape-2 review). toInts() returns
 * the true 0-255 components; the fallback path detects normalization and
 * rescales. Strings pass through untouched; anything else → undefined.
 */
export function cssColor(value: ColorValue | undefined): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as unknown as {
    toInts?: () => readonly number[];
    r?: unknown;
    g?: unknown;
    b?: unknown;
    a?: unknown;
  };
  if (typeof candidate.toInts === "function") {
    const ints = candidate.toInts();
    const [r, g, b, a] = ints;
    if (typeof r === "number" && typeof g === "number" && typeof b === "number") {
      return formatColor(r, g, b, typeof a === "number" ? a : 1);
    }
  }
  const { r, g, b } = candidate;
  if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") return undefined;
  const scale = Math.max(r, g, b) <= 1 ? 255 : 1;
  const a = typeof candidate.a === "number" ? candidate.a : 1;
  return formatColor(r * scale, g * scale, b * scale, a);
}

function formatColor(r: number, g: number, b: number, a: number): string {
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
  return a >= 1
    ? `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
    : `rgba(${clamp(r)},${clamp(g)},${clamp(b)},${a})`;
}

