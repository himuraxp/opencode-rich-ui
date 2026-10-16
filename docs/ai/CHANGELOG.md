# CHANGELOG

## 2026-10-16 (Phase graphique) — Étape 3 + VERDICT FINAL : APPROVED
- Stress batch : mock étendu (13 blocs : 3 initiaux + 10 metrics tones/deltas
  variés). n=25 rendus graphiques réels mesurés : SVG p50 0,1/p95 0,1 ms ;
  raster p50 4,9/p95 11,3/p99 25,3 ms ; TOTAL p50 4,9/p95 11,4/p99 25,6 ms —
  **seuils ChatGPT PASS** (raster p95 ≤ 20, total p95 ≤ 30 ; p99 documenté).
- Resize : 60 col OK + **resize à chaud** (SIGWINCH via PTY slave, RESIZE_SENT,
  rendus post-resize, exit 0).
- Mémoire : boot 274 Mo → plateau 457-467 Mo STABLE (±1 Mo / 8 s) — préliminaire.
- Scroll : 13 blocs inline sur 40 lignes, défilement naturel, 0 crash, 0
  fallback JSON.
- Anomalie boot ROOT-CAUSED : écosystème user (15 plugins + MCPs) dans le
  harnais ; durci définitif (boucle soumission 3 essais + vérif réception mock,
  XDG_DATA_HOME isolé) — 3/3 runs verts ensuite.
- **VERDICT ChatGPT : APPROVED (POC clos)** — activation par défaut PENDING
  (test Orca utilisateur). P1 : cycles mémoire, test Orca (protocole résolu,
  netteté, resize) ; P2 : copie.

## 2026-10-16 (Phase graphique) — Test Orca réel : kitty CONFIRMÉ
- Probe dans la session réelle de l'utilisateur : forcing opt-in TEST-ONLY
  (temporaire, retiré après mesure) + reload à chaud du plugin (déclenché
  par le render, ~20 s) → journal `orca-probe.log`.
