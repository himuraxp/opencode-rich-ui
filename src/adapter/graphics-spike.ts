/**
 * adapter/graphics-spike.ts — Étape 1 du POC graphics (spike hôte).
 *
 * OBJECTIF : prouver ou réfuter que le dispatch markdown d'OpenCode accepte
 * un `ImageRenderable` retourné par le callback `registerCodeBlockRenderer`,
 * avec un PNG statique — AUCUNE dépendance ajoutée (pas de resvg ici).
 *
 * Activé UNIQUEMENT par RICHUI_SPIKE_IMAGE=1 (jamais en production) :
 * - chaque bloc `richui` est remplacé par l'image spike ;
 * - le protocole effectif choisi par le runtime (auto → kitty|sixel|blocks)
 *   et les événements de cycle de vie sont journalisés dans
 *   RICHUI_SPIKE_DEBUG (fichier) pour le rapport d'audit.
 *
 * Hypothèses testées :
 * - H1 : l'hôte peint l'image (blocks attendus en PTY xterm-256color).
 * - H2 : le scroll/resize/teardown ne crashent pas (cycle D6).
 * - H3 : le protocole effectif est observable (journalisé ici).
 */

import { ImageRenderable } from "@opentui/core";
import { appendFileSync } from "node:fs";
import type { TuiPluginContext } from "./opencode-api.ts";

export function spikeEnabled(): boolean {
  return process.env.RICHUI_SPIKE_IMAGE === "1";
}

function spikeLog(line: string): void {
  const path = process.env.RICHUI_SPIKE_DEBUG;
  if (!path) return;
  try {
    appendFileSync(path, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // Le journal est best-effort : jamais d'erreur au host.
  }
}

function spikeProtocol(): "auto" | "kitty" | "sixel" | "blocks" {
  const p = process.env.RICHUI_SPIKE_PROTOCOL;
  return p === "kitty" || p === "sixel" || p === "blocks" ? p : "auto";
}

/** Un ImageRenderable minimal à partir d'un PNG statique sur disque. */
export function buildSpikeImage(
  context: TuiPluginContext,
  blockIndex: number,
): ImageRenderable {
  const source = process.env.RICHUI_SPIKE_IMAGE_PATH;
  if (!source) throw new Error("RICHUI_SPIKE_IMAGE_PATH is not set");

  const width = Math.max(20, Math.min(60, (safeWidth(context.renderer) | 0) - 6));
  // 640x200 source → ratio 0.3125 → ~13 cellules de haut à 40 cellules de large.
  const height = Math.max(4, Math.round(width * (200 / 640)));

  const image = new ImageRenderable(context.renderer as never, {
    source,
    // Spike allows forcing the protocol to observe kitty/sixel emission
    // even when the PTY declares no graphics capability (audit step 1).
    ...(spikeProtocol() !== "auto" ? { protocol: spikeProtocol() } : { protocol: "auto" as const }),
    fit: "fit",
    width,
    height,
  });

  image.onLoad = (loaded) => {
    spikeLog(
      `block=${blockIndex} onLoad effective=${image.effectiveProtocol} ` +
        `px=${loaded.width}x${loaded.height} cells=${width}x${height}`,
    );
  };
  image.onError = (error) => {
    spikeLog(`block=${blockIndex} onError ${String(error)}`);
  };
  spikeLog(`block=${blockIndex} constructed requested=auto cells=${width}x${height}`);
  return image;
}

function safeWidth(renderer: { readonly width: number }): number {
  const width = Number(renderer?.width);
  return Number.isFinite(width) && width >= 1 ? width : 80;
}
