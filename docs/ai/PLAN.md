# PLAN

## Phase 0 — POC (TERMINÉE 2026-10-16)
1. [x] Inspecter l'environnement (opencode 2.0.30, Bun 1.3.14, @opentui/core 0.6.6)
2. [x] Extraire le contrat du SDK plugin depuis le binaire + typings + plugin de production
3. [x] Contrat `context.markdown.registerCodeBlockRenderer()` documenté (ADR-001)
4. [x] Plugin CLI minimal TypeScript strict (4 couches)
5. [x] Chargement vérifié via cli.json (convention répertoire + `tui.ts`)
6. [x] Renderer `richui` enregistré
7. [x] Composant Panel (couleurs thème, layout étroit)
8. [x] Rendu inline pendant + après streaming (E2E PTY + mock SSE)
9. [x] Fallback, nettoyage (unregister), rechargement à chaud vérifiés
10. [x] Tests (108) + docs (REPORT, ADR-001, README, examples)

## Lot 1 — Metric + Table (TERMINÉ 2026-10-16, gate ratifié)
11. [x] Specs + parseur (coercition, caps, fails précis)
12. [x] Chrome partagé (extraction panel) + metric + table
13. [x] Tests (47 parse, 23 render, 23 width, 5 theme, 10 plugin = 108)
14. [x] Review adversariale + corrections (2 HIGH narrow) + tests de régression
15. [x] E2E E9 (4 blocs inline, zéro repli final, 110/60 col)

## Phase suivante (après accord)
- Lot 2 : Chart + cache last-good streaming
- Lot 3 : Review + vue détaillée ui.panel
- Industrialisation : build dist/, publication npm, CI, E2E versionné OpenCode
