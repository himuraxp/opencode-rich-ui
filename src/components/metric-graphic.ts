/**
 * components/metric-graphic.ts — Étape 2 du POC graphics : METRIC haute
 * fidélité (SVG → resvg → PNG bytes → ImageRenderable côté adapter).
 *
 * Mêmes données que le METRIC natif (contrat JSON inchangé) — seule la
 * STRATÉGIE DE RENDU change (backend alternatif, ratifié au review).
 * Design : label discret, valeur dominante, delta associé à droite, fond
 * transparent (le fond du terminal), SANS bordure, couleurs = tokens du
 * thème hôte — jamais de couleur codée en dur.
 *
 * Tout est SYNCHRONE ici (le callback renderer est sync) : le module resvg
 * est préchargé au setup (adapter/graphics.ts), l'échec → GraphicsUnavailable
 * → rendu natif.
 */

import { existsSync } from "node:fs";
import type { MetricSpec } from "../core/schema.ts";
import { cssColor, type ComponentPalette } from "../adapter/theme.ts";
import { graphicsBackend, GraphicsUnavailableError } from "../adapter/graphics.ts";
import { visualLength } from "../layout/width.ts";

export interface MetricGraphicResult {
  png: Uint8Array;
  widthCells: number;
  heightCells: number;
  timings: { svgMs: number; rasterMs: number; totalMs: number };
}

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Menlo.ttc", // macOS
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", // linux
] as const;

function findFontFile(): string | undefined {
  return FONT_CANDIDATES.find((p) => existsSync(p));
}

/** XML-escape agent-provided text (never trust spec content). */
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Prefix a direction arrow from the delta's leading sign (same rule as native). */
function deltaWithArrow(delta: string): string {
  const trimmed = delta.trim();
  if (trimmed.startsWith("+")) return `▲ ${trimmed.slice(1).trim()}`;
  if (trimmed.startsWith("-") || trimmed.startsWith("−")) {
    return `▼ ${trimmed.slice(1).trim()}`;
  }
  return trimmed;
}

export function buildMetricGraphicPng(options: {
  spec: MetricSpec;
  palette: ComponentPalette;
  terminalWidth: number;
  resolution?: { readonly width: number; readonly height: number } | null;
}): MetricGraphicResult {
  const start = performance.now();
  const { spec, palette, terminalWidth, resolution } = options;

  const resvg = graphicsBackend().resvg;
  if (!resvg) throw new GraphicsUnavailableError("resvg not preloaded (opt-in off or load failed)");

  // Colors come ONLY from the theme tokens, normalized to CSS (the host RGBA
  // shape {r,g,b} is not valid SVG fill — it silently renders black, the
  // contrast bug caught in the Étape-2 review). A missing/unusable token
  // means the graphic backend cannot honor the theme → native takes over.
  const accent = cssColor(palette.title);
  const muted = cssColor(palette.muted);
  if (!accent || !muted) throw new GraphicsUnavailableError("theme tokens incomplete");

  // Cell geometry: prefer the host-reported pixel resolution; otherwise a
  // conservative 2× of the classic 7×14 cell. Width comes from the canvas.
  const pxPerCellX = resolution ? Math.max(2, Math.round(resolution.width / terminalWidth)) * 2 : 14;
  const pxPerCellY = pxPerCellX * 2;

  const widthCells = Math.max(24, Math.min(56, Math.floor(terminalWidth) - 6));
  const pxW = widthCells * pxPerCellX;
  const pad = pxPerCellX;
  const innerW = pxW - pad * 2;

  const label = (spec.label ?? "").toUpperCase();
  const value = spec.value;
  const delta = spec.delta !== undefined ? deltaWithArrow(spec.delta) : undefined;

  // Fit checks (same no-overflow discipline as the native renderer).
  const valueFont = Math.round(pxPerCellY * 0.62);
  const labelFont = Math.round(pxPerCellY * 0.26);
  const deltaFont = Math.round(pxPerCellY * 0.3);
  // Rough advance ≈ 0.62 × font size per char (Menlo mono); if the value
  // cannot fit with room for the delta, drop the delta to its own line.
  const valuePx = visualLength(value) * valueFont * 0.62;
  const deltaPx = delta !== undefined ? visualLength(delta) * deltaFont * 0.62 : 0;
  const sameLine = delta === undefined || valuePx + deltaPx + pad <= innerW;

  const valueY = pxPerCellY * 1.05 + valueFont;
  const labelY = pxPerCellY * 0.55 + labelFont;
  const pxH = Math.round(valueY + pxPerCellY * 0.45);

  const deltaText =
    delta === undefined
      ? ""
      : sameLine
        ? `<text x="${pxW - pad}" y="${valueY}" text-anchor="end" font-family="Menlo, monospace" font-size="${deltaFont}" fill="${muted}">${esc(delta)}</text>`
        : `<text x="${pad}" y="${Math.min(pxH - pxPerCellY * 0.3, valueY + deltaFont * 1.4)}" font-family="Menlo, monospace" font-size="${deltaFont}" fill="${muted}">${esc(delta)}</text>`;

  const svgMs = performance.now() - start;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">`,
    label
      ? `<text x="${pad}" y="${labelY}" font-family="Menlo, monospace" font-size="${labelFont}" letter-spacing="${(labelFont * 0.12).toFixed(1)}" fill="${muted}">${esc(label)}</text>`
      : "",
    `<text x="${pad}" y="${valueY}" font-family="Menlo, monospace" font-size="${valueFont}" font-weight="bold" fill="${accent}">${esc(value)}</text>`,
    deltaText,
    "</svg>",
  ].join("");

  const rasterStart = performance.now();
  const fontFile = findFontFile();
  const resvgInstance = new resvg.Resvg(svg, {
    font: fontFile
      ? { fontFiles: [fontFile], loadSystemFonts: false, defaultFontFamily: "Menlo" }
      : { loadSystemFonts: true, defaultFontFamily: "monospace" },
  });
  const png = resvgInstance.render().asPng();
  const heightCells = Math.max(2, Math.round(pxH / pxPerCellY));
  const rasterMs = performance.now() - rasterStart;

  return {
    png,
    widthCells,
    heightCells,
    timings: { svgMs, rasterMs, totalMs: performance.now() - start },
  };
}
