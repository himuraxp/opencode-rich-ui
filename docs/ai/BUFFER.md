# BUFFER

## Snapshot de reprise (2026-10-16, fin Lot 1)
État : Phase 0 + Lot 1 livrés (gate ratifié). Commit Lot 1 en attente via Spark.

### Dernières preuves obtenues
- Tests : 108/108 verts (1871 assertions), tsc strict 0 erreur
- E2E E9 : 4 blocs richui inline (panels Build/Checks, metric ▲ 94.2%,
  table Files/parse.ts/12ms) — vus peints (balayage pyte), zéro repli
  textuel en frame finale, 110 et 60 col
- Review Lot 1 : 2 HIGH (débordement compact multi-colonnes, notices non
  clampées) corrigés et verrouillés par 8 tests narrow

### Fichiers impactés (Lot 1)
`src/components/{chrome,metric,table}.ts` (nouveaux), `src/components/panel.ts`
(refactor chrome), `src/core/{schema,parse}.ts`, `src/layout/width.ts`,
`src/adapter/{opentui,theme}.ts`, `src/index.ts`, `test/*` (5),
`examples/richui-examples.md`, docs.

### Si reprise
1. `bun run check` doit rester vert (108 tests + tsc strict).
2. Config active : `~/.config/opencode/cli.json` pointe vers
   `file:///Users/yohannlarbi/dev/opencode-rich-ui` (répertoire).
3. Harnais E2E reproductible : voir docs/ai/INDEX.md section hors repo
   (mock 4 blocs, marqueurs discriminants — cf. WARNINGS W-04).
4. Suite : commit via Spark, puis Lot 2 (Chart) si l'utilisateur valide.
