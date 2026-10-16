/**
 * components/table.ts — Lot 1 visual component: Table.
 *
 * Reuses the shared chrome (components/chrome.ts). Layout contract:
 * - Column widths derive from content, clamped so the total never exceeds the
 *   canvas (zéro débordement, same contract as the panel).
 * - Cells word-wrap within their column; a logical row occupies as many
 *   physical lines as its tallest wrapped cell.
 * - Header row renders in the accent color, followed by a rule line.
 * - Hard cap: MAX_WRAPPED_LINES painted lines (header + rule + body + notice
 *   together), enforced AFTER wrap, with a truncation notice — same defense
 *   as the panel.
 * - Rows dropped by the parser (MAX_TABLE_ROWS) surface as a notice line.
 *
 * Static ordering: rows render in the order provided (no sorting — the agent
 * owns the order).
 */

import type { BoxRenderable } from "@opentui/core";
import type { TableSpec } from "../core/schema.ts";
import {
  MAX_WRAPPED_LINES,
  hardWrap,
  layoutFor,
  truncateToWidth,
  visualLength,
} from "../layout/width.ts";
import type { ComponentPalette } from "../adapter/theme.ts";
import type { RenderContextLike } from "../adapter/opencode-api.ts";
import {
  createBorderedBox,
  createCompactBox,
  destroyBox,
  textBlock,
} from "./chrome.ts";

/** Gap between columns, in cells. */
const COLUMN_GAP = 2;
/** Minimum useful column width before the layout gives up proportioning. */
const MIN_COLUMN_WIDTH = 1;

interface RenderedTable {
  readonly headerLines: string[];
  readonly ruleLine: string;
  readonly bodyLines: string[];
  readonly noticeLines: string[];
}

export function buildTable(options: {
  spec: TableSpec;
  palette: ComponentPalette;
  terminalWidth: number;
  renderer: RenderContextLike;
}): BoxRenderable {
  const { spec, palette, terminalWidth, renderer } = options;
  const profile = layoutFor(terminalWidth);
  const rendered = renderTable(spec, profile.innerWidth);

  // Compact mode: the title is the first accent line (parity panel/metric).
  const compactTitle = profile.bordered ? undefined : spec.title;
  const titleLines = compactTitle !== undefined ? 1 : 0;
  const contentLines =
    titleLines +
    rendered.headerLines.length +
    1 + // rule
    rendered.bodyLines.length +
    rendered.noticeLines.length;

  let box: BoxRenderable | undefined;
  try {
    if (profile.bordered) {
      box = createBorderedBox(renderer, {
        profile,
        palette,
        ...(spec.title !== undefined ? { title: spec.title } : {}),
        height: contentLines + 2,
      });
    } else {
      box = createCompactBox(renderer, { profile, palette, height: contentLines });
    }
    if (compactTitle !== undefined) {
      box.add(
        textBlock(renderer, truncateToWidth(compactTitle, profile.innerWidth), palette.title, {
          left: 1,
        }),
      );
    }
    if (rendered.headerLines.length > 0) {
      box.add(textBlock(renderer, rendered.headerLines.join("\n"), palette.title, { left: 1 }));
    }
    box.add(textBlock(renderer, rendered.ruleLine, palette.border, { left: 1 }));
    if (rendered.bodyLines.length > 0) {
      box.add(textBlock(renderer, rendered.bodyLines.join("\n"), palette.text, { left: 1 }));
    }
    if (rendered.noticeLines.length > 0) {
      box.add(textBlock(renderer, rendered.noticeLines.join("\n"), palette.muted, { left: 1 }));
    }
    return box;
  } catch (error) {
    destroyBox(box);
    throw error;
  }
}

/**
 * Pure layout pass: columns → wrapped, padded physical lines under a hard cap.
 * Total painted width (sum of column widths + gaps) never exceeds `innerWidth`:
 * when even 1-cell columns cannot all fit, the RIGHTMOST columns are hidden
 * (with a notice) instead of overflowing the canvas.
 */
