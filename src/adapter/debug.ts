/**
 * adapter/debug.ts — Dev-only lifecycle diagnostics.
 *
 * Enabled by OPENCODE_RICHUI_DEBUG=<dir>; appends stage markers to
 * <dir>/richui-debug.log. Never enabled in production, never throws, never
 * touches anything else — diagnostics must not be able to break the plugin.
 */

import { appendFileSync } from "node:fs";

export function debug(stage: string, detail: string = ""): void {
  const dir = process.env["OPENCODE_RICHUI_DEBUG"];
  if (!dir) return;
  try {
    appendFileSync(`${dir}/richui-debug.log`, `${new Date().toISOString()} ${stage} ${detail}\n`);
  } catch {
    // diagnostics must never break the plugin
  }
}
