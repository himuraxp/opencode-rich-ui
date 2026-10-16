# opencode-rich-ui

Plugin TUI **OpenCode 2.0** qui transforme des blocs Markdown ` ```richui `
en composants natifs dans le terminal — pendant et après le streaming.

```richui
{
  "component": "panel",
  "title": "Déploiement production",
  "body": "Build #4217 déployé en 42s. Healthchecks verts sur les 12 instances.",
  "tone": "success"
}
```

Un agent produit ce bloc comme du simple Markdown (aucun outil requis) ;
le contenu est du **JSON déclaratif strict** — jamais exécuté.

## Installation (dev)

1. Cloner ce dépôt et `bun install` (dépendances de typage uniquement :
   le runtime utilise l'instance OpenTUI de l'hôte).
2. Enregistrer le **répertoire** du plugin dans `~/.config/opencode/cli.json` :

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["file:///chemin/vers/opencode-rich-ui"]
}
```

> Convention du chargeur OpenCode 2.0 : l'entrée `file://` pointe vers un
> **répertoire** contenant `tui.<ext>` (un `file://` vers un fichier est
> silencieusement ignoré). Ce dépôt expose `tui.ts` à sa racine.

3. Lancer `opencode` : le plugin se charge, se ré-enregistre à chaud à chaque
   modification de ses sources (watcher intégré).

## Format (Phase 0 — Panel · Lot 1 — Metric, Table)

```jsonc
// Panel : texte riche cadré
{
  "component": "panel",
  "title": "…",                // optionnel, replié sur une ligne (max 80 car)
  "body": "…",                 // requis, multi-lignes ; tabs → 2 espaces, séquences ANSI/C0 retirées, espacement intérieur préservé
  "tone": "info"               // optional: neutral|info|success|warning|error
}

// Metric : valeur mise en avant (accent), delta directionnel (signe → ▲/▼)
{
  "component": "metric",
  "label": "…",                // optionnel (max 80 car)
  "value": "94.2%",            // requis — string ou nombre JSON
  "delta": "+1.3",             // optionnel — le signe en tête devient la flèche
  "tone": "success"
}

// Table : colonnes au contenu, cellules wrappées, zéro débordement du canevas
{
  "component": "table",
  "title": "…",                // optionnel
  "columns": ["Fichier", "Statut"],     // 1 à 8 ; nombres/booléens JSON acceptés
  "rows": [["parse.ts", "ok"], ["width.ts", true]],  // longueur = columns
  "tone": "success"
}
```

Tout bloc `richui` invalide (JSON cassé, champs manquants, composant inconnu)
reste affiché comme **code block par défaut** — le contenu n'est jamais perdu.

## Architecture (4 couches)

| Couche | Fichiers | Responsabilité |
|---|---|---|
| `core` | `schema.ts`, `parse.ts` | parsing total (jamais de throw), validation, normalisation |
| `components` | `chrome.ts`, `panel.ts`, `metric.ts`, `table.ts` | chrome partagé (bordered/compact) + widgets OpenTUI purs, couleurs du thème |
| `layout` | `width.ts` | largeur en cellules (CJK/emoji), wrap mots + rupture dure O(n) + cap, troncature, seuil 40 col |
| `adapter` | `opencode-api.ts`, `opentui.ts`, `theme.ts`, `plugin.ts` | contrat OpenCode vérifié, bridge never-throw, cycle de vie |

## Développement

```bash
bun install
bun run check        # tsc --noEmit (strict) + bun test
bun test             # 108 tests (unitaires + rendu headless @opentui/core/testing)
```

Diagnostic (dev) : `OPENCODE_RICHUI_DEBUG=<dir> opencode` journalise le cycle
de vie (`module-import`, `setup-called`, `register-ok`, `unregister-ok`)
dans `<dir>/richui-debug.log`.

## Documentation

- `docs/REPORT.md` — rapport Phase 0 (preuves d'exécution, limitations, suite)
- `docs/adr/ADR-001-inline-rendering.md` — stratégie de rendu inline et de repli
- `examples/richui-examples.md` — exemples de blocs

## Licence

MIT