function renderTable(spec: TableSpec, innerWidth: number): RenderedTable {
  const columnCount = spec.columns.length;
  // Each column costs width + COLUMN_GAP (last excluded); at the minimum width
  // of 1, c columns paint c + (c-1)*gap cells → c ≤ (innerWidth + gap) / (1+gap).
  const maxFittingColumns = Math.max(
    1,
    Math.floor((innerWidth + COLUMN_GAP) / (1 + COLUMN_GAP)),
  );
  const visibleColumns = Math.min(columnCount, maxFittingColumns);
  const hiddenColumns = columnCount - visibleColumns;

  const gaps = (visibleColumns - 1) * COLUMN_GAP;
  const maxColumnWidth = Math.max(MIN_COLUMN_WIDTH, Math.floor((innerWidth - gaps) / visibleColumns));

  const columnWidths: number[] = [];
  for (let i = 0; i < visibleColumns; i++) {
    let widest = visualLength(spec.columns[i] as string);
    for (const row of spec.rows) {
      const cell = row[i] ?? "";
      for (const line of cell.split("\n")) widest = Math.max(widest, visualLength(line));
    }
    columnWidths.push(Math.max(MIN_COLUMN_WIDTH, Math.min(widest, maxColumnWidth)));
  }

  const padTo = (line: string, width: number): string =>
    line + " ".repeat(Math.max(0, width - visualLength(line)));

  /** Render one logical row (array of cells) into padded physical lines. */
  const renderRow = (cells: readonly string[]): string[] => {
    const wrapped = cells
      .slice(0, visibleColumns)
      .map((cell, i) => hardWrap(cell, columnWidths[i] ?? MIN_COLUMN_WIDTH));
    const physicalCount = Math.max(...wrapped.map((lines) => lines.length), 1);
    const physical: string[] = [];
    for (let j = 0; j < physicalCount; j++) {
      const parts = columnWidths.map((width, i) => padTo(wrapped[i]?.[j] ?? "", width));
      physical.push(parts.join(" ".repeat(COLUMN_GAP)).trimEnd());
    }
    return physical;
  };

  const headerLines = renderRow(spec.columns);
  const ruleWidth = Math.min(
    innerWidth,
    columnWidths.reduce((sum, width) => sum + width, 0) + gaps,
  );
  const ruleLine = "─".repeat(Math.max(1, ruleWidth));

  // Reserve the header, the rule and one notice line from the paint cap.
  // Clamped at 0: a pathological header (capped at 501 wrapped lines) can
  // alone exhaust the budget — the table degrades to header + notices.
  const bodyBudget = Math.max(0, MAX_WRAPPED_LINES - headerLines.length - 2);

  const bodyLines: string[] = [];
  let truncatedByCap = 0;
  for (let r = 0; r < spec.rows.length; r++) {
    const physical = renderRow(spec.rows[r] as readonly string[]);
    if (physical.length > bodyBudget - bodyLines.length) {
      truncatedByCap = spec.rows.length - r;
      break;
    }
    bodyLines.push(...physical);
  }

  // All notices are clamped to the canvas (HIGH: a raw notice is ~38 cells
  // wide and would overflow both bordered (36) and compact (≤37) inner widths).
  const noticeLines: string[] = [];
  const pushNotice = (text: string): void => {
    noticeLines.push(truncateToWidth(text, innerWidth));
  };
  if (hiddenColumns > 0) {
    pushNotice(`… ${hiddenColumns} columns hidden (narrow terminal)`);
  }
  if (spec.truncatedRows !== undefined && spec.truncatedRows > 0) {
    pushNotice(`… ${spec.truncatedRows} more rows truncated`);
  }
  if (truncatedByCap > 0) {
    pushNotice(`… ${truncatedByCap} more rows truncated (render cap)`);
  }

  return { headerLines, ruleLine, bodyLines, noticeLines };
}