- **Protocole résolu d'Orca = kitty** (`graphic-renderable protocol=kitty`)
  — 2 rendus graphiques réels transmis dans le terminal (thème réel
  #56b6c2, raster 5,2-18,4 ms, total ≤ 18,8 ms, zéro fallback).
- La PENDING "affichage réel Orca" de ChatGPT est levée sur la donnée
  technique ; la netteté visuelle reste confirmable par l'utilisateur.
- Retour à l'opt-in strict (forcing retiré, 145 verts). Le log du protocole
  résolu est conservé dans buildGraphicRenderable (opt-in only).

## 2026-10-16 (Phase graphique) — VERDICT FINAL : APPROVED + KEEP-OPT-IN
- ChatGPT clôture le POC (tous PASS, y compris détection Orca kitty, émission
  2 rendus, thème réel #56b6c2, raster 5,2-18,4 ms).
- Recommandation : **garder l'opt-in** (RICHUI_GRAPHICS=1) pendant la
  qualification produit. Avant DEFAULT-ON : (1) validation visuelle Orca par
  l'utilisateur, (2) cycles mémoire prolongés, (3) ergonomie copie.
- Politique cible : après qualification positive → auto kitty/sixel avec
  opt-out explicite (0 modification JSON/architecture).
- PANEL/TABLE : hors périmètre tant que le bénéfice n'est pas démontré.
- États formalisés : POC METRIC graphique = DONE ; Qualification produit /
  DEFAULT-ON = PENDING.

## 2026-10-16 (Phase graphique) — Étape 2 : METRIC graphique implémenté
- Backend opt-in (`graphics.ts`) : preload lazy resvg au setup (jamais dans
  le chemin normal), filtre protocole RATIFIÉ (kitty|sixel uniquement,
  effectiveProtocol résolu — jamais forcé en prod), double fallback.
- `metric-graphic.ts` : SVG (label uppercase muted, value bold accent,
  delta ▲/▼ associé, fond transparent, tokens thème only) → resvg → PNG.
- Branchement metric dans opentui.ts (échec graphique → natif, jamais de
  bloc perdu) + preload dans plugin.ts. @resvg/resvg-js 2.6.2 (lazy).
- Tests 111 → 141 (Tester : 30 tests — politique, opt-in, error paths,
  escaping/arrows, double fallback via seam injection, scrub env plugin).
- E2E : blocks → natif (filtre ×3, 2/2 runs fiables) ; kitty forcé → 3
  émissions a=t, PNG 784×59 RGBA extrait du flux (preuve authentique).
- Timings : resvg cold 375 ms / hot 8-14 ms ; svg ≤3,2 ms ; raster
  12,9-24 ms ; total 13-24,6 ms (seuils p95 ≤ 20/30 ms respectés).
- Tests 111 → **145** (Tester : 30 tests +4 cssColor ; scrub env plugin).
- **Contraste corrigé (P0)** : RGBA host = getters floats normalisés (127 →
  0.498) → rgb(0,1,1) noir. Fix `cssColor()` (theme.ts) : toInts() 0-255 +
  détection normalisation. Preuve E2E : PNG extrait du flux kitty =
  #7fd88f/#808080 (méthode : décodage base64 des chunks du flux réel).
- Harnais durci v2 : boucle de soumission (3 essais, vérification réception
  mock, exit 4 sinon) + XDG_DATA_HOME isolé (state frais). Cause racine du
  boot variable : 15 plugins user + MCPs (reconciliation de durée variable).
- Captures : metric-comparison.png (A natif / B graphique flux kitty).

## 2026-10-16 (Phase graphique) — Étape 1 : spike chaîne hôte RÉUSSI
- `graphics-spike.ts` : ImageRenderable PNG statique derrière env var
  RICHUI_SPIKE_IMAGE (jamais en prod), journal du protocole effectif
  (RICHUI_SPIKE_DEBUG). Aucune dépendance.
- Dispatch hôte VERIFIÉ : ImageRenderable accepté par le callback
  registerCodeBlockRenderer, peint en half-blocks (protocole auto→blocks en
  PTY), zéro fallback JSON, zéro crash (exit 0), re-render par delta confirmé
  (16 constructions/4 blocs, D6), construct→onLoad < 3 ms.
- Preuves : spike-run.log, spike-debug.log, spike-comparison.png (source vs
  blocks). 111/111 tests verts.
- Reste étape 1 : protocole réel d'Orca (main utilisateur) → validation
  ChatGPT → étape 2 (METRIC graphique, resvg).

## 2026-10-16 (Phase graphique) — audit faisabilité + verdict ChatGPT
- Audit POC graphics (zéro implémentation) : opencode v2.0.30 bundle
  ImageRenderable + resolveImageRenderProtocol + sixel + kitty_graphics
  (grep binaire) ; @opentui/core 0.6.6 : ImageRenderable (png/jpeg/webp/gif/
  raw-rgba, source bytes/URL), NativeImage (decode/fromRgba/pool),
  ImageRenderProtocol = auto|kitty|sixel|**blocks** (dégradation Unicode
  half-blocks intégrée au runtime).
- Terminal utilisateur = Orca : capacités kitty/sixel INCONNUES (à mesurer
  au POC — jamais déduites du nom, IMPROVEMENT P0 ChatGPT).
- Soumission à ChatGPT (thread cowork) → **VERDICT: APPROVED — POC sous
  conditions** : Q1 resvg-js natif (chargement lazy, jamais dans le chemin
  de chargement normal) ; Q2 opt-in explicite POC (native par défaut,
  blocks-only ≠ déclencheur graphique) ; Q3 backend alternatif sur le même
  JSON ; Q4 seuils p95 ≤ 20 ms raster / ≤ 30 ms total par reconstruction,
  mémoire stable après 10 blocs, p99 documenté.
- Plan 3 étapes validé avec décision à chaque passage : (1) spike dispatch
  hôte PNG statique + protocole Orca + lifecycle, (2) METRIC graphique
  derrière opt-in, (3) perf/résilience + captures comparatives.
- En attente : validation utilisateur → étape 1.

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
