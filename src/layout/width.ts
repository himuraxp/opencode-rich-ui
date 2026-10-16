/**
 * layout/width.ts — Terminal-width adaptation.
 *
 * Everything that reaches a component as a character count goes through this
 * module, so narrow terminals stay readable:
 * - `layoutFor(width)` decides the visual density (full border vs compact left rule)
 *   and exposes the chrome budget (innerWidth) as the single source of truth.
 * - `hardWrap()` folds long lines at word boundaries, preserving interior
 *   whitespace runs (indentation, ASCII alignment), hard-breaking unbreakable
 *   runs so no painted line exceeds the available width.
 * - `truncateToWidth()` ellipsises single-line values (titles).
 *
 * Width unit = TERMINAL CELLS, not graphemes:
 * - Grapheme clusters are the segmentation unit (Intl.Segmenter, code-point
 *   fallback), but East-Asian-Wide/Fullwidth and common emoji clusters paint
 *   2 cells (`cellWidth`). The table is deliberately conservative: anything
 *   possibly wide counts 2 → components wrap earlier, never overflow.
 * - Rendering direction: Phase 0 measures logical content only (no ANSI —
 *   the parser strips escape sequences; see core/parse.ts).
 */

const segmenter: Intl.Segmenter | undefined =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

/**
 * Code-point ranges painted 2 cells wide. Conservative superset of
 * East-Asian-Width=W/F and frequent emoji blocks (≥ U+1F300): false positives
 * are safe (earlier wrap), false negatives would overflow the panel border.
 */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2329, 0x232a], // angle brackets
  [0x2e80, 0x303e], // CJK radicals … CJK symbols
  [0x3041, 0x33ff], // Hiragana … CJK compatibility
  [0x3400, 0x4dbf], // CJK Ext A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa000, 0xa4cf], // Yi
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe30, 0xfe4f], // CJK compatibility forms
  [0xff00, 0xff60], // Fullwidth forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x16fe0, 0x16fe4], // Tangut marks
  [0x17000, 0x18aff], // Tangut / Khitan
  [0x1f004, 0x1f004], // mahjong tile
  [0x1f0cf, 0x1f0cf], // playing card joker
  [0x1f18e, 0x1f18e], // AB button
  [0x1f191, 0x1f19a], // squared CL..VS
  [0x1f200, 0x1f320], // squared ideographs … frames
  [0x1f32d, 0x1f335], // food/nature
  [0x1f337, 0x1f37c],
  [0x1f37e, 0x1f393],
  [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3],
  [0x1f3e0, 0x1f3f0],
  [0x1f3f4, 0x1f3f4],
  [0x1f3f8, 0x1f43e],
  [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d],
  [0x1f54b, 0x1f54e],
  [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596],
  [0x1f5a4, 0x1f5a4],
  [0x1f5fb, 0x1f64f],
  [0x1f680, 0x1f6c5],
  [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2],
  [0x1f6d5, 0x1f6d7],
  [0x1f6eb, 0x1f6ec],
  [0x1f6f4, 0x1f6fc],
  [0x1f7e0, 0x1f7eb],
  [0x1f90c, 0x1f93a],
  [0x1f93c, 0x1f945],
  [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1faff],
  [0x20000, 0x3fffd], // CJK Ext B … Tertiary
];

/** Terminal cells painted by a single grapheme cluster (1 or 2; never 0). */
export function cellWidth(cluster: string): number {
  const code = cluster.codePointAt(0);
  if (code === undefined) return 1;
  for (const [lo, hi] of WIDE_RANGES) {
    if (code >= lo && code <= hi) return 2;
  }
  return 1;
}

/** Split into grapheme clusters (code points as fallback). */
export function clusters(text: string): string[] {
  if (segmenter) {
    const out: string[] = [];
    for (const part of segmenter.segment(text)) out.push(part.segment);
    return out;
  }
  return [...text];
}

/** Painted width in terminal cells (ANSI-free input — parser strips escapes). */
export function visualLength(text: string): number {
  let total = 0;
  for (const cluster of clusters(text)) total += cellWidth(cluster);
  return total;
}

export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return "";
  if (visualLength(text) <= width) return text;
  if (width === 1) return "…";
  const kept: string[] = [];
  let used = 0;
  for (const cluster of clusters(text)) {
    const w = cellWidth(cluster);
    if (used + w > width - 1) break;
    kept.push(cluster);
    used += w;
  }
  return kept.join("") + "…";
}

