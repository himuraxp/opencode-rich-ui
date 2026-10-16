# CHANGELOG

## 2026-10-16 (suite) — Boucle de correction post-review + re-validation E2E
- Corrections reviewer adversarial appliquées : largeur en **cellules
  terminales** (CJK/emoji, plages Unicode large), hardWrap O(n) + cap
  `MAX_WRAPPED_LINES=500` appliqué post-wrap, catch double never-throw,
  `isColorValue` structurel (r/g/b), sanitisation parse (strip ANSI/C0,
  tabs→2 espaces, cap octets via TextEncoder), chrome unique via
  `LayoutProfile.innerWidth`, destroy-on-failure, `debug.ts` module séparé.
- Tests : **60 verts / 0 fail** (176 assertions, 5 fichiers — ajout
  `theme.test.ts` ; test perf avec viewport dédié haut pour prouver la
  notice de troncature peinte ; budget 250 ms → garde anti-complexité 1,5 s
  après constat de flakiness machine 180-640 ms).
- E2E re-validés post-refactor : fallback dynamique (@21499 B) → Panel
  inline (@51060 B) prouvé ; final 2 Panels à 110 et 60 col, zéro fallback.
  Mock corrigé : le JSON du bloc `Build` n'était jamais fermé (fallback
  permanent — comportement renderer correct).
- Docs : REPORT (60 tests, preuve E8, limitations §2/§4), ADR-001 (D5
  cellules, D6 teardown `clearBlockStates`→`destroyRecursively`), README.

## 2026-10-16 — Phase 0 : POC inline validé
- Plugin TUI `richui` (4 couches : core/components/layout/adapter) — chargé par
  opencode 2.0.30 via cli.json (répertoire + tui.ts).
- `api.markdown.registerCodeBlockRenderer` câblé ; fallback never-throw vers
  `ctx.defaultRender()`.
- Composant Panel (bordered/compact selon 40 col), thème défensif.
- Tests : 39 verts (`bun test`), dont rendu headless officiel OpenTUI.
- E2E : mock LLM SSE + PTY (expect + pyte) — rendu inline pendant/après
  streaming, fallback, hot reload (unregister→re-setup), terminal 60 col.
- Docs : REPORT.md, ADR-001, README, examples/richui-examples.md, docs/ai/.
