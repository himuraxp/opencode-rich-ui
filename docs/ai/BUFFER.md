# BUFFER

## Snapshot de reprise (2026-10-16, fin Phase 0)
État : POC inline validé et documenté. Aucune tâche en vol.

### Dernières preuves obtenues
- Chargement : debug log `module-import → setup-called version=2.0.30 → register-ok lang=richui`
- Streaming : fallback dynamique @21499 B (JSON partiel, `esc interrupt`)
  puis Panel `Build` inline @51060 B — transition PROUVÉE
- Final : 2 Panels inline (110 et 60 col), zéro fallback, « All done. »
- Hot reload : modif contenu `tui.ts` → `module-import → unregister-ok → setup-called → register-ok`
- Terminal 60 col : panel borné, wrappé, lisible

### Fichiers impactés (tous nouveaux)
`tui.ts`, `src/**` (10 fichiers), `test/**` (5), `docs/**`, `examples/`,
`README.md`, `AGENTS.md`, `package.json`, `tsconfig.json`.

### Si reprise
1. `bun run check` doit rester vert (60 tests + tsc strict).
2. Config active : `~/.config/opencode/cli.json` pointe vers
   `file:///Users/yohannlarbi/dev/opencode-rich-ui` (répertoire).
3. Harnais E2E reproductible : voir docs/ai/INDEX.md section hors repo.
