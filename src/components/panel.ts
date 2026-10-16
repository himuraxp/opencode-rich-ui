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
 * - The chrome budget (borders + padding) comes from LayoutProfile.innerWidth
 *   — single source of truth for both layout modes.
 *
 * Lifecycle: the host rebuilds blocks on content updates and destroys the
 * previous tree itself (verified: clearBlockStates() calls
 * destroyRecursively() on every block renderable). Our duty is to never leak
 * a PARTIALLY built tree: any construction failure destroys the box before
 * rethrowing (the adapter converts the failure into the default rendering).
 */

import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { PanelSpec } from "../core/schema.ts";
import { hardWrap, layoutFor, truncateToWidth } from "../layout/width.ts";
import type { PanelPalette } from "../adapter/theme.ts";
import type { RenderContextLike } from "../adapter/opencode-api.ts";

export function buildPanel(options: {
  spec: PanelSpec;
  palette: PanelPalette;
  terminalWidth: number;
  renderer: RenderContextLike;
}): BoxRenderable {
  const { spec, palette, terminalWidth, renderer } = options;
  const profile = layoutFor(terminalWidth);

  if (profile.bordered) {
    return buildBorderedPanel(spec, palette, profile, renderer);
  }
  return buildCompactPanel(spec, palette, profile, renderer);
}

/** Destroy a partially built box after a construction failure (best effort). */
function destroyBox(box: BoxRenderable | undefined): void {
  try {
    box?.destroyRecursively();
  } catch {
    // Never mask the original construction error.
  }
}

function buildBorderedPanel(
  spec: PanelSpec,
  palette: PanelPalette,
  profile: ReturnType<typeof layoutFor>,
  renderer: RenderContextLike,
): BoxRenderable {
  let box: BoxRenderable | undefined;
  try {
    const textWidth = profile.innerWidth;
    const bodyLines = hardWrap(spec.body, textWidth);

    box = new BoxRenderable(renderer, {
      width: profile.width,
      height: bodyLines.length + 2,
      border: true,
      borderStyle: "rounded",
      ...(palette.border !== undefined ? { borderColor: palette.border } : {}),
      ...(spec.title
        ? {
            title: truncateToWidth(spec.title, textWidth),
            ...(palette.title !== undefined ? { titleColor: palette.title } : {}),
          }
        : {}),
    });

    box.add(buildBodyText(renderer, bodyLines, palette));
    return box;
  } catch (error) {
    destroyBox(box);
    throw error;
  }
}

function buildCompactPanel(
  spec: PanelSpec,
  palette: PanelPalette,
  profile: ReturnType<typeof layoutFor>,
  renderer: RenderContextLike,
): BoxRenderable {
  let box: BoxRenderable | undefined;
  try {
    const textWidth = profile.innerWidth;
    const lines: string[] = [];
    if (spec.title) lines.push(truncateToWidth(spec.title, textWidth));
    lines.push(...hardWrap(spec.body, textWidth));

    box = new BoxRenderable(renderer, {
      width: profile.width,
      height: lines.length,
      border: ["left"],
      ...(palette.border !== undefined ? { borderColor: palette.border } : {}),
    });

    const titled = spec.title !== undefined;
    if (titled && lines.length > 0) {
      const heading = lines[0] as string;
      box.add(
        new TextRenderable(renderer, {
          content: heading,
          wrapMode: "none",
          selectable: false,
          paddingLeft: 1,
          ...(palette.title !== undefined ? { fg: palette.title } : {}),
        }),
      );
    }
    const bodyLines = titled ? lines.slice(1) : lines;
    if (bodyLines.length > 0) {
      box.add(
        new TextRenderable(renderer, {
          content: bodyLines.join("\n"),
          wrapMode: "none",
          selectable: false,
          paddingLeft: 1,
          ...(palette.text !== undefined ? { fg: palette.text } : {}),
        }),
      );
    }
    return box;
  } catch (error) {
    destroyBox(box);
    throw error;
  }
}

function buildBodyText(
  renderer: RenderContextLike,
  bodyLines: string[],
  palette: PanelPalette,
): TextRenderable {
  return new TextRenderable(renderer, {
    content: bodyLines.join("\n"),
    wrapMode: "none",
    selectable: false,
    paddingLeft: 1,
    paddingRight: 1,
    ...(palette.text !== undefined ? { fg: palette.text } : {}),
  });
}
