/**
 * core/parse.ts — Parse, validate and normalise the content of a `richui` block.
 *
 * The parser is total: it never throws. Every failure path returns `ParseFailure`
 * with a human-readable reason, so the adapter can fall back to the default
 * code-block rendering without any risk of crashing the markdown renderer.
 *
 * Normalisation performed here (so components only see clean data):
 * - text fields: CRLF → LF, escape sequences stripped, tabs → 2 spaces,
 *   right-trimmed, single line for scalar fields, hard-capped.
 * - `tone`: lowercased, invalid → undefined (caller default applies).
 * - `metric.value`/`delta` and table cells: JSON numbers/booleans are coerced
 *   to strings (agents naturally emit raw numbers); anything else fails.
 */

import {
  isComponentKind,
  isTone,
  type ParseResult,
  type RichuiSpec,
  type TableSpec,
  type Tone,
} from "./schema.ts";

/** Hard cap for scalar headings (title, metric label); layout may clamp further. */
export const MAX_TITLE_CHARS = 80;
/** Hard cap for the panel body: guard against pathological agent output. */
export const MAX_BODY_LINES = 200;
export const MAX_BODY_LINE_CHARS = 2000;
/** Hard caps for metric scalars. */
export const MAX_METRIC_VALUE_CHARS = 80;
export const MAX_METRIC_DELTA_CHARS = 40;
/** Hard caps for tables. */
export const MAX_TABLE_COLUMNS = 8;
export const MAX_TABLE_ROWS = 200;
export const MAX_CELL_CHARS = 500;

const MAX_CONTENT_OCTETS = 64 * 1024;

/** ANSI CSI/OSC sequences + C0 controls except \n (tabs are expanded to spaces). */
const ESCAPE_SEQUENCE = /\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Neutralise escape sequences so layout measurement and painting stay honest.
 * CRLF (and bare CR) → LF first, so every consumer splits on \n only. */
function sanitize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(ESCAPE_SEQUENCE, "");
}

export function parseRichui(raw: string): ParseResult {
  const octets = new TextEncoder().encode(raw).length;
  if (octets > MAX_CONTENT_OCTETS) {
    return fail(`content too large (${octets} octets, max ${MAX_CONTENT_OCTETS})`);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch (error) {
    return fail(`invalid JSON: ${(error as Error).message}`);
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("expected a JSON object");
  }
  const record = value as Record<string, unknown>;

  const component = record["component"];
  if (!isComponentKind(component)) {
    return fail(`unknown or missing "component" (expected one of: ${COMPONENT_NAMES})`);
  }

  switch (component) {
    case "panel":
      return parsePanel(record);
    case "metric":
      return parseMetric(record);
    case "table":
      return parseTable(record);
  }
}

const COMPONENT_NAMES = "panel, metric, table";

function parsePanel(record: Record<string, unknown>): ParseResult {
  const body = coerceText(record["body"]);
  if (body === undefined || body.trim().length === 0) {
    return fail(`panel requires a non-empty string "body"`);
  }

  const spec: RichuiSpec = {
    component: "panel",
    body: normalizeBody(sanitize(body)),
    ...(hasNonEmptyString(record, "title")
      ? { title: normalizeTitle(sanitize(record["title"] as string)) }
      : {}),
  };
  return withTone(spec, record);
}

function parseMetric(record: Record<string, unknown>): ParseResult {
  const value = coerceText(record["value"]);
  if (value === undefined || value.trim().length === 0) {
    return fail(`metric requires a non-empty "value" (string or number)`);
  }

  const spec: RichuiSpec = {
    component: "metric",
    value: normalizeSingleLine(sanitize(value), MAX_METRIC_VALUE_CHARS),
    ...(hasNonEmptyString(record, "label")
      ? { label: normalizeTitle(sanitize(record["label"] as string)) }
      : {}),
  };

  if (record["delta"] !== undefined) {
    const delta = coerceText(record["delta"]);
    if (delta === undefined) {
      return fail(`metric "delta" must be a string or number`);
    }
    if (delta.trim().length > 0) {
      (spec as { delta?: string }).delta = normalizeSingleLine(
        sanitize(delta),
        MAX_METRIC_DELTA_CHARS,
      );
    }
  }
  return withTone(spec, record);
}

function parseTable(record: Record<string, unknown>): ParseResult {
  const rawColumns = record["columns"];
  if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
    return fail(`table requires a non-empty "columns" array`);
  }
  if (rawColumns.length > MAX_TABLE_COLUMNS) {
    return fail(`table supports at most ${MAX_TABLE_COLUMNS} columns (got ${rawColumns.length})`);
  }

  const columns: string[] = [];
  for (let i = 0; i < rawColumns.length; i++) {
    const header = coerceText(rawColumns[i]);
    if (header === undefined) {
      return fail(`table column ${i + 1} must be a string`);
    }
    columns.push(normalizeCell(sanitize(header)));
  }

  const rawRows = record["rows"];
  if (!Array.isArray(rawRows)) {
    return fail(`table requires a "rows" array`);
  }

  const rows: string[][] = [];
  for (let r = 0; r < rawRows.length && r < MAX_TABLE_ROWS; r++) {
    const rawRow = rawRows[r];
    if (!Array.isArray(rawRow)) {
      return fail(`table row ${r + 1} must be an array of cells`);
    }
    if (rawRow.length !== columns.length) {
      return fail(
        `table row ${r + 1} has ${rawRow.length} cell(s), expected ${columns.length}`,
      );
    }
    const cells: string[] = [];
    for (let c = 0; c < rawRow.length; c++) {
      const cell = coerceText(rawRow[c]);
      if (cell === undefined) {
        return fail(`table row ${r + 1} cell ${c + 1} must be a string, number or boolean`);
      }
      cells.push(normalizeCell(sanitize(cell)));
    }
    rows.push(cells);
  }

  const truncatedRows = rawRows.length > MAX_TABLE_ROWS ? rawRows.length - MAX_TABLE_ROWS : 0;

  const spec: TableSpec = {
    component: "table",
    columns,
    rows,
    ...(hasNonEmptyString(record, "title")
      ? { title: normalizeTitle(sanitize(record["title"] as string)) }
      : {}),
    ...(truncatedRows > 0 ? { truncatedRows } : {}),
  };
  return withTone(spec, record);
}

