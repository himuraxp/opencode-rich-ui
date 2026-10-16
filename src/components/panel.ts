/**
 * components/panel.ts — Phase 0 visual component: Panel.
 *
 * Built from OpenTUI core widgets only (BoxRenderable + TextRenderable), which
 * the plugin loader resolves against the HOST's bundled @opentui/core instance
 * (runtime-module shim) — no runtime dependency on our own node_modules copy.
 *
 * Layout contract (see layout/width.ts):
 * - width >= 40: rounded border box, title on the border, body word-wrapped.
 * - width < 40 : compact form — colored left rule via border: ["left"], title
 *   as a first accent-colored line, no box chrome.
 * - Box chrome is shared with metric/table via components/chrome.ts.
 *
 * Lifecycle: the host rebuilds blocks on content updates and destroys the
 * previous tree itself (verified: clearBlockStates() calls
 * destroyRecursively() on every block renderable). Our duty is to never leak
 * a PARTIALLY built tree: any construction failure destroys the box before
 * rethrowing (the adapter converts the failure into the default rendering).
 */

import type { BoxRenderable } from "@opentui/core";
import type { PanelSpec } from "../core/schema.ts";
import { hardWrap, layoutFor, truncateToWidth } from "../layout/width.ts";
import type { ComponentPalette } from "../adapter/theme.ts";
import type { RenderContextLike } from "../adapter/opencode-api.ts";
import {
  createBorderedBox,
  createCompactBox,
  destroyBox,
  textBlock,
} from "./chrome.ts";

export function buildPanel(options: {
  spec: PanelSpec;
  palette: ComponentPalette;
  terminalWidth: number;
  renderer: RenderContextLike;
}): BoxRenderable {
  const { spec, palette, terminalWidth, renderer } = options;
  const profile = layoutFor(terminalWidth);
  const bodyLines = hardWrap(spec.body, profile.innerWidth);

  if (profile.bordered) {
    let box: BoxRenderable | undefined;
    try {
      box = createBorderedBox(renderer, {
        profile,
        palette,
        ...(spec.title !== undefined ? { title: spec.title } : {}),
        height: bodyLines.length + 2,
      });
      box.add(textBlock(renderer, bodyLines.join("\n"), palette.text, { left: 1, right: 1 }));
      return box;
    } catch (error) {
      destroyBox(box);
      throw error;
    }
  }

  let box: BoxRenderable | undefined;
  try {
    const lines: string[] = [];
    if (spec.title) lines.push(truncateToWidth(spec.title, profile.innerWidth));
    lines.push(...bodyLines);

    box = createCompactBox(renderer, { profile, palette, height: lines.length });
    const titled = spec.title !== undefined;
    if (titled && lines.length > 0) {
      box.add(textBlock(renderer, lines[0] as string, palette.title, { left: 1 }));
    }
    const bodyOnly = titled ? lines.slice(1) : lines;
    if (bodyOnly.length > 0) {
      box.add(textBlock(renderer, bodyOnly.join("\n"), palette.text, { left: 1 }));
    }
    return box;
  } catch (error) {
    destroyBox(box);
    throw error;
  }
}
