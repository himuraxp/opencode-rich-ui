import { describe, expect, test } from "bun:test";
import {
  MAX_BODY_LINES,
  MAX_CELL_CHARS,
  MAX_METRIC_DELTA_CHARS,
  MAX_METRIC_VALUE_CHARS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  MAX_TITLE_CHARS,
  parseRichui,
} from "../src/core/parse.ts";
import type {
  MetricSpec,
  ParseResult,
  PanelSpec,
  TableSpec,
} from "../src/core/schema.ts";

/** Narrow a ParseResult to a panel spec or fail the test loudly. */
function panelSpec(result: ParseResult): PanelSpec {
  if (!result.ok || result.spec.component !== "panel") throw new Error("expected panel spec");
  return result.spec;
}

/** Narrow a ParseResult to a metric spec or fail the test loudly. */
function metricSpec(result: ParseResult): MetricSpec {
  if (!result.ok || result.spec.component !== "metric") throw new Error("expected metric spec");
  return result.spec;
}

/** Narrow a ParseResult to a table spec or fail the test loudly. */
function tableSpec(result: ParseResult): TableSpec {
  if (!result.ok || result.spec.component !== "table") throw new Error("expected table spec");
  return result.spec;
}

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
    if (!result.ok || result.spec.component !== "panel") throw new Error("expected panel spec");
    expect(result.spec.body).toBe("one\ntwo");
  });

  test("collapses title whitespace and caps length", () => {
    const longTitle = "A".repeat(MAX_TITLE_CHARS + 30);
    const result = parseRichui(
      JSON.stringify({ component: "panel", title: `  ${longTitle}  `, body: "x" }),
    );
    expect(result.ok).toBe(true);
    expect(panelSpec(result).title?.length).toBe(MAX_TITLE_CHARS);
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
    const stripped = panelSpec(result);
    expect(stripped.title).toBe("Red");
    expect(stripped.body).toBe("beforeafter\ntail");
    expect(stripped.body).not.toContain("\u001b");
  });

  test("strips C0 controls and expands tabs", () => {
    const result = parseRichui(
      JSON.stringify({ component: "panel", body: "a\u0000b\u0007c\td" }),
    );
    expect(result.ok).toBe(true);
    expect(panelSpec(result).body).toBe("abc  d");
  });

  test("caps body lines", () => {
    const manyLines = Array.from({ length: MAX_BODY_LINES + 50 }, (_, i) => `line ${i}`).join("\n");
    const result = parseRichui(JSON.stringify({ component: "panel", body: manyLines }));
    expect(result.ok).toBe(true);
    const lines = panelSpec(result).body.split("\n");
    expect(lines.length).toBe(MAX_BODY_LINES + 1);
    expect(lines[MAX_BODY_LINES]).toContain("truncated");
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

describe("parseRichui — metric", () => {
  test("parses a full metric (label, value, delta, tone)", () => {
    const result = parseRichui(
      JSON.stringify({
        component: "metric",
        label: "Uptime",
        value: "99.9%",
        delta: "+1.2pp",
        tone: "success",
      }),
    );
    expect(result.ok).toBe(true);
    expect(metricSpec(result)).toEqual({
      component: "metric",
      label: "Uptime",
      value: "99.9%",
      delta: "+1.2pp",
      tone: "success",
    });
  });

  test("metric without label/delta/tone omits them", () => {
    const result = parseRichui(JSON.stringify({ component: "metric", value: "42" }));
    expect(result.ok).toBe(true);
    expect(metricSpec(result)).toEqual({ component: "metric", value: "42" });
  });

  test("coerces finite numbers for value and delta", () => {
    const result = parseRichui(JSON.stringify({ component: "metric", value: 12.5, delta: -3 }));
    expect(result.ok).toBe(true);
    const spec = metricSpec(result);
    expect(spec.value).toBe("12.5");
    expect(spec.delta).toBe("-3");
  });

  test("coerces booleans; 0 and false are valid values (not empty)", () => {
    const zero = parseRichui(JSON.stringify({ component: "metric", value: 0 }));
    expect(zero.ok).toBe(true);
    expect(metricSpec(zero).value).toBe("0");

    const flag = parseRichui(JSON.stringify({ component: "metric", value: false, delta: true }));
    expect(flag.ok).toBe(true);
    const spec = metricSpec(flag);
    expect(spec.value).toBe("false");
    expect(spec.delta).toBe("true");
  });

  test("rejects missing, blank or non-scalar value with a precise reason", () => {
    const missing = parseRichui(JSON.stringify({ component: "metric" }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain("value");

    expect(parseRichui(JSON.stringify({ component: "metric", value: "   " })).ok).toBe(false);
    expect(parseRichui(JSON.stringify({ component: "metric", value: "" })).ok).toBe(false);

    const object = parseRichui(JSON.stringify({ component: "metric", value: { a: 1 } }));
    expect(object.ok).toBe(false);
    if (!object.ok) expect(object.reason).toContain("value");

    expect(parseRichui(JSON.stringify({ component: "metric", value: [1] })).ok).toBe(false);
  });

  test("rejects object or array delta with a precise reason", () => {
    const object = parseRichui(
      JSON.stringify({ component: "metric", value: "1", delta: { x: 1 } }),
    );
    expect(object.ok).toBe(false);
    if (!object.ok) expect(object.reason).toContain("delta");

    expect(parseRichui(JSON.stringify({ component: "metric", value: "1", delta: [] })).ok).toBe(
      false,
    );
  });

  test("blank delta is dropped (optional field), metric stays valid", () => {
    const blank = parseRichui(JSON.stringify({ component: "metric", value: "1", delta: "   " }));
    expect(blank.ok).toBe(true);
    expect(metricSpec(blank).delta).toBeUndefined();
  });

  test("caps value at MAX_METRIC_VALUE_CHARS with an ellipsis", () => {
    const result = parseRichui(JSON.stringify({ component: "metric", value: "x".repeat(120) }));
    expect(result.ok).toBe(true);
    const value = metricSpec(result).value;
    expect(value.length).toBe(MAX_METRIC_VALUE_CHARS);
    expect(value.endsWith("…")).toBe(true);
  });

  test("caps delta at MAX_METRIC_DELTA_CHARS with an ellipsis", () => {
    const result = parseRichui(
      JSON.stringify({ component: "metric", value: "1", delta: "y".repeat(60) }),
    );
    expect(result.ok).toBe(true);
    const delta = metricSpec(result).delta;
    expect(delta?.length).toBe(MAX_METRIC_DELTA_CHARS);
    expect(delta?.endsWith("…")).toBe(true);
  });

  test("collapses label whitespace to a single line and caps it", () => {
    const result = parseRichui(
      JSON.stringify({ component: "metric", label: "  CPU   load\npeak  ", value: "7%" }),
    );
    expect(result.ok).toBe(true);
    const spec = metricSpec(result);
    expect(spec.label).toBe("CPU load peak");
    expect(spec.label?.length).toBeLessThanOrEqual(MAX_TITLE_CHARS);
  });

  test("tone is lowercased; invalid tone is dropped", () => {
    const ok = parseRichui(JSON.stringify({ component: "metric", value: "1", tone: "ERROR" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.spec.tone).toBe("error");

    const dropped = parseRichui(JSON.stringify({ component: "metric", value: "1", tone: "neon" }));
    expect(dropped.ok).toBe(true);
    expect(metricSpec(dropped).tone).toBeUndefined();
  });

  test("sanitises ANSI and expands tabs in value/delta", () => {
    const result = parseRichui(
      JSON.stringify({
        component: "metric",
        value: "\u001b[31m99\u001b[0m%",
        delta: "+2\tpp",
      }),
    );
    expect(result.ok).toBe(true);
    const spec = metricSpec(result);
    expect(spec.value).toBe("99%");
    expect(spec.delta).toBe("+2 pp");
    expect(spec.value).not.toContain("\u001b");
  });

  test("value normalizes CRLF and bare CR, then collapses to a single line", () => {
    // sanitize() rewrites \r\n → \n BEFORE the single-line collapse.
    const crlf = parseRichui(JSON.stringify({ component: "metric", value: "x\r\ny" }));
    expect(crlf.ok).toBe(true);
    expect(metricSpec(crlf).value).toBe("x y");

    // A bare \r (old-Mac line ending) takes the same path — no \r survives.
    const bareCr = parseRichui(JSON.stringify({ component: "metric", value: "p\rq" }));
    expect(bareCr.ok).toBe(true);
    expect(metricSpec(bareCr).value).toBe("p q");
  });

  test("never throws on adversarial metric input", () => {
    const adversarial = [
      "",
      "\u0000\u0001",
      JSON.stringify({ component: "metric" }),
      JSON.stringify({ component: "metric", value: null }),
      JSON.stringify({ component: "metric", value: Number.NaN }), // JSON.stringify → null
      JSON.stringify({ component: "metric", value: Number.POSITIVE_INFINITY }), // → null
      JSON.stringify({ component: "metric", value: "1", delta: { deep: { x: 1 } } }),
      JSON.stringify({ component: "metric", value: "1", label: 42 }), // dropped, not coerced
      JSON.stringify({ component: "metric", value: "1", tone: 7 }), // dropped, not coerced
    ];
    for (const input of adversarial) {
      expect(() => parseRichui(input)).not.toThrow();
    }
  });
});

describe("parseRichui — table", () => {
  const threeColumns = ["Name", "Score", "Unit"];

  test("parses a valid table with title and tone; coerces number/boolean cells", () => {
    const result = parseRichui(
      JSON.stringify({
        component: "table",
        title: "Results",
        columns: threeColumns,
        rows: [
          ["alpha", 1, "pt"],
          ["beta", true, "bool"],
        ],
        tone: "info",
      }),
    );
    expect(result.ok).toBe(true);
    expect(tableSpec(result)).toEqual({
      component: "table",
      title: "Results",
      columns: threeColumns,
      rows: [
        ["alpha", "1", "pt"],
        ["beta", "true", "bool"],
      ],
      tone: "info",
    });
  });

  test("empty rows array is valid, no truncatedRows", () => {
    const result = parseRichui(JSON.stringify({ component: "table", columns: ["A"], rows: [] }));
    expect(result.ok).toBe(true);
    const spec = tableSpec(result);
    expect(spec.rows).toEqual([]);
    expect(spec.truncatedRows).toBeUndefined();
  });

  test("requires a non-empty columns array", () => {
    const missing = parseRichui(JSON.stringify({ component: "table", rows: [] }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain("columns");

    expect(parseRichui(JSON.stringify({ component: "table", columns: [], rows: [] })).ok).toBe(
      false,
    );
    expect(parseRichui(JSON.stringify({ component: "table", columns: "A", rows: [] })).ok).toBe(
      false,
    );
  });

  test("accepts exactly MAX_TABLE_COLUMNS columns, rejects more", () => {
    const columns = Array.from({ length: MAX_TABLE_COLUMNS }, (_, i) => `c${i}`);
    expect(parseRichui(JSON.stringify({ component: "table", columns, rows: [] })).ok).toBe(true);

    const result = parseRichui(
      JSON.stringify({ component: "table", columns: [...columns, "overflow"], rows: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(`at most ${MAX_TABLE_COLUMNS}`);
  });

  test("rejects non-scalar headers with a 1-based column index", () => {
    const result = parseRichui(
      JSON.stringify({ component: "table", columns: ["A", { bad: true }], rows: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("column 2");
  });

  test("coerces numeric and boolean headers like cells", () => {
    const result = parseRichui(
      JSON.stringify({ component: "table", columns: [1, true], rows: [[2, false]] }),
    );
    expect(result.ok).toBe(true);
    const spec = tableSpec(result);
    expect(spec.columns).toEqual(["1", "true"]);
    expect(spec.rows).toEqual([["2", "false"]]);
  });

  test("requires a rows array", () => {
    const result = parseRichui(JSON.stringify({ component: "table", columns: ["A"] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("rows");
  });

  test("rejects a row that is not an array (1-based row index)", () => {
    const result = parseRichui(
      JSON.stringify({ component: "table", columns: ["A"], rows: [["ok"], "bad"] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("table row 2");
  });

  test("rejects row length mismatch with an exact reason", () => {
    const result = parseRichui(
      JSON.stringify({
        component: "table",
        columns: threeColumns,
        rows: [["a", "b", "c"], ["only-one"]],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("table row 2 has 1 cell(s), expected 3");
  });

  test("rejects non-scalar cells with a precise 1-based location", () => {
    const result = parseRichui(
      JSON.stringify({ component: "table", columns: ["A", "B"], rows: [["ok", { nope: 1 }]] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("row 1 cell 2");
  });

  test("caps rows at MAX_TABLE_ROWS and reports the dropped count", () => {
    const rows = Array.from({ length: MAX_TABLE_ROWS + 5 }, () => ["x"]);
    const result = parseRichui(JSON.stringify({ component: "table", columns: ["A"], rows }));
    expect(result.ok).toBe(true);
    const spec = tableSpec(result);
    expect(spec.rows.length).toBe(MAX_TABLE_ROWS);
    expect(spec.truncatedRows).toBe(5);
  });

  test("exactly MAX_TABLE_ROWS → kept in full, no truncatedRows", () => {
    const rows = Array.from({ length: MAX_TABLE_ROWS }, () => ["x"]);
    const result = parseRichui(JSON.stringify({ component: "table", columns: ["A"], rows }));
    expect(result.ok).toBe(true);
    expect(tableSpec(result).truncatedRows).toBeUndefined();
  });

  test("caps headers and cells at MAX_CELL_CHARS with an ellipsis", () => {
    const long = "z".repeat(MAX_CELL_CHARS + 40);
    const result = parseRichui(
      JSON.stringify({ component: "table", columns: [long], rows: [[long]] }),
    );
    expect(result.ok).toBe(true);
    const spec = tableSpec(result);
    expect(spec.columns[0]?.length).toBe(MAX_CELL_CHARS);
    expect(spec.rows[0]?.[0]?.length).toBe(MAX_CELL_CHARS);
    expect(spec.columns[0]?.endsWith("…")).toBe(true);
  });

  test("sanitises cells: ANSI stripped, tabs expanded, interior newline kept", () => {
    const result = parseRichui(
      JSON.stringify({
        component: "table",
        columns: ["Head"],
        rows: [["\u001b[1mval\u001b[0m\tue\nsecond"]],
      }),
    );
    expect(result.ok).toBe(true);
    const cell = tableSpec(result).rows[0]?.[0];
    expect(cell).toBe("val  ue\nsecond");
    expect(cell).not.toContain("\u001b");
  });

  test("cell CRLF is normalized to LF (no CR survives sanitization)", () => {
    // sanitize() rewrites \r\n → \n before cell normalization: the interior
    // newline is kept (cells stay multi-line), no carriage return remains.
    const result = parseRichui(
      JSON.stringify({ component: "table", columns: ["C"], rows: [["a\r\nb"]] }),
    );
    expect(result.ok).toBe(true);
    const cell = tableSpec(result).rows[0]?.[0];
    expect(cell).toBe("a\nb");
    expect(cell).not.toContain("\r");
  });

  test("collapses title whitespace; blank title is omitted", () => {
    const ok = parseRichui(
      JSON.stringify({
        component: "table",
        columns: ["A"],
        rows: [],
        title: "  My   table\nof  truth  ",
      }),
    );
    expect(ok.ok).toBe(true);
    expect(tableSpec(ok).title).toBe("My table of truth");

    const blank = parseRichui(
      JSON.stringify({ component: "table", columns: ["A"], rows: [], title: "   " }),
    );
    expect(blank.ok).toBe(true);
    expect(tableSpec(blank).title).toBeUndefined();
  });

  test("tone is lowercased; invalid tone is dropped", () => {
    const ok = parseRichui(
      JSON.stringify({ component: "table", columns: ["A"], rows: [], tone: "WARNING" }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.spec.tone).toBe("warning");

    const dropped = parseRichui(
      JSON.stringify({ component: "table", columns: ["A"], rows: [], tone: "vibes" }),
    );
    expect(dropped.ok).toBe(true);
    expect(tableSpec(dropped).tone).toBeUndefined();
  });

  test("never throws on adversarial table input", () => {
    const adversarial = [
      "",
      "\u0000\u0001",
      JSON.stringify({ component: "table" }),
      JSON.stringify({ component: "table", columns: [["x"]], rows: [] }),
      JSON.stringify({ component: "table", columns: ["A"], rows: "nope" }),
      JSON.stringify({ component: "table", columns: ["A"], rows: [42] }),
      JSON.stringify({ component: "table", columns: ["A"], rows: [[null]] }),
      JSON.stringify({ component: "table", columns: ["A"], rows: [["a"], ["b"], ["c"]] }),
      JSON.stringify({ component: "table", columns: ["A"], rows: [], title: 5 }),
      JSON.stringify({ component: "table", columns: ["A"], rows: [], tone: 9 }),
    ];
    for (const input of adversarial) {
      expect(() => parseRichui(input)).not.toThrow();
    }
  });
});
