/**
 * adapter/graphics.ts — Étape 2 du POC graphics : backend image opt-in.
 *
 * Politique ratifiée (review ChatGPT, GO étape 2) :
 * - NATIF PAR DÉFAUT : le rendu graphique n'existe qu'avec RICHUI_GRAPHICS=1.
 * - FILTRE PROTOCOLE : graphique UNIQUEMENT si le protocole résolu par le
 *   runtime est kitty|sixel. blocks/inconnu → natif (on ne force jamais
 *   kitty sur un terminal qui ne le déclare pas ; la variable
 *   RICHUI_GRAPHICS_FORCE_PROTOCOL est TEST-ONLY, pour observer l'émission
 *   dans le harnais headless).
 * - DOUBLE FALLBACK : JSON invalide → ctx.defaultRender() (opentui.ts) ;
 *   JSON valide + échec graphique → rendu natif. Toute exception, y compris
 *   le chargement lazy de resvg, est interceptée.
 * - La dépendance native resvg n'est JAMAIS chargée dans le chemin normal du
 *   plugin : import dynamique au setup, uniquement si l'opt-in est actif.
 */

import { appendFileSync } from "node:fs";
import { ImageRenderable } from "@opentui/core";
import type { ImageRenderProtocol } from "@opentui/core";

type ResvgModule = typeof import("@resvg/resvg-js");

export interface GraphicsBackend {
  /** Loaded lazily at setup time — null when opt-in is off or load failed. */
  resvg: ResvgModule | null;
  /** Mensuration de l'échec de chargement (audit). */
  loadError: string | null;
  loadMs: number | null;
}

const backend: GraphicsBackend = { resvg: null, loadError: null, loadMs: null };

export function graphicsOptIn(): boolean {
  return process.env.RICHUI_GRAPHICS === "1";
}

/** Test-only protocol override (audit of emission paths in headless PTY). */
export function graphicsForcedProtocol(): ImageRenderProtocol | null {
  const p = process.env.RICHUI_GRAPHICS_FORCE_PROTOCOL;
  return p === "kitty" || p === "sixel" || p === "blocks" ? p : null;
}

/**
 * Pre-load resvg at plugin setup — ONLY when the opt-in is active. Any
 * failure is recorded (never thrown): the native renderer stays in charge.
 */
export async function preloadGraphics(): Promise<void> {
  if (!graphicsOptIn() || backend.resvg !== null) return;
  const start = performance.now();
  try {
    const mod = await import("@resvg/resvg-js");
    backend.resvg = mod as ResvgModule;
    backend.loadMs = performance.now() - start;
    graphicsLog(`resvg loaded in ${backend.loadMs.toFixed(1)} ms (lazy, opt-in)`);
  } catch (error) {
    backend.loadError = (error as Error).message;
    graphicsLog(`resvg load FAILED: ${backend.loadError} → native only`);
  }
}

export function graphicsBackend(): GraphicsBackend {
  return backend;
}

export function graphicsLog(line: string): void {
  const path = process.env.RICHUI_GRAPHICS_DEBUG;
  if (!path) return;
  try {
    appendFileSync(path, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // Journal best-effort : jamais d'erreur au host.
  }
}

/** Erreurs du backend graphique — chaque type a un fallback natif dédié. */
export class GraphicsUnavailableError extends Error {}
export class GraphicsProtocolUnsupportedError extends Error {
  constructor(
    public readonly protocol: string,
  ) {
    super(`graphics protocol not allowed: ${protocol}`);
  }
}

/**
 * Le protocole demandé est-il autorisé pour le rendu graphique ?
 * kitty|sixel → oui ; auto/blocks → non (qualité non garantie, politique
 * ratifiée : blocks ≠ déclencheur du mode graphique).
 */
export function protocolAllowsGraphics(protocol: string): boolean {
  return protocol === "kitty" || protocol === "sixel";
}

/**
 * Wrap rasterized PNG bytes into an inline ImageRenderable, then ENFORCE the
 * ratified protocol policy on the RESOLVED protocol (never on the request):
 * blocks/unknown → destroy the image and report an unsupported protocol so
 * the caller falls back to the native renderer. Test-only forcing
 * (RICHUI_GRAPHICS_FORCE_PROTOCOL) exists to audit emission paths headless.
 */
export function buildGraphicRenderable(options: {
  png: Uint8Array;
  widthCells: number;
  heightCells: number;
  renderer: unknown;
}): ImageRenderable {
  const forced = graphicsForcedProtocol();
  const image = new ImageRenderable(options.renderer as never, {
    source: options.png,
    ...(forced !== null ? { protocol: forced } : { protocol: "auto" as const }),
    fit: "fit",
    width: options.widthCells,
    height: options.heightCells,
  });
  const effective: string = image.effectiveProtocol;
  graphicsLog(
    `graphic-renderable protocol=${effective} cells=${options.widthCells}x${options.heightCells}`,
  );
  if (!protocolAllowsGraphics(effective)) {
    try {
      image.destroy();
    } catch {
      // Déjà détruit (abort du load) : pas grave, on dégrade vers le natif.
    }
    throw new GraphicsProtocolUnsupportedError(effective);
  }
  return image;
}
