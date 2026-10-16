# STATUS

## En cours
- Commit initial + push GitHub (tout est vérifié et prêt).

## Terminé (2026-10-16)
- POC inline VALIDÉ : plugin TUI `opencode-rich-ui` chargé par opencode 2.0.30,
  renderer `richui` enregistré, Panel rendu inline pendant/après streaming.
- Boucle de correction post-review (reviewer adversarial, 12 findings) :
  corrections appliquées (largeur en cellules CJK/emoji, hardWrap O(n) + cap
  500 post-wrap, double catch never-throw, isColorValue structurel,
  sanitisation ANSI/C0 + tabs→2 espaces, chrome unique, teardown hôte prouvé).
- `bun run typecheck` 0 erreur + **60/60 tests verts** (176 assertions,
  5 fichiers).
- E2E re-validés post-refactor : transition dynamique fallback (@21499 B,
  JSON partiel + `esc interrupt`) → Panel `Build` inline (@51060 B) PROUVÉE ;
  frame finale : 2 Panels inline, zéro fallback, à 110 **et** 60 col.
  Bug du mock corrigé au passage (JSON du bloc `Build` jamais fermé — le
  comportement du renderer était correct).
- Docs à jour : REPORT.md (§2 60 tests, E8, §4 limitations), ADR-001 (D5
  cellules, D6 teardown `clearBlockStates`), README (sanitisation body,
  layout cellules, 60 tests), docs/ai/.

## Bloqué
- (rien)

## Prochaine action
- Commit + push, puis ratification utilisateur du gate → Lot 1 (Metric + Table).
