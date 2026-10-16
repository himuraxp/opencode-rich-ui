/**
 * tui.ts — TUI plugin entrypoint, per the OpenCode loader convention:
 * a cli.json `file://` entry must reference a DIRECTORY; the host resolves
 * `<directory>/tui` (Bun extension probing: .ts/.tsx/.js/…).
 *
 * This file exists only to satisfy that convention; the implementation lives
 * in src/ (4-layer architecture, see README).
 */

export { default } from "./src/index.ts";
