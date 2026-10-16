# CHANGELOG

## 2026-10-16 (Itération design) — APPROVED ChatGPT tour 2
- Cowork skill `ai-cowork` : boucle ChatGPT (browser-debug) 2 tours —
  ITERATE (9 points) puis **APPROVED** ; veto [P0-3] (masquage JSON partiel)
  accepté par le reviewer externe.
- `theme.ts` : paletteFor — bordures neutres (token border), tone sur le
  titre uniquement ; test border-token ajouté.
- `chrome.ts` : support bold (createTextAttributes, API publique 0.6.6
  confirmée par review).
- `metric.ts` : same-line « value … ▲ delta » right-aligned (2 lignes en
  narrow), value bold, trimEnd défensif ; +2 tests frame peinte (same-line,
  borne exactly-fits/inner−1).
- `table.ts` : règle interne muted, cellules purement numériques
  right-aligned (mono-ligne, headers exclus) ; assertion alignement mise à
  jour.
- Tests : 108 → **111 verts** ; review Reviewer mergeable (R1/R3 corrigés,
  R2 → W-05, R4 → docs/ai).
- Harnais : `render_png.py` (pyte→PIL, offsets auto-détectés) → sheets PNG
  design-sheet{-v2}.png pour le reviewer externe.

## 2026-10-16 (Lot 1) — Metric + Table, gate ratifié
- `metric.ts` : label/value/delta, value en accent, flèches ▲/▼ dérivées du
  signe (les deux modes), label muted en compact.
- `table.ts` : colonnes au contenu (visualLength), clamp canevas, wrap par
  cellule, header accent + règle, cap MAX_WRAPPED_LINES post-wrap, notices
  clampées, colonnes de droite masquées en narrow + notice.
- `chrome.ts` : chrome bordered/compact partagé (extraction panel, move pur).
- Parser : coercition number/boolean, caps metric/table, CR→LF dans sanitize,
  fails précis (row length, types de cellules).
- Review adversariale : 2 HIGH corrigés + verrouillés par 8 tests narrow
  (frames peintes) ; 2 asserts tests assouplies en cohérence avec le clamp.
- Tests : 108/108 (1871 assertions) ; tsc 0 erreur. Test perf : plafond 8 s
  (garde anti-complexité, bruit 0,18-3,5 s mesuré).
- E2E (E9) : 4 blocs richui inline (110/60 col), zéro repli final.
- Docs : REPORT §2/§4/§6/§7, README formats, docs/ai.

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
