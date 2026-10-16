/**
 * core/parse.ts — Parse, validate and normalise the content of a `richui` block.
 *
 * The parser is total: it never throws. Every failure path returns `ParseFailure`
 * with a human-readable reason, so the adapter can fall back to the default
 * code-block rendering without any risk of crashing the markdown renderer.
 *
 * Normalisation performed here (so components only see clean data):
 * - `body`: CRLF → LF, trailing blank lines removed, lines trimmed on the right.
 * - `title`: collapsed whitespace, single line, hard-capped (see MAX_TITLE_CHARS).
 * - `tone`: lowercased, invalid → undefined (caller default applies).
 */

import { isComponentKind, isTone, type ParseResult, type RichuiSpec, type Tone } from "./schema.ts";

/** Hard cap for the title after normalisation; layout may clamp further to width. */
export const MAX_TITLE_CHARS = 80;
/** Hard cap for the body: guard against pathological agent output. */
export const MAX_BODY_LINES = 200;
export const MAX_BODY_LINE_CHARS = 2000;

const MAX_CONTENT_OCTETS = 64 * 1024;

/** ANSI CSI/OSC sequences + C0 controls except \n (tabs are expanded to spaces). */
const ESCAPE_SEQUENCE = /\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Neutralise escape sequences so layout measurement and painting stay honest. */
function sanitize(text: string): string {
  return text.replace(/\t/g, "  ").replace(ESCAPE_SEQUENCE, "");
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
    return fail(`unknown or missing "component" (expected one of: panel)`);
  }

  switch (component) {
    case "panel":
      return parsePanel(record);
  }
}

function parsePanel(record: Record<string, unknown>): ParseResult {
  const body = record["body"];
  if (typeof body !== "string" || body.trim().length === 0) {
    return fail(`panel requires a non-empty string "body"`);
  }

  const spec: RichuiSpec = {
    component: "panel",
    body: normalizeBody(sanitize(body)),
    ...(hasTitle(record) ? { title: normalizeTitle(sanitize(record["title"] as string)) } : {}),
  };
  const tone = hasTone(record) ? normalizeTone(record) : undefined;
  return tone === undefined
    ? { ok: true, spec }
    : { ok: true, spec: { ...spec, tone } };
}

function hasTitle(record: Record<string, unknown>): boolean {
  return typeof record["title"] === "string" && record["title"].trim().length > 0;
}

function hasTone(record: Record<string, unknown>): boolean {
  return record["tone"] !== undefined;
}

function normalizeTitle(title: string): string {
  const collapsed = title.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_TITLE_CHARS
    ? collapsed.slice(0, MAX_TITLE_CHARS - 1) + "…"
    : collapsed;
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
