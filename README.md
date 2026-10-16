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

## Format (Phase 0 — Panel)

```jsonc
{
  "component": "panel",        // discriminant (panel ; metric/table/chart/review prévus)
  "title": "…",                // optionnel, replié sur une ligne (max 80 car)
  "body": "…",                 // requis, multi-lignes ; tabs → 2 espaces, séquences ANSI/C0 retirées, espacement intérieur préservé
  "tone": "info"               // optional: neutral|info|success|warning|error
}
```

Tout bloc `richui` invalide (JSON cassé, champs manquants, composant inconnu)
reste affiché comme **code block par défaut** — le contenu n'est jamais perdu.

## Architecture (4 couches)

| Couche | Fichiers | Responsabilité |
|---|---|---|
| `core` | `schema.ts`, `parse.ts` | parsing total (jamais de throw), validation, normalisation |
| `components` | `panel.ts` | widgets OpenTUI purs (Box+Text), couleurs du thème |
| `layout` | `width.ts` | largeur en cellules (CJK/emoji), wrap mots + rupture dure O(n) + cap, troncature, seuil 40 col |
| `adapter` | `opencode-api.ts`, `opentui.ts`, `theme.ts`, `plugin.ts` | contrat OpenCode vérifié, bridge never-throw, cycle de vie |

## Développement

```bash
bun install
bun run check        # tsc --noEmit (strict) + bun test
bun test             # 60 tests (unitaires + rendu headless @opentui/core/testing)
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