/** Hard cap on wrapped lines per component (bounds per-delta native buffers). */
export const MAX_WRAPPED_LINES = 500;

/**
 * Fold `text` so every returned line has painted width <= maxWidth.
 * - Word-wraps at whitespace runs; interior whitespace runs (indentation,
 *   ASCII alignment) are preserved; the run at a wrap boundary is dropped.
 * - Hard-breaks unbreakable runs (incl. wide cells).
 * - Explicit newlines preserved (empty lines included).
 * - Returns at most MAX_WRAPPED_LINES lines (truncation notice appended).
 * Linear in the input size (incremental width tracking; no re-measurement).
 */
export function hardWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [""];
  const out: string[] = [];
  for (const sourceLine of text.split("\n")) {
    if (sourceLine.length === 0) {
      out.push("");
      continue;
    }
    let current = "";
    let currentWidth = 0;
    let pendingSpaces = ""; // whitespace run awaiting the next word
    let pendingWidth = 0;
    for (const run of sourceLine.split(/( +)/)) {
      if (run.length === 0) continue;
      const isSpaces = run[0] === " ";
      if (isSpaces) {
        // Bound the run's contribution; keep alignment, never exceed width.
        pendingSpaces = run;
        pendingWidth = run.length;
        continue;
      }
      // Word (may exceed maxWidth → hard-broken into fitting chunks).
      for (const chunk of splitFittingChunks(run, maxWidth)) {
        const chunkWidth = visualLength(chunk);
        if (currentWidth === 0) {
          // Starting a fresh line: keep the pending whitespace run (indent /
          // alignment) when it fits, drop it otherwise.
          if (pendingWidth > 0 && pendingWidth + chunkWidth <= maxWidth) {
            current = pendingSpaces + chunk;
            currentWidth = pendingWidth + chunkWidth;
          } else {
            current = chunk;
            currentWidth = chunkWidth;
          }
          continue;
        }
        const withSpacesWidth = currentWidth + pendingWidth + chunkWidth;
        if (withSpacesWidth <= maxWidth) {
          current += pendingSpaces + chunk;
          currentWidth = withSpacesWidth;
        } else {
          out.push(current);
          current = chunk;
          currentWidth = chunkWidth;
        }
        pendingSpaces = "";
        pendingWidth = 0;
      }
    }
    // Flush tail: pending trailing spaces are dropped (right-trim contract).
    out.push(current);
  }
  if (out.length > MAX_WRAPPED_LINES) {
    const kept = out.slice(0, MAX_WRAPPED_LINES);
    kept.push(`… (${out.length - MAX_WRAPPED_LINES} more lines truncated)`);
    return kept;
  }
  return out;
}

/** Split a word into chunks each fitting maxWidth (hard-break, cell-aware). */
function splitFittingChunks(word: string, maxWidth: number): string[] {
  if (visualLength(word) <= maxWidth) return [word];
  const chunks: string[] = [];
  let current = "";
  let currentWidth = 0;
  for (const cluster of clusters(word)) {
    const w = cellWidth(cluster);
    if (currentWidth + w > maxWidth) {
      if (current.length > 0) chunks.push(current);
      current = cluster;
      currentWidth = w;
    } else {
      current += cluster;
      currentWidth += w;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Global layout decision for a given terminal width (single chrome budget). */
export interface LayoutProfile {
  readonly width: number;
  /** Full rounded border when wide enough, single left rule otherwise. */
  readonly bordered: boolean;
  /** Terminal width minus this component family's chrome (border+padding). */
  readonly innerWidth: number;
}

const MIN_BORDERED_WIDTH = 40;
const CHROME_BORDERED = 4; // border(2) + horizontal padding(2)
const CHROME_COMPACT = 2; // left rule + one space

export function layoutFor(terminalWidth: number): LayoutProfile {
  const width = Math.max(1, Math.floor(terminalWidth));
  if (width >= MIN_BORDERED_WIDTH) {
    return { width, bordered: true, innerWidth: Math.max(1, width - CHROME_BORDERED) };
  }
  return { width, bordered: false, innerWidth: Math.max(1, width - CHROME_COMPACT) };
}