/** JSON strings, finite numbers and booleans are acceptable scalar text. */
function coerceText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

/** Helpers: optional single-line string fields, present only when non-empty. */
function hasNonEmptyString(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTitle(title: string): string {
  return normalizeSingleLine(title, MAX_TITLE_CHARS);
}

/** Collapse to one line and hard-cap with an ellipsis. */
function normalizeSingleLine(text: string, maxChars: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > maxChars ? collapsed.slice(0, maxChars - 1) + "…" : collapsed;
}

function normalizeCell(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_CELL_CHARS ? trimmed.slice(0, MAX_CELL_CHARS - 1) + "…" : trimmed;
}

function withTone(spec: RichuiSpec, record: Record<string, unknown>): ParseResult {
  const tone = hasTone(record) ? normalizeTone(record) : undefined;
  return tone === undefined
    ? { ok: true, spec }
    : { ok: true, spec: { ...spec, tone } as RichuiSpec };
}

function hasTone(record: Record<string, unknown>): boolean {
  return record["tone"] !== undefined;
}

function normalizeTone(record: Record<string, unknown>): Tone | undefined {
  const tone = record["tone"];
  if (typeof tone !== "string") return undefined;
  const lowered = tone.toLowerCase();
  return isTone(lowered) ? lowered : undefined;
}

function normalizeBody(body: string): string {
  const lines = body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmedRight = line.replace(/[ \t]+$/, "");
      return trimmedRight.length > MAX_BODY_LINE_CHARS
        ? trimmedRight.slice(0, MAX_BODY_LINE_CHARS - 1) + "…"
        : trimmedRight;
    });

  while (lines.length > 0 && lines[lines.length - 1]?.length === 0) lines.pop();

  if (lines.length > MAX_BODY_LINES) {
    const kept = lines.slice(0, MAX_BODY_LINES);
    kept.push(`… (${lines.length - MAX_BODY_LINES} more lines truncated)`);
    return kept.join("\n");
  }
  return lines.join("\n");
}

function fail(reason: string): ParseResult {
  return { ok: false, reason };
}
