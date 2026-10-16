import { describe, expect, test } from "bun:test";
import { parseRichui } from "../src/core/parse.ts";
import { MAX_BODY_LINES, MAX_TITLE_CHARS } from "../src/core/parse.ts";

describe("parseRichui", () => {
  test("parses a valid panel", () => {
    const result = parseRichui(
      JSON.stringify({ component: "panel", title: "Status", body: "All systems go", tone: "success" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec).toEqual({
        component: "panel",
        title: "Status",
        body: "All systems go",
        tone: "success",
      });
    }
  });

  test("panel without title/tone is valid and omits them", () => {
    const result = parseRichui(JSON.stringify({ component: "panel", body: "hello" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec).toEqual({ component: "panel", body: "hello" });
  });

  test("rejects invalid JSON", () => {
    const result = parseRichui("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("invalid JSON");
  });

  test("rejects non-object payloads", () => {
    expect(parseRichui("[1,2]").ok).toBe(false);
    expect(parseRichui("42").ok).toBe(false);
    expect(parseRichui("null").ok).toBe(false);
    expect(parseRichui('"str"').ok).toBe(false);
  });

  test("rejects unknown or missing component", () => {
    const noComponent = parseRichui(JSON.stringify({ body: "x" }));
    expect(noComponent.ok).toBe(false);
    const unknown = parseRichui(JSON.stringify({ component: "chart", body: "x" }));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toContain("component");
  });

  test("rejects missing or empty body", () => {
    expect(parseRichui(JSON.stringify({ component: "panel" })).ok).toBe(false);
    expect(parseRichui(JSON.stringify({ component: "panel", body: "   " })).ok).toBe(false);
  });

  test("normalizes CRLF and strips trailing blank lines", () => {
    const result = parseRichui(
      JSON.stringify({ component: "panel", body: "one\r\ntwo\r\n\r\n\r\n" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.body).toBe("one\ntwo");
  });

  test("collapses title whitespace and caps length", () => {
    const longTitle = "A".repeat(MAX_TITLE_CHARS + 30);
    const result = parseRichui(
      JSON.stringify({ component: "panel", title: `  ${longTitle}  `, body: "x" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.title?.length).toBe(MAX_TITLE_CHARS);
  });

  test("tone is lowercased; invalid tone is dropped (neutral default)", () => {
    const ok = parseRichui(JSON.stringify({ component: "panel", body: "x", tone: "SUCCESS" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.spec.tone).toBe("success");

    const dropped = parseRichui(JSON.stringify({ component: "panel", body: "x", tone: "neon" }));
    expect(dropped.ok).toBe(true);
    if (dropped.ok) expect(dropped.spec.tone).toBeUndefined();
  });

  test("caps body size (measured in octets)", () => {
    // 70 KiB of ASCII → over the 64 KiB cap.
    const huge = "x".repeat(70 * 1024);
    const result = parseRichui(JSON.stringify({ component: "panel", body: huge }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("too large");
  });

  test("byte cap counts UTF-16 astral content as 4 octets per char", () => {
    // 17 000 emoji = 68 000 octets (34 000 UTF-16 units) → must exceed 64 KiB.
    const astral = "👍".repeat(17_000);
    const result = parseRichui(JSON.stringify({ component: "panel", body: astral }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("octets");
  });

  test("strips ANSI escape sequences from title and body", () => {
    const result = parseRichui(
      JSON.stringify({
        component: "panel",
        title: "\u001b[31mRed\u001b[0m",
        body: "before\u001b[1;32mafter\u001b[0m\n\u001b]0;title\u0007tail",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.title).toBe("Red");
      expect(result.spec.body).toBe("beforeafter\ntail");
      expect(result.spec.body).not.toContain("\u001b");
    }
  });

  test("strips C0 controls and expands tabs", () => {
    const result = parseRichui(
      JSON.stringify({ component: "panel", body: "a\u0000b\u0007c\td" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.body).toBe("abc  d");
  });

  test("caps body lines", () => {
    const manyLines = Array.from({ length: MAX_BODY_LINES + 50 }, (_, i) => `line ${i}`).join("\n");
    const result = parseRichui(JSON.stringify({ component: "panel", body: manyLines }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.spec.body.split("\n");
      expect(lines.length).toBe(MAX_BODY_LINES + 1);
      expect(lines[MAX_BODY_LINES]).toContain("truncated");
    }
  });

  test("never throws on adversarial input", () => {
    const adversarial = [
      "",
      "\u0000\u0001",
      JSON.stringify({ component: "panel", body: { nested: true } }),
      JSON.stringify({ component: "panel", body: 42 }),
      JSON.stringify({ component: { a: 1 }, body: "x" }),
      JSON.stringify({ component: "panel", body: "x", title: 5 }),
    ];
    for (const input of adversarial) {
      expect(() => parseRichui(input)).not.toThrow();
    }
  });
});
