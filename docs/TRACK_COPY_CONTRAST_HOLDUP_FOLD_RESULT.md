# Track copy + contrast + Hold up fold result

**Version:** `HL-COPY-CONTRAST-HOLDUP-FOLD-v1`  
**Decision:** **PASS production** — **G2 is not PASS.**  
**Date:** 2026-08-17 (local) · production cutover 2026-08-17/18  
**Tests:** `phase-3/app` `npm test` — **72/72 PASS**  
**Production / commit status:** `phase-3/PROD_REDEPLOY_COPY_CONTRAST_HOLDUP_FOLD_RESULT.md` · `dpl_B6oEtw54kvqit5Fd2rbCTJ9FYR4u` · W11 **11/11**  
**LLM / G2:** not authorized; not performed  
**Does not:** mutate product gz, recrop `NYC_BOUNDS`, FOIL, HOLD unfreeze, deploy, heatmap, size-by-count, 3D, or implement G2

## Answer first

Inspect no longer has a **Hold up?** tab. Window and omit-year checks live on **Counts** under **Does this still show if we change the window?** The frozen fragility rows are unchanged. Incomplete checks are still never called stable. The word **robustness** is not printed in the UI (Compare row, walk captions, Overview).

Night surfaces no longer keep cream leftovers on `.robustness-read` / window-check read, Situate totals, or map banners. Body copy uses `--ink` at ≥13px; `--muted` is for captions. Hurt / Died keep their color channels.

Overview, Explore, Inspect, and Compare no longer parrot the same three sentences. Hover lamp and 11–12 px hit slop stay paint-only. Selecting a place fires one MapLibre `feature-state` pulse; `prefers-reduced-motion` snaps the pulse off.

Gold bind holds: Buffalo `intersection_node:26912` Everyone/36m Hurt **#1 · 66**.

## Acceptance table

| Check | Result | Evidence |
|---|---|---|
| Hold up? removed from tablist | **PASS** | Inspect tabs: Counts / Crashes / On the street / Note. No `Hold up?` in `page.tsx`. |
| Window checks folded into Counts | **PASS** | `data-testid="window-checks"` on Counts. Heading: “Does this still show if we change the window?” Rows: 24m / 36m / 48m / Without 2024 / Without 2025 / Street-distance not run. Copy still refuses “stable.” |
| Never print robustness | **PASS** | Compare row label is **Window checks**. Walk captions are Counts → Crashes → On the street; no Hold up / robustness. Overview does not say robustness. |
| Contrast — no cream leftovers | **PASS** | `.window-checks-read` / `.robustness-read` `rgba(112,184,173,.12)`; Situate totals use `--line` / night fill, not `#d8d0c1`; map framing / honesty / filter banners use `rgba(7,18,25,.72)`, not cream paper. |
| Body `--ink` ≥13px; muted captions | **PASS** | Overview body 16px `--ink`; window-check read / method copy / why-lead 13px `--ink`. Eyebrows, list labels, Overview limit stay `--muted`. Hurt `#d98b28` / Died `#c94a37` on active giants. |
| Distinct screen copy | **PASS** | Overview h1: where reports pile up. Explore: look-order under the lock. Inspect: one place, Hurt/Died/dates/window. Compare: two places, same Who / How long / grain. |
| Hover lamp + hit slop | **PASS** | Existing paint-only `["feature-state", "hover"]`; `places-hit` 11 px; `focus-hit` 12 px. Visible radius still `NEIGHBORHOOD_POINT_RADIUS`, not count. |
| One select pulse | **PASS** | `selected-place` `promoteId: "id"`; halo/ring radius via `["feature-state", "pulse"]`; one shot per id; `prefers-reduced-motion` duration 0 and no pulse. |
| Gold bind | **PASS** | Buffalo **#1 · 66**. Frozen gz hashes unchanged. |
| `NYC_BOUNDS` | **PASS** | Still `[[-74.26, 40.49], [-73.70, 40.92]]`. |
| Scope stop | **PASS** | No heatmap, size-by-count, 3D, gz write, recrop, FOIL, HOLD unfreeze, deploy, G2. |

## What folded

The completed trailing-window and omit-year states were already on the Hold up? tab. They now sit on Counts. Street-distance remains **Not run yet**. `fragilityRead` still reports change vs no-change in completed tests and names the deferred spatial check. No “stable” invention.

Ask Legend walk (`toolkit-v11`) is three frames: Counts (including the window question) → Crashes → On the street.

## Frozen-artifact integrity

Eleven gzip files only. No new product gz.

| Artifact | SHA-256 | Result |
|---|---|---|
| `app-data.json.gz` | `7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614` | unchanged |
| `place-labels.json.gz` | `21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9` | unchanged |
| `ranked-places.geojson.gz` | `56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972` | unchanged |
| `situate-1f-index.json.gz` | `4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f` | unchanged |
| `situate-approach-context-v1.json.gz` | `b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9` | unchanged |
| `situate-approach-context-wave2-v1.json.gz` | `5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf` | unchanged |
| `uncertainty.geojson.gz` | `a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137` | unchanged |
| `p2-5-ui-objects-v1.json.gz` | `b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454` | unchanged |
| `crash-when-v1.json.gz` | `fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352` | unchanged |
| `crash-row-who-v1.json.gz` | `2dcfe92d713a6ee1f5921d9476d7ec7c5fd2b47456f962e7246c828d0c52e870` | unchanged |
| `corridor-lion26b-v0-eastern-pkwy.json.gz` | `3ac2d489e79b6cc43cd6c8bfe04f07b73e055c93f012be5e1ce1a01874b3ae61` | unchanged |

## Files changed

- `phase-3/app/app/page.tsx` (Hold up tab removed; window checks on Counts; Overview / Explore / Inspect / Compare copy; select pulse)
- `phase-3/app/app/globals.css` (night contrast on window-check read, Situate totals, map banners; body ink ≥13px)
- `phase-3/app/lib/ask-legend/toolkit-v11.mjs` (walk is three screens; captions name the window question, not Hold up)
- `phase-3/app/tests/rendered-html.test.mjs`
- `phase-3/app/tests/ask-legend-toolkit-v11.test.mjs`
- `phase-3/TRACK_COPY_CONTRAST_HOLDUP_FOLD_RESULT.md`

No new gzip. Wrapper not shipped.

## What this does not authorize

- G2 LLM, gold-set eval, API keys
- FOIL send, HOLD Exclusive Ped / Slow Zones / Turn Calming unfreeze
- Product gz mutation, `NYC_BOUNDS` recrop (this production cutover is recorded separately)
- Heatmap, size-by-count, 3D pitch
- Treatments, risk, cause, KSI, 5-year windows, Yes/No/Plan, “stable”

## Stop

Copy + contrast + Hold up fold is **PASS production**. Job coach v1.2, P6.1, and H4 remain. **Do not mark G2 PASS.**
