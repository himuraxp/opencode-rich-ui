/**
 * index.ts — Public entry loaded by OpenCode via cli.json (`file://` specifier).
 *
 * The V2 TUI plugin loader requires a default export of shape
 * `{ id: string (non-empty), setup: function }`.
 */

export { default } from "./adapter/plugin.ts";
export { PLUGIN_ID } from "./adapter/plugin.ts";
export { parseRichui } from "./core/parse.ts";
export { RICHUI_LANGUAGE, type ParseResult, type RichuiSpec } from "./core/schema.ts";
export { layoutFor, hardWrap, truncateToWidth, visualLength } from "./layout/width.ts";
export { buildPanel } from "./components/panel.ts";
