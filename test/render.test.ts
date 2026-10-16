/**
 * Headless rendering proof using the OFFICIAL OpenTUI test renderer
 * (`@opentui/core/testing` → createTestRenderer + captureCharFrame).
 *
 * This executes the real component pipeline (buildPanel → Box/Text renderables
 * → frame capture) without a terminal, which is the evidence path for
 * "the component renders what it claims to render". Assertions measure the
 * PAINTED FRAME (columns), not the width metric itself — non-circular.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { buildPanel } from "../src/components/panel.ts";
import { buildMetric } from "../src/components/metric.ts";
import { buildTable } from "../src/components/table.ts";
import { layoutFor, MAX_WRAPPED_LINES } from "../src/layout/width.ts";
import type { MetricSpec, PanelSpec, TableSpec } from "../src/core/schema.ts";
import type { ComponentPalette } from "../src/adapter/theme.ts";

let setup: TestRendererSetup | undefined;

async function getSetup(): Promise<TestRendererSetup> {
  if (!setup) {
    setup = await createTestRenderer({ width: 60, height: 30 });
  }
  return setup;
}

afterAll(async () => {
  await setup?.dispose();
});

const palette: ComponentPalette = {
  title: "#00ff88",
  text: "#e0e0e0",
  muted: "#888888",
  border: "#00ff88",
};

/** Rightmost painted column of a frame row (0-based), -1 if empty. */
function rightmostColumn(row: string): number {
  const trimmed = row.replace(/\s+$/, "");
  return trimmed.length - 1;
}

