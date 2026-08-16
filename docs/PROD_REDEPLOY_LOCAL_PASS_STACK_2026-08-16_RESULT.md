# Production Redeploy — Local PASS Stack (2026-08-16)

**Decision:** **PASS**

**Checked:** 2026-08-16T23:05:00Z (approx.)

**Production:** https://harm-lens-nyc.vercel.app

**Deployment:** `dpl_CnEqp6hCPSvqobrBJdJnvni6HZmr`

**Deployment URL:** https://harm-lens-6mngfzefc-reymundobermejo-5871s-projects.vercel.app

**GitHub:** https://github.com/reymundobermejo-glitch/harm-lens-nyc (existing repo only; no new repo)

**Source commit:** `da8c004` — *Ship local PASS stack to production history.*

Authorization used (verbatim intent): strong-only production redeploy of the current `phase-3/app` local PASS stack (shell + client + byte-identical `public/data/*.gz` including additive crash-when / crash-row-who / Eastern Parkway corridor overlay + `vercel.json` gzip identity headers) onto `https://harm-lens-nyc.vercel.app`. Include Track I local surface, P1.1 Meeting Carry, I2.2, Legend v1.2, I0 remainder, P4 UI, P3.1 UI, and P5 share. Do **not** ship the 3012 wrapper. Do **not** ship G2/LLM. Do **not** freeze P6 FOIL sources. Do **not** cut over a newer crash feed (product freeze stays **2026-06-11 / maintenance**). Do **not** mutate the nine original frozen gz bytes or invent Yes/No/Plan.

## What shipped

Static payload assembled by `phase-3/scripts/assemble_vercel_static.mjs` from `phase-3/app`:

- Phase 3 vinext client shell (`index.html` captured from live `http://127.0.0.1:3012/` of this build + `dist/client/_next/**`)
- Eleven `public/data/*.gz` files, hash-verified at assemble against dist
- `vercel.json` gzip **identity** headers (`Content-Type: application/gzip`, `Content-Encoding: identity`)
- `vercel-out-manifest.json`: **`wrapper_shipped: false`**

Deploy path: **app-root** static deploy to existing project `harm-lens-nyc` / scope `reymundobermejo-5871s-projects` (Framework **Other**). Nested `--cwd vercel-out` alone was not used for promotion. Preview deployment reached READY; production alias was set only after authenticated pre-alias W11 **11/11**.

## W11 proofs — 11/11

### Pre-alias (authenticated `vercel curl` on READY deployment)

Every response: HTTP 200, SHA=dist, magic `1f 8b`, `Content-Type: application/gzip`, `Content-Encoding: identity`.

Evidence: `phase-3/PROD_REDEPLOY_LOCAL_PASS_STACK_2026-08-16_PREALIAS_W11.json`

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

Public proof also written to `phase-3/STEP_E_PREFLIGHT_W11_HOST_PROOF.json` / `phase-3/PROD_REDEPLOY_LOCAL_PASS_STACK_2026-08-16_PUBLIC_W11.json`.

Brief edge note: immediately after alias, two additive paths briefly returned 404 once (CDN warm); re-proof was **11/11 PASS** before acceptance walk.

## Production browser walk

Host: `https://harm-lens-nyc.vercel.app` (not localhost). Shell chunk: `page-06Vsw5o8.js`.

| Check | Result | Evidence |
|---|---|---|
| Cold load Explore — Buffalo Everyone / 36m Hurt **#1 · 66** | **PASS** | Order 1 Buffalo Ave & Eastern Pkwy · 66 records |
| Compare Utica **43** → Packet subject Buffalo `26912` (P1.1) | **PASS** | Compare A Buffalo 66 / B Utica 43 · Lock PASS; Packet DRAFT subject Buffalo · LION node 26912 |
| Walking chip — Buffalo **8** vs Utica **21** (I2.2) | **PASS** | Under C001 Walking: Utica 21 · Buffalo 8 |
| `eastern pkwy` — Eastern only; lock **C001**; search-only `27195` out; two Eastern components (I0 / P3.1) | **PASS** | Corridor value `HL-CORRIDOR-L26B-v0-B3-SC338430-LGC01-C001`; picker shows Eastern Parkway Brooklyn component 1 and 2; Buffalo in; `27195` absent |
| Crash log WHO + hour/DOW; no rush-hour danger (P4) | **PASS** | 2026 log: Driving / Walking (`4894051`) / Biking; published times; copy denies danger/hotspot |
| “Why is this showing up?” uses selected place; install refuses (Legend v1.2) | **PASS** | Inspect Why bound to Buffalo 66; toolkit refuse: “Refuse treatment. Harm Lens does not say what to install.” |
| Save Buffalo + Utica → `#hlshare=` restore lock + Packet subject (P5) | **PASS** | Copy link set hash; remount `?p5=1#hlshare=…` → Saved for review **2**, C001, Buffalo + Utica, subject `26912` |
| Freshness maintenance · through **June 11, 2026** (P7) | **PASS** | Banner: SOURCE STATUS MAINTENANCE · COLLISION RECORDS THROUGH JUNE 11, 2026 · not current-as-of-today |
| `129st 101 ave in queens` → `34754` | **PASS** | Match 1 `101 Ave & 129 St` · `intersection_node:34754` |
| `NYC_BOUNDS` unchanged | **PASS** | Still `[[-74.26, 40.49], [-73.70, 40.92]]` in `app/page.tsx` |

Map note: a sticky “governed map layers could not be loaded” banner appeared in the automation session after a transient basemap error, but ranked source features loaded (`data-ranked-source-features=26441`) and list/inspect/compare remained valid. Not treated as a W11 or stack FAIL.

## Integrity and scope

- `wrapper_shipped: false` — 3012 wrapper / `start_local_preview.mjs` not in the static payload.
- Framework remains Vercel **Other** with static `vercel-out` via app-root `outputDirectory`.
- Nine original frozen gz hashes unchanged; three additive gz shipped byte-identical.
- **G2/LLM still blocked.**
- **P6 FOIL freeze still blocked.**
- Product crash freeze remains **2026-06-11 / maintenance** (no newer feed cutover).
- `harm-lens-phase3-w11` was not treated as the product SPA.

## Final state

Production now carries the local PASS stack (Track I surface + P1.1 + I2.2 + Legend v1.2 + I0 remainder + P4 + P3.1 + P5) on eleven W11-proven gz files. Still **not** day-to-day MVP (maintenance feed, DRAFT briefs, no FOIL street inventory). Next remains **P6 freeze** after partner/FOIL, or a crash-feed cutover if live advances under separate auth.
