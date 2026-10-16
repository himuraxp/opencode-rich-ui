import { describe, expect, test } from "bun:test";
import {
  cellWidth,
  hardWrap,
  layoutFor,
  truncateToWidth,
  visualLength,
  MAX_WRAPPED_LINES,
} from "../src/layout/width.ts";

describe("visualLength (TERMINAL CELLS)", () => {
  test("counts ASCII", () => {
    expect(visualLength("hello")).toBe(5);
    expect(visualLength("")).toBe(0);
  });

  test("wide scripts and emoji paint 2 cells (CJK, Hangul, kana, pictographs)", () => {
    expect(visualLength("日本語")).toBe(6); // 3 clusters × 2 cells
    expect(visualLength("한국어")).toBe(6);
    expect(visualLength("こんにちは")).toBe(10);
    expect(visualLength("👍")).toBe(2);
    expect(visualLength("🚀🚀")).toBe(4);
  });

  test("narrow clusters stay 1 cell (combining marks, latin)", () => {
    expect(visualLength("e\u0301")).toBe(1); // é as e + combining acute
    expect(cellWidth("e\u0301")).toBe(1);
    expect(visualLength("abc")).toBe(3);
  });

  test("cellWidth is never 0 and never > 2 (conservative bounds)", () => {
    for (const cluster of ["a", "中", "👍", "\u0301", "🙂"]) {
      expect(cellWidth(cluster)).toBeGreaterThanOrEqual(1);
      expect(cellWidth(cluster)).toBeLessThanOrEqual(2);
    }
  });
});

describe("truncateToWidth", () => {
  test("keeps short text", () => {
    expect(truncateToWidth("abc", 10)).toBe("abc");
  });

  test("ellipsises long text to at most width cells", () => {
    const out = truncateToWidth("abcdefghij", 5);
    expect(visualLength(out)).toBeLessThanOrEqual(5);
    expect(out.endsWith("…")).toBe(true);
  });

  test("handles degenerate widths", () => {
    expect(truncateToWidth("abc", 0)).toBe("");
    expect(truncateToWidth("abc", 1)).toBe("…");
  });

  test("never exceeds width with emoji (2-cell clusters)", () => {
    const out = truncateToWidth("👍👍👍👍👍👍", 5);
    expect(visualLength(out)).toBeLessThanOrEqual(5);
  });

  test("never exceeds width with CJK", () => {
    const out = truncateToWidth("日本語のテキスト", 7);
    expect(visualLength(out)).toBeLessThanOrEqual(7);
  });
});

describe("hardWrap", () => {
  test("wraps at word boundaries", () => {
    const lines = hardWrap("the quick brown fox", 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(visualLength(line)).toBeLessThanOrEqual(10);
    expect(lines.join(" ")).toBe("the quick brown fox");
  });

  test("hard-breaks unbreakable runs", () => {
    const lines = hardWrap("aaaaaaaaaaaaaaaaaaaa", 5);
    for (const line of lines) expect(visualLength(line)).toBeLessThanOrEqual(5);
    expect(lines.join("")).toBe("aaaaaaaaaaaaaaaaaaaa");
  });

  test("hard-breaks CJK runs without exceeding width", () => {
    const lines = hardWrap("日本語のテキストはここにあります", 6);
    for (const line of lines) expect(visualLength(line)).toBeLessThanOrEqual(6);
    expect(lines.join("")).toBe("日本語のテキストはここにあります");
  });

  test("preserves explicit newlines and empty lines", () => {
    const lines = hardWrap("one\n\ntwo", 20);
    expect(lines).toEqual(["one", "", "two"]);
  });

  test("preserves interior whitespace runs (ASCII alignment)", () => {
    const lines = hardWrap("col1    col2    col3", 40);
    expect(lines).toEqual(["col1    col2    col3"]);
  });

  test("preserves leading indent", () => {
    const lines = hardWrap("    indented text", 40);
    expect(lines).toEqual(["    indented text"]);
  });

  test("wraps before (not after) a whitespace run that would overflow", () => {
    const lines = hardWrap("aaaa bb", 5);
    // "aaaa" fits; " bb" would overflow → wrap, drop the run at the boundary.
    expect(lines).toEqual(["aaaa", "bb"]);
    for (const line of lines) expect(visualLength(line)).toBeLessThanOrEqual(5);
  });

  test("emoji content never produces a painted line beyond width", () => {
    const lines = hardWrap("👍👍👍 👍👍👍 👍👍👍", 4);
    for (const line of lines) expect(visualLength(line)).toBeLessThanOrEqual(4);
  });

  test("caps wrapped line count (MAX_WRAPPED_LINES)", () => {
    // 3000 words × ~3 cells at width 10 → far more than MAX_WRAPPED_LINES.
    const words = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(" ");
    const lines = hardWrap(words, 10);
    expect(lines.length).toBe(MAX_WRAPPED_LINES + 1);
    expect(lines[MAX_WRAPPED_LINES]).toContain("truncated");
  });

  test("handles degenerate width", () => {
    expect(hardWrap("hello", 0)).toEqual([""]);
  });
});

describe("layoutFor", () => {
  test("bordered on wide terminals", () => {
    const p = layoutFor(100);
    expect(p.bordered).toBe(true);
    expect(p.innerWidth).toBe(96);
  });

  test("compact on narrow terminals", () => {
    const p = layoutFor(30);
    expect(p.bordered).toBe(false);
    expect(p.innerWidth).toBe(28);
  });

  test("threshold: 40 columns is bordered, 39 is compact", () => {
    expect(layoutFor(40).bordered).toBe(true);
    expect(layoutFor(39).bordered).toBe(false);
  });

  test("clamps degenerate widths", () => {
    expect(layoutFor(0).width).toBe(1);
    expect(layoutFor(-5).width).toBe(1);
  });
});