describe("buildPanel (headless OpenTUI rendering)", () => {
  test("bordered panel renders title and body inside a rounded box", async () => {
    const s = await getSetup();
    const spec: PanelSpec = {
      component: "panel",
      title: "Deploy status",
      body: "All checks passed in 42s",
      tone: "success",
    };
    const renderable = buildPanel({
      spec,
      palette,
      terminalWidth: 60,
      renderer: s.renderer,
    });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("Deploy status");
    expect(frame).toContain("All checks passed in 42s");
    expect(frame).toContain("╭"); // rounded top-left corner
    expect(frame).toContain("╰"); // rounded bottom-left corner
  });

  test("body text stays strictly INSIDE the box borders (painted columns)", async () => {
    const s = await getSetup();
    const spec: PanelSpec = {
      component: "panel",
      title: "Notes",
      body: "This is a long sentence that must be folded across several lines",
    };
    const renderable = buildPanel({ spec, palette, terminalWidth: 40, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("Notes");
    expect(frame).toContain("sentence");

    const rows = frame.split("\n");
    const boxTop = rows.findIndex((r) => r.includes("╭"));
    const boxBottom = rows.findIndex((r) => r.includes("╰"));
    expect(boxTop).toBeGreaterThanOrEqual(0);
    expect(boxBottom).toBeGreaterThan(boxTop);

    // The right border of the top row defines the box width; every body row
    // must paint strictly left of it (cells, not clusters).
    const boxRight = rightmostColumn(rows[boxTop] ?? "");
    for (const row of rows.slice(boxTop + 1, boxBottom)) {
      if (row.trim().length === 0) continue;
      expect(rightmostColumn(row)).toBeLessThanOrEqual(boxRight);
    }
  });

  test("CJK content stays inside the box (cell-width, not grapheme count)", async () => {
    const s = await getSetup();
    const spec: PanelSpec = {
      component: "panel",
      title: "国際",
      body: "日本語のテキストはここにあります — 検証済み",
    };
    const renderable = buildPanel({ spec, palette, terminalWidth: 40, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    const rows = frame.split("\n");
    const boxTop = rows.findIndex((r) => r.includes("╭"));
    const boxBottom = rows.findIndex((r) => r.includes("╰"));
    expect(boxTop).toBeGreaterThanOrEqual(0);
    expect(boxBottom).toBeGreaterThan(boxTop);

    expect(frame).toContain("国際");
    expect(frame).toContain("検証済み");

    const boxRight = rightmostColumn(rows[boxTop] ?? "");
    for (const row of rows.slice(boxTop + 1, boxBottom)) {
      if (row.trim().length === 0) continue;
      expect(rightmostColumn(row)).toBeLessThanOrEqual(boxRight);
    }
  });

  test("compact panel (narrow terminal) uses left rule and keeps all content", async () => {
    const s = await getSetup();
    const spec: PanelSpec = {
      component: "panel",
      title: "Compact",
      body: "narrow terminal content",
    };
    const renderable = buildPanel({ spec, palette, terminalWidth: 30, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("Compact");
    expect(frame).toContain("narrow terminal content");
    expect(frame).not.toContain("╭"); // no rounded box in compact mode
  });

  test("40-column threshold: bordered; 39: compact (end to end)", async () => {
    const s = await getSetup();
    const spec: PanelSpec = { component: "panel", body: "threshold" };

    const wide = buildPanel({ spec, palette, terminalWidth: 40, renderer: s.renderer });
    s.renderer.root.add(wide);
    await s.renderOnce();
    const wideFrame = s.captureCharFrame();
    s.renderer.root.remove(wide);
    expect(wideFrame).toContain("╭");

    const narrow = buildPanel({ spec, palette, terminalWidth: 39, renderer: s.renderer });
    s.renderer.root.add(narrow);
    await s.renderOnce();
    const narrowFrame = s.captureCharFrame();
    s.renderer.root.remove(narrow);
    expect(narrowFrame).not.toContain("╭");

    expect(layoutFor(40).bordered).toBe(true);
    expect(layoutFor(39).bordered).toBe(false);
  });

  test("panel without title renders body only", async () => {
    const s = await getSetup();
    const spec: PanelSpec = { component: "panel", body: "body only" };
    const renderable = buildPanel({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("body only");
  });

  test("pathological body (200 lines × 2000 chars) wraps under a hard budget", async () => {
    const line = "word ".repeat(400); // ~2000 chars
    const body = Array.from({ length: 200 }, () => line).join("\n");
    const spec: PanelSpec = { component: "panel", body };

    // Dedicated tall viewport: the truncation notice is painted at the bottom
    // of the capped content (~MAX_WRAPPED_LINES rows), far below the shared
    // 30-row viewport — only a frame tall enough proves it is rendered.
    const tall = await createTestRenderer({ width: 60, height: MAX_WRAPPED_LINES + 10 });
    try {
      const start = performance.now();
      const renderable = buildPanel({ spec, palette, terminalWidth: 40, renderer: tall.renderer });
      const elapsed = performance.now() - start;

      // Anti-complexity guard, NOT a benchmark: an O(n²) wrap on this volume
      // (200 lines × 2000 chars → 500 wrapped lines) costs 10-60 s; the
      // measured O(n) pipeline sits between 180 ms (warm JIT) and ~3.5 s
      // (cold/loaded machine) depending on environment. An 8 s ceiling
      // tolerates that noise while still failing loudly on a complexity
      // regression.
      expect(elapsed).toBeLessThan(8000);
      // Wrapped output is bounded: cap + truncation notice + 2 border rows.
      const height = renderable.height;
      expect(height).toBeLessThanOrEqual(MAX_WRAPPED_LINES + 3);

      tall.renderer.root.add(renderable);
      await tall.renderOnce();
      const frame = tall.captureCharFrame();
      expect(frame).toContain("truncated"); // post-wrap truncation notice
    } finally {
      await tall.dispose();
    }
  });
});

describe("buildMetric (headless OpenTUI rendering)", () => {
  test("bordered metric paints label on the border, value inside, ▲ arrow for a leading '+'", async () => {
    const s = await getSetup();
    const spec: MetricSpec = { component: "metric", label: "CPU", value: "87%", delta: "+12%" };
    const renderable = buildMetric({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("CPU");
    expect(frame).toContain("87%");
    expect(frame).toContain("▲ 12%"); // leading "+" → up arrow, sign dropped
    expect(frame).toContain("╭"); // bordered chrome
  });

  test("same-line: delta is right-aligned on the value row when it fits", async () => {
    const s = await getSetup();
    const spec: MetricSpec = { component: "metric", label: "Coverage", value: "94.2%", delta: "+1.3" };
    const renderable = buildMetric({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    // inner = 56: "94.2%" (5) + gap (2) + "▲ 1.3" (5) fits → one row, delta
    // right-aligned near the right border (design review P0-1). The exact
    // trailing gap includes the textBlock padding (1-2 cells, host-painted).
    expect(frame).toMatch(/94\.2%\s+▲ 1\.3 {1,2}│/);
    const arrowRows = frame.split("\n").filter((l) => l.includes("▲"));
    expect(arrowRows).toHaveLength(1); // no wrapped second row
  });

  test("same-line boundary: value+gap+delta one cell over inner wraps the delta", async () => {
    const s = await getSetup();
    // inner = 56: 50 + 2 + 5 = 57 > 56 → the delta falls to its own row.
    const spec: MetricSpec = { component: "metric", label: "Coverage", value: "x".repeat(50), delta: "+1.3" };
    const renderable = buildMetric({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).not.toMatch(/x+ {2}▲/); // not on the value row
    expect(frame).toContain("▲ 1.3"); // but still painted, untruncated
  });

  test("leading '-' paints ▼; unsigned delta is painted as-is (no arrow)", async () => {
    const s = await getSetup();

    const down = buildMetric({
      spec: { component: "metric", value: "42ms", delta: "-5ms" },
      palette,
      terminalWidth: 60,
      renderer: s.renderer,
    });
    s.renderer.root.add(down);
    await s.renderOnce();
    const downFrame = s.captureCharFrame();
    s.renderer.root.remove(down);
    expect(downFrame).toContain("▼ 5ms");
    expect(downFrame).not.toContain("▲");

    const flat = buildMetric({
      spec: { component: "metric", value: "42ms", delta: "stable" },
      palette,
      terminalWidth: 60,
      renderer: s.renderer,
    });
    s.renderer.root.add(flat);
    await s.renderOnce();
    const flatFrame = s.captureCharFrame();
    s.renderer.root.remove(flat);
    expect(flatFrame).toContain("stable");
    expect(flatFrame).not.toContain("▲");
    expect(flatFrame).not.toContain("▼");
  });

  test("compact metric (narrow terminal) paints label as first line under a left rule", async () => {
    const s = await getSetup();
    const spec: MetricSpec = {
      component: "metric",
      label: "MEM",
      value: "4.2 GB",
      delta: "+0.3 GB",
    };
    const renderable = buildMetric({ spec, palette, terminalWidth: 30, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("MEM");
    expect(frame).toContain("4.2 GB");
    expect(frame).toContain("▲ 0.3 GB"); // arrow applies in compact mode too
    expect(frame).not.toContain("╭"); // no rounded box in compact mode
  });

  test("metric without label renders the value only", async () => {
    const s = await getSetup();
    const spec: MetricSpec = { component: "metric", value: "42" };
    const renderable = buildMetric({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("42");
  });

  test("value longer than the canvas is ellipsised (never overflows)", async () => {
    const s = await getSetup();
    const spec: MetricSpec = { component: "metric", value: "x".repeat(50) };
    const renderable = buildMetric({ spec, palette, terminalWidth: 40, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("…");
    // 50 x's would overflow the 36-cell inner width: at most 35 are painted.
    expect(frame).not.toContain("x".repeat(36));
  });

  test("compact metric paints the label first, then the value (both visible)", async () => {
    const s = await getSetup();
    const spec: MetricSpec = { component: "metric", label: "LOAD", value: "97.2%" };
    const renderable = buildMetric({ spec, palette, terminalWidth: 30, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    // Colors are not visible in a char frame — assert the painted text: the
    // muted label sits on the first line, the accent value below it.
    const rows = frame.split("\n");
    const labelRow = rows.findIndex((r) => r.includes("LOAD"));
    const valueRow = rows.findIndex((r) => r.includes("97.2%"));
    expect(labelRow).toBeGreaterThanOrEqual(0);
    expect(valueRow).toBeGreaterThan(labelRow);
  });
});

describe("buildTable (headless OpenTUI rendering)", () => {
  test("bordered table paints title, header, rule and content-aligned cells", async () => {
    const s = await getSetup();
    const spec: TableSpec = {
      component: "table",
      title: "Results",
      columns: ["Name", "Score"],
      rows: [
        ["alpha", "1"],
        ["beta", "22"],
      ],
      tone: "success",
    };
    const renderable = buildTable({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("Results");
    expect(frame).toContain("alpha");
    expect(frame).toContain("beta");
    expect(frame).toContain("─"); // rule line under the header
    // Both columns size to their widest content ("alpha" = 5 cells). Header
    // and text cells are left-aligned; pure numbers are RIGHT-aligned in
    // their column (design review P1-8): 1 and 22 share a right edge.
    expect(frame).toContain("Name   Score");
    expect(frame).toContain("alpha      1");
    expect(frame).toContain("beta      22");
  });

  test("long cells wrap within their column and never overflow the canvas", async () => {
    const s = await getSetup();
    const sentence = "The quick brown fox jumps over the lazy dog";
    const spec: TableSpec = {
      component: "table",
      columns: ["ID", "Notes"],
      rows: [["1", sentence]],
    };
    const renderable = buildTable({ spec, palette, terminalWidth: 40, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    // The 44-cell sentence is word-wrapped across the column's physical lines…
    expect(frame).toContain("The quick brown");
    expect(frame).toContain("fox jumps over");
    expect(frame).toContain("the lazy dog");
    // …never painted as a single overflowing line.
    expect(frame).not.toContain(sentence);

    // Clamp contract: every painted row stays inside the box borders.
    const rows = frame.split("\n");
    const boxTop = rows.findIndex((r) => r.includes("╭"));
    const boxBottom = rows.findIndex((r) => r.includes("╰"));
    expect(boxTop).toBeGreaterThanOrEqual(0);
    expect(boxBottom).toBeGreaterThan(boxTop);
    const boxRight = rightmostColumn(rows[boxTop] ?? "");
    for (const row of rows.slice(boxTop + 1, boxBottom)) {
      if (row.trim().length === 0) continue;
      expect(rightmostColumn(row)).toBeLessThanOrEqual(boxRight);
    }
  });

  test("compact table (narrow terminal) drops the box chrome", async () => {
    const s = await getSetup();
    const spec: TableSpec = {
      component: "table",
      columns: ["K", "V"],
      rows: [["a", "b"]],
    };
    const renderable = buildTable({ spec, palette, terminalWidth: 30, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("K");
    expect(frame).toContain("a");
    expect(frame).toContain("b");
    expect(frame).not.toContain("╭");
  });

  test("more painted rows than the render cap → truncation notice and bounded height", async () => {
    const spec: TableSpec = {
      component: "table",
      columns: ["N"],
      rows: Array.from({ length: 600 }, (_, i) => [`row-${i}`]),
    };
    // Dedicated tall viewport: the notice paints at the bottom of the capped
    // content (~MAX_WRAPPED_LINES rows), far below the shared 30-row viewport.
    const tall = await createTestRenderer({ width: 60, height: MAX_WRAPPED_LINES + 10 });
    try {
      const renderable = buildTable({ spec, palette, terminalWidth: 40, renderer: tall.renderer });
      // Cap bound: header + rule + ≤497 body lines + notice + 2 border rows.
      expect(renderable.height).toBeLessThanOrEqual(MAX_WRAPPED_LINES + 3);

      tall.renderer.root.add(renderable);
      await tall.renderOnce();
      const frame = tall.captureCharFrame();
      // 600 single-line rows − (500 − header − rule − notice) = 103 dropped.
      // Notice is clamped to innerWidth (36 @ w=40) — assert the stable prefix.
      expect(frame).toContain("… 103 more rows truncated");
      expect(frame).toContain("row-0"); // first rows painted
      expect(frame).not.toContain("row-599"); // rows past the cap are not
    } finally {
      await tall.dispose();
    }
  });

  test("truncatedRows (parser-dropped rows) surfaces as a notice line", async () => {
    const s = await getSetup();
    const spec: TableSpec = {
      component: "table",
      columns: ["A"],
      rows: [["x"]],
      truncatedRows: 42,
    };
    const renderable = buildTable({ spec, palette, terminalWidth: 60, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("… 42 more rows truncated");
    expect(frame).not.toContain("(render cap)"); // only the parser notice here
  });

  test("8 columns @ w=20 and w=23: overflowing columns are hidden, never painted past the box", async () => {
    const s = await getSetup();
    const spec: TableSpec = {
      component: "table",
      columns: ["a", "b", "c", "d", "e", "f", "g", "h"],
      rows: [["1", "2", "3", "4", "5", "6", "7", "8"]],
    };

    // [terminalWidth, painted header prefix (visible columns), first hidden body cell]
    const cases = [
      [20, "a  b  c  d  e  f", "7"],
      [23, "a  b  c  d  e  f  g", "8"],
    ] as const;

    for (const [width, visibleHeader, hiddenCell] of cases) {
      const renderable = buildTable({ spec, palette, terminalWidth: width, renderer: s.renderer });
      s.renderer.root.add(renderable);
      await s.renderOnce();
      const frame = s.captureCharFrame();
      s.renderer.root.remove(renderable);

      // Columns that cannot fit (even at the 1-cell minimum) are HIDDEN with a
      // notice. The notice itself is clamped to innerWidth: at w=20 (inner 18)
      // the clamp cuts the word ("… 2 columns hidde…"), at w=23 (inner 21) it
      // survives whole ("… 1 columns hidden (…"). Both painted shapes match:
      expect(frame).toMatch(/columns hidde(n|…)/);
      expect(frame).not.toContain(hiddenCell); // hidden column's cell never painted
      expect(frame).toContain(visibleHeader); // visible columns painted as one row

      // Nothing may paint outside the box: the compact box spans exactly
      // `width` cells (left rule included), so column `width - 1` is the last
      // legal painted cell. Pre-fix, 8 forced 1-cell columns + 7 gaps painted
      // 22 cells inside a 21-cell content area (HIGH-1 regression).
      const rows = frame.split("\n");
      for (const row of rows) {
        if (row.trim().length === 0) continue;
        expect(rightmostColumn(row)).toBeLessThanOrEqual(width - 1);
      }
    }
  });

  test("600 rows @ w=40: render-cap notice is clamped inside innerWidth, border intact", async () => {
    const spec: TableSpec = {
      component: "table",
      columns: ["N"],
      rows: Array.from({ length: 600 }, (_, i) => [`row-${i}`]),
    };
    const tall = await createTestRenderer({ width: 60, height: MAX_WRAPPED_LINES + 10 });
    try {
      const renderable = buildTable({ spec, palette, terminalWidth: 40, renderer: tall.renderer });
      expect(renderable.height).toBeLessThanOrEqual(MAX_WRAPPED_LINES + 3);

      tall.renderer.root.add(renderable);
      await tall.renderOnce();
      const frame = tall.captureCharFrame();

      const rows = frame.split("\n");
      const boxTop = rows.findIndex((r) => r.includes("╭"));
      expect(boxTop).toBeGreaterThanOrEqual(0);
      const boxRight = rightmostColumn(rows[boxTop] ?? "");
      expect(boxRight).toBeGreaterThan(0);

      // Every painted row stays inside the box borders…
      for (const row of rows) {
        if (row.trim().length === 0) continue;
        expect(rightmostColumn(row)).toBeLessThanOrEqual(boxRight);
      }

      // …and the raw render-cap notice (~38 cells) is clamped to innerWidth:
      // painted strictly inside the right border, which it must not overwrite.
      // Pre-fix, the 38-cell notice overflowed innerWidth (36) and its last
      // cell landed on the border column (HIGH-2 regression).
      const noticeRows = rows.filter((r) => r.includes("truncated"));
      expect(noticeRows.length).toBeGreaterThan(0);
      for (const row of noticeRows) {
        // The border cell itself is painted (never overwritten by the notice)…
        expect(row[boxRight]).toBe("│"); // right border intact
        // …and the inner content (between borders) ends strictly before it:
        // rightmostColumn counts the border, so strip it before comparing.
        const inner = row.slice(1, boxRight);
        expect(inner.trimEnd().length).toBeLessThan(boxRight - 1);
      }
      expect(frame).toContain("row-0"); // first rows painted
      expect(frame).not.toContain("row-599"); // rows past the cap are not
    } finally {
      await tall.dispose();
    }
  });

  test("600 rows @ w=30: render-cap notice never paints past the compact box", async () => {
    const width = 30;
    const spec: TableSpec = {
      component: "table",
      columns: ["N"],
      rows: Array.from({ length: 600 }, (_, i) => [`row-${i}`]),
    };
    const tall = await createTestRenderer({ width: 60, height: MAX_WRAPPED_LINES + 10 });
    try {
      const renderable = buildTable({ spec, palette, terminalWidth: width, renderer: tall.renderer });
      expect(renderable.height).toBeLessThanOrEqual(MAX_WRAPPED_LINES + 3);

      tall.renderer.root.add(renderable);
      await tall.renderOnce();
      const frame = tall.captureCharFrame();

      // Compact box: no right border to read from the frame — the box spans
      // exactly `width` cells, so column `width - 1` is the last legal cell.
      // Pre-fix, the 38-cell notice painted up to column 39, past the box.
      const rows = frame.split("\n");
      for (const row of rows) {
        if (row.trim().length === 0) continue;
        expect(rightmostColumn(row)).toBeLessThanOrEqual(width - 1);
      }

      const noticeRows = rows.filter((r) => r.includes("truncated"));
      expect(noticeRows.length).toBeGreaterThan(0);
      expect(frame).toContain("row-0");
      expect(frame).not.toContain("row-599");
    } finally {
      await tall.dispose();
    }
  });

  test("compact table paints the title as the first content line", async () => {
    const s = await getSetup();
    const spec: TableSpec = {
      component: "table",
      title: "Narrow results",
      columns: ["K"],
      rows: [["v"]],
    };
    const renderable = buildTable({ spec, palette, terminalWidth: 30, renderer: s.renderer });
    s.renderer.root.add(renderable);
    await s.renderOnce();
    const frame = s.captureCharFrame();
    s.renderer.root.remove(renderable);

    expect(frame).toContain("Narrow results"); // painted (pre-fix: dropped in compact mode)
    expect(frame).toContain("v"); // the rest of the table still renders

    // Compact parity with panel/metric: the title is the FIRST content line.
    const rows = frame.split("\n");
    const firstPainted = rows.findIndex((r) => r.trim().length > 0);
    const titleRow = rows.findIndex((r) => r.includes("Narrow results"));
    expect(firstPainted).toBeGreaterThanOrEqual(0);
    expect(titleRow).toBe(firstPainted);
  });

  test("pathological header (500 chars @ w=3) degrades gracefully: bounded height, notice, no crash", async () => {
    const width = 3;
    const spec: TableSpec = {
      component: "table",
      columns: ["H".repeat(500)],
      rows: [["x"], ["y"], ["z"], ["w"], ["q"]],
    };
    const tall = await createTestRenderer({ width: 60, height: MAX_WRAPPED_LINES + 10 });
    try {
      const renderable = buildTable({ spec, palette, terminalWidth: width, renderer: tall.renderer });
      // The 500-cell header alone saturates the paint cap (bodyBudget clamps
      // to 0): every body row gives way to the notices, height stays bounded.
      expect(renderable.height).toBeLessThanOrEqual(MAX_WRAPPED_LINES + 5);

      tall.renderer.root.add(renderable);
      await tall.renderOnce();
      const frame = tall.captureCharFrame();

      // Header painted (hard-wrapped to 1 cell per line) and the render-cap
      // notice present — clamped to the 1-cell inner width it paints as "…".
      expect(frame).toContain("H");
      expect(frame).toContain("…");

      const rows = frame.split("\n");
      for (const row of rows) {
        if (row.trim().length === 0) continue;
        expect(rightmostColumn(row)).toBeLessThanOrEqual(width - 1);
      }
    } finally {
      await tall.dispose();
    }
  });
});
