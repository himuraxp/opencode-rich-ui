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
import { layoutFor, MAX_WRAPPED_LINES } from "../src/layout/width.ts";
import type { PanelSpec } from "../src/core/schema.ts";
import type { PanelPalette } from "../src/adapter/theme.ts";

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

const palette: PanelPalette = {
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
      // (200 lines × 2000 chars → 500 wrapped lines) takes multiple seconds;
      // the measured O(n) pipeline sits between 180 and 640 ms depending on
      // JIT warmth and machine load. A 1.5 s ceiling tolerates that noise
      // while still failing loudly on a complexity regression.
      expect(elapsed).toBeLessThan(1500);
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
