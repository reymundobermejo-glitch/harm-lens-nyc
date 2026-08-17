# Production Redeploy — P6.1 + H4 + Ask Legend job coach (2026-08-17)

**Decision:** **PASS**

**Checked:** 2026-08-17T20:00:14Z

**Production:** https://harm-lens-nyc.vercel.app

**Deployment:** `dpl_AEmkJfnaiSaqXXcNoNDP97TqY1Ky`

**Deployment URL:** https://harm-lens-4vxgf2ipp-reymundobermejo-5871s-projects.vercel.app

**GitHub:** https://github.com/reymundobermejo-glitch/harm-lens-nyc (existing repo only; no new repo)

**Source commit:** recorded after GitHub sync on `main`.

Authorization used (verbatim intent): strong-only production redeploy of the current `phase-3/app` local PASS stack onto `https://harm-lens-nyc.vercel.app`. Include P6.1 street-record display (not Yes/No/Plan), P6.H4 citywide coverage footnotes (DOT 13,543 / `qt6m-xctn` magnitude / `fb86-vt7u` FMS phases — never a place flag or G1b chip), and Ask Legend job coach v1 (PASS local; no LLM; #1 is list order). Established assemble path (`phase-3/scripts/assemble_vercel_static.mjs`), existing GitHub `reymundobermejo-glitch/harm-lens-nyc`, app-root static deploy, Framework Other. Same eleven product gz, byte-identical, `vercel.json` gzip identity headers. W11 11/11 on the READY deployment before alias. `wrapper_shipped: false`. Product freeze stays **2026-06-11 / maintenance**. Gold bind: Buffalo `intersection_node:26912` Everyone/36m Hurt **#1 · 66**, Utica `26863` **43**. Do not mutate product gz, recrop `NYC_BOUNDS`, send FOIL, HOLD unfreeze Exclusive Ped / Slow Zones / Turn Calming, cut over a newer crash feed, ship the 3012 wrapper, or implement G2.

## What shipped

Static payload assembled by `phase-3/scripts/assemble_vercel_static.mjs` from `phase-3/app`:

- Phase 3 vinext client shell (`index.html` captured from live `http://127.0.0.1:3012/` of this build + `dist/client/_next/**`)
- Eleven `public/data/*.gz` files, hash-verified at assemble against dist
- `vercel.json` gzip **identity** headers (`Content-Type: application/gzip`, `Content-Encoding: identity`)
- `vercel-out-manifest.json`: **`wrapper_shipped: false`**
- Shell chunk: `page-COK8PGCv.js`

Deploy path: **app-root** static deploy to existing project `harm-lens-nyc` / scope `reymundobermejo-5871s-projects` (Framework **Other**). Nested `--cwd vercel-out` was not used. Preview deployment reached READY; production alias was set only after authenticated pre-alias W11 **11/11**.

## W11 proofs — 11/11

### Pre-alias (authenticated `vercel curl` on READY deployment)

Every response: HTTP 200, SHA=dist, magic `1f 8b`, `Content-Type: application/gzip`, `Content-Encoding: identity`.

Evidence: `phase-3/PROD_REDEPLOY_P6_1_H4_JOB_COACH_PREALIAS_W11.json`

### Public alias

```bash
W11_SKIP_LOCAL=1 W11_PRODUCTION_REDEPLOY_AUTHORIZED=1 W11_HOST_URL=https://harm-lens-nyc.vercel.app node phase-3/scripts/prove_w11_data_gz_serving.mjs
```

| File | SHA-256 | Result |
|---|---|---|
| `app-data.json.gz` | `7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614` | PASS |
| `place-labels.json.gz` | `21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9` | PASS |
| `ranked-places.geojson.gz` | `56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972` | PASS |
| `situate-1f-index.json.gz` | `4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f` | PASS |
| `situate-approach-context-v1.json.gz` | `b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9` | PASS |
| `situate-approach-context-wave2-v1.json.gz` | `5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf` | PASS |
| `uncertainty.geojson.gz` | `a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137` | PASS |
| `p2-5-ui-objects-v1.json.gz` | `b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454` | PASS |
| `crash-when-v1.json.gz` | `fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352` | PASS |
| `crash-row-who-v1.json.gz` | `2dcfe92d713a6ee1f5921d9476d7ec7c5fd2b47456f962e7246c828d0c52e870` | PASS |
| `corridor-lion26b-v0-eastern-pkwy.json.gz` | `3ac2d489e79b6cc43cd6c8bfe04f07b73e055c93f012be5e1ce1a01874b3ae61` | PASS |

Public proof also written to `phase-3/STEP_E_PREFLIGHT_W11_HOST_PROOF.json` / `phase-3/PROD_REDEPLOY_P6_1_H4_JOB_COACH_PUBLIC_W11.json`. First public proof was **11/11** (no CDN 404 retry required).

## Production browser walk

Host: `https://harm-lens-nyc.vercel.app` (not localhost). Shell chunk: `page-COK8PGCv.js`. Ranked source features: **26441**.

| Check | Result | Evidence |
|---|---|---|
| Cold Explore — Buffalo Everyone / 36m Hurt **#1 · 66** | **PASS** | `intersection_node:26912` Order 1 Buffalo Ave & Eastern Pkwy · 66 records |
| Utica **43** | **PASS** | `intersection_node:26863` Order 3 Eastern Pkwy & Utica Ave · 43 records |
| P6.1 street-record display (not Yes/No/Plan) | **PASS** | Packet `packet-situate`: “Street records at this place · not Yes / No / Plan”; APS / LION / published speed / parking-sign rows; no Yes/No/Plan invention |
| P6.H4 citywide coverage footnotes | **PASS** | Packet Limitations `packet-coverage-footnotes`: DOT **13,543** March 2022 citywide; `qt6m-xctn` Current **1,281,256** / Historical **13,929,146** magnitude; `fb86-vt7u` **60** `current_phase` labels on **56,525** FMS rows. Copy: “Citywide coverage — not at this place”; “Does not say this intersection is signalized”; no G1b chip |
| Job coach start — “I don’t know where to start” | **PASS** | Lock Everyone / 36m / Hurt / intersections; `selectPlace` Buffalo; Inspect Why **66**; copy: list order, not most-dangerous; next screen Inspect Why. Tools: `startCoachJob,selectPlace,openInspect,composeWhyPlace`. No LLM |
| Job coach Queens vs Brooklyn | **PASS** | Queens list #1 Jackson **36** / Brooklyn list #1 Buffalo **66**; Compare “A has 36 and B has 66”; copy: list order, not most-dangerous. Tools: `startCoachJob,selectTopInBorough,selectTopInBorough,selectPlace,openCompare` |
| Freshness maintenance · through **June 11, 2026** | **PASS** | Banner: SOURCE STATUS MAINTENANCE · COLLISION RECORDS THROUGH JUNE 11, 2026 · not current-as-of-today |
| `NYC_BOUNDS` unchanged | **PASS** | Still `[[-74.26, 40.49], [-73.70, 40.92]]` in `app/page.tsx`; minified chunk `Sr=[[-74.26,40.49],[-73.7,40.92]]` |
| `wrapper_shipped: false` | **PASS** | Assemble manifest; `start_local_preview` absent from production HTML |

Walk note: the automation browser still had a leftover Saved-for-review tray (Buffalo + Utica) from an earlier session’s `localStorage`. Explore gold bind and Packet subject were read from the live ranked list, not from that tray.

## Integrity and scope

- `wrapper_shipped: false` — 3012 wrapper / `start_local_preview.mjs` not in the static payload.
- Framework remains Vercel **Other** with static `vercel-out` via app-root `outputDirectory`.
- Eleven frozen gz hashes unchanged (byte-identical).
- **G2/LLM PARKED.** No model, no G2 chip, no gold-set eval.
- FOIL send **PARKED**. HOLD Exclusive Ped / Slow Zones / Turn Calming unchanged.
- Product crash freeze remains **2026-06-11 / maintenance** (no newer feed cutover).
- `harm-lens-phase3-w11` was not treated as the product SPA.
- Coverage footnotes are citywide `source_fact` copy, not a place flag and not a G1b chip.

## What this does not authorize

- Product gz mutation, `NYC_BOUNDS` recrop, 3012 wrapper ship
- FOIL send; HOLD unfreeze Exclusive Ped / Slow Zones / Turn Calming
- Newer crash-feed cutover / P7 product unfreeze
- G2 LLM
- Treatments, risk, cause, KSI, 5-year windows, Yes/No/Plan invention

## Living next

**Named remaining work: none.**

KEEP reminders only:

- DOT plant export → new H0–H3 if files arrive
- P7 cutover if live `h9gi-nx95` advances past **2026-06-11**
- HOLD Exclusive Ped / Slow Zones / Turn Calming

PARKED unchanged: FOIL send, G2 LLM, W40, Data Tests as to-dos, non-draft Packet.

## Stop

Production now carries P6.1 street records, H4 citywide coverage footnotes, and Ask Legend job coach v1 on eleven W11-proven gz files. Still **not** day-to-day MVP (maintenance feed, DRAFT briefs, plant Unknown). **Do not mark G2 PASS.**
