/**
 * core/schema.ts — Déclarative schema of the `richui` block format.
 *
 * Design rules:
 * - `richui` content is DATA (strict JSON), never code. Agents produce it as plain
 *   Markdown; nothing is evaluated, imported or executed.
 * - Phase 0 ships a single component (`panel`); the union is designed to grow to
 *   metric / table / chart / review without breaking validation.
 */

export const RICHUI_LANGUAGE = "richui" as const;

/** Tone drives the accent color of components; mapped to theme tokens in the adapter. */
export const TONES = ["neutral", "info", "success", "warning", "error"] as const;
export type Tone = (typeof TONES)[number];

/** Phase 0 component set (extensible: metric, table, chart, review). */
export const COMPONENTS = ["panel"] as const;
export type ComponentKind = (typeof COMPONENTS)[number];

export interface PanelSpec {
  readonly component: "panel";
  /** Short heading rendered on the border (single line). */
  readonly title?: string;
  /** Body text, plain (no Markdown). Lines are preserved. */
  readonly body: string;
  /** Accent color semantic. Default: "neutral". */
  readonly tone?: Tone;
}

export type RichuiSpec = PanelSpec;

/**
 * Result of parsing a `richui` block.
 * `ok: false` carries a stable reason for diagnostics and tests; the renderer
 * falls back to the default code-block rendering in that case.
 */
export type ParseResult =
  | { readonly ok: true; readonly spec: RichuiSpec }
  | { readonly ok: false; readonly reason: string };

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as readonly string[]).includes(value);
}

export function isComponentKind(value: unknown): value is ComponentKind {
  return typeof value === "string" && (COMPONENTS as readonly string[]).includes(value);
}
