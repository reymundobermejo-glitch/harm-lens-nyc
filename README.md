# Harm Lens — Phase 3 decision surface

This is the local, pre-launch Phase 3.4 interface for **Overview → Explore → Inspect → Compare → Packet**. It reads the frozen `HL-PHASE2-OBJECTS-v1` analytical objects and frozen `HL-VZDOT-MATCH-v1` history crosswalk through verified browser projections; it does not recreate counts, ranks, lens states, matches, peers, fragility results, checklists, or LEP packets.

Phase 3.2 adds the NYC-wide camera, bounded borough frames, lens reversal cue, hover/selection inspection, five-tab evidence dock, two-place method-locked compare, uncertainty opt-in, and a non-priority review tray. See `../PHASE_3_2_RESULT.md`.

Phase 3.3 separates the real screens, makes Explore map-first, teaches place/tool meaning, uses plain place names with LION provenance, collapses secondary chrome, and adds free muted context beneath the OTI orthophoto. See `../PHASE_3_3_RESULT.md`.

Phase 3.4 makes citywide ranked activity visible, keeps a single selection on Explore, adds a high-contrast selected pin and map callout, guides A/B selection, gates Packet to the four frozen DRAFT samples, and restores small-screen workflow navigation. It also fixes the local MapLibre worker path that previously left the GeoJSON layer empty. See `../PHASE_3_4_RESULT.md`.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by the development server. For a production-build check:

```bash
npm test
npm run lint
```

## Data binding

- Frozen source objects: `../../phase-2/`
- Browser projection: `public/data/*.json.gz`
- Full 1F Situate projection: `public/data/situate-1f-index.json.gz`
- Read-only LION 26B place labels: `public/data/place-labels.json.gz`
- Label builder: `../build_place_labels.py` (run from the project root with `python3 phase-3/build_place_labels.py`)
- Projection builder and Phase 2/1F before-and-after hash checks: `../build_ui_data.py`
- Binding record: `../PHASE_3_DATA_BINDING.json`
- Phase 3.1 verification: `../PHASE_3_1_VERIFICATION.json`
- Phase 3.2 verification: `../PHASE_3_2_VERIFICATION.json`
- Browser acceptance: `../PHASE_3_2_BROWSER_ACCEPTANCE.json`
- Phase 3.3 verification: `../PHASE_3_3_VERIFICATION.json`
- Phase 3.3 browser acceptance: `../PHASE_3_3_BROWSER_ACCEPTANCE.json`
- Phase 3.4 label projection record: `../PHASE_3_4_LABEL_PROJECTION.json`
- Phase 3.4 verification: `../PHASE_3_4_VERIFICATION.json`
- Phase 3.4 browser acceptance: `../PHASE_3_4_BROWSER_ACCEPTANCE.json`

The map displays free NYC OTI/DoITT 2018 orthophoto tiles under CC BY 4.0, with an explicit year badge. Imagery is current-context reference only—not crash-date reconstruction. The application is not deployed by this phase.

## Locked product boundaries

- Intersection analytical ranks use `intersection_confident` only.
- Midblock segments are a separate peer grain.
- Possible/exception and unresolved events remain visible and non-ranked.
- The default analysis window ends June 11, 2026; source status is maintenance.
- Fatal threshold `1` is disclosed as a sparse analytical rule, not risk or priority.
- Fragility is incomplete/deferred and never labeled stable.
- LEPs remain DRAFT. Treatment, cause, effectiveness, official priority, and no-match-as-untreated claims are unsupported.
- Situate uses all screened place keys from the frozen 1F crosswalk. Established rows are documented history; ambiguous candidate relationships and no-match remain unknown.
