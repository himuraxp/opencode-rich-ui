/**
 * core/schema.ts — Déclarative schema of the `richui` block format.
 *
 * Design rules:
 * - `richui` content is DATA (strict JSON), never code. Agents produce it as plain
 *   Markdown; nothing is evaluated, imported or executed.
 * - Phase 0 shipped `panel`; Lot 1 adds `metric` and `table`. The union grows
 *   without breaking validation (unknown component → clean parse failure).
 */

export const RICHUI_LANGUAGE = "richui" as const;

/** Tone drives the accent color of components; mapped to theme tokens in the adapter. */
export const TONES = ["neutral", "info", "success", "warning", "error"] as const;
export type Tone = (typeof TONES)[number];

/** Component set (extensible: chart, review). */
export const COMPONENTS = ["panel", "metric", "table"] as const;
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

export interface MetricSpec {
  readonly component: "metric";
  /** Short label (border title when bordered, first line when compact). */
  readonly label?: string;
  /** The measured value itself — rendered in the accent color. */
  readonly value: string;
  /** Change indicator; a leading +/- is rendered as an up/down arrow. */
  readonly delta?: string;
  readonly tone?: Tone;
}

export interface TableSpec {
  readonly component: "table";
  /** Header names, 1..MAX_TABLE_COLUMNS (JSON numbers/booleans are coerced to strings). Cell count of every row must match. */
  readonly columns: readonly string[];
  /** Data rows (strings; numbers/booleans are coerced by the parser). */
  readonly rows: readonly (readonly string[])[];
  readonly title?: string;
  readonly tone?: Tone;
  /** Set by the parser when rows were dropped beyond MAX_TABLE_ROWS. */
  readonly truncatedRows?: number;
}

export type RichuiSpec = PanelSpec | MetricSpec | TableSpec;

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
