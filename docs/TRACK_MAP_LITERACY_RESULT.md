# Track Map Literacy Result

**Decision: PASS (local only)**  
**Version:** `HL-MAP-FIRST-GLANCE-v1`  
**Acceptance host:** `http://127.0.0.1:3012/`  
**Date:** 2026-08-14

The Explore map now teaches itself at first glance: it names the three marks, uses the active Hurt/Died color on piles and places, keeps the picked pin visually separate, puts the primary navigation and method choices on the map, and provides one Back trail plus Whole city. The list remains a scoreboard. Precise method and evidence language remains available in Inspect and the DRAFT brief.

## Host proof

| Check | Evidence | Result |
|---|---|---|
| Upstream | PID `98697`, IPv4 `*:3011`, production-mode `vinext start` | PASS |
| Acceptance wrapper | PID `59795`, IPv4 `127.0.0.1:3012` | PASS |
| Root | `GET http://127.0.0.1:3012/` → HTTP 200 | PASS |
| P2.5 gzip | `Content-Type: application/gzip`; no `Content-Encoding` | PASS |
| Acceptance URL | Browser walk used `127.0.0.1:3012`, not localhost or IPv6 | PASS |

The 3012 wrapper remains local-only and is not a production artifact.

## Words: before → after

| Before / technical | First-glance UI |
|---|---|
| Ranked intersection mode | Street corners |
| Peer midblock | Middle of the block (not the corner) |
| Cluster explanation | A number is a pile. Click it to look inside, or zoom in. |
| Eligible / method lock | Map and list show the same places |
| Injury-involved / fatal | Hurt / Died |
| 24m / 36m / 48m | Last 2 / 3 / 4 years |
| Analytical LION corridor | This street group (not an official DOT list) |
| Uncertainty layers | Extra faint marks — not on the main list |
| Fit NYC | Whole city |
| Find controls | Search a street / More |
| Inspect this place | Open this place |
| Ranked-list restore | Back / Whole city |

The left panel now leads with “Places with crash reports” and explicitly says higher order means more reports, not more danger or official priority. Its duplicate method controls are collapsed by default.

## Picture contract

| Mark | Shipped behavior | Result |
|---|---|---|
| Pile | Large numbered circle, cream halo, active lens color | PASS |
| One place | Even small dot in active lens color | PASS |
| Picked place | Gold/white selected treatment above other layers | PASS |
| Hurt | Gold piles and dots | PASS |
| Died | Brick piles and dots | PASS |
| Extra marks | Off by default; separate quiet/hollow layer menu | PASS |
| A/B | Existing letter badges retained; no third color scale | PASS |
| Base | OTI 2018 reduced to 0.56 opacity and labeled “Old photo (2018) — not today” | PASS |
| Legend | Three plain swatches: Pile / One place / You picked this | PASS |

Single-place dots remain even-sized. No heatmap, choropleth, count-sized corner, risk glow, or priority pulse was added.

## Navigation trail

| Action | State / camera behavior | Result |
|---|---|---|
| Whole city | Clears search, pile-follow, borough look, and selection; fits NYC | PASS |
| Look at borough | Frames borough and shows `Looking at Brooklyn`; does not filter other boroughs from the list | PASS |
| Click pile | Uses existing C6 group-follow, fits the group, shows `This pile · N places` | PASS |
| Search on map | Uses frozen labels; one eligible hit selects and lands; many remain filtered; zero uses the exact empty state | PASS |
| Hurt/Died, Who, years, corridor | Map and list share one eligible ID set and the map fits active results | PASS |
| Pick row/place | Same selected place, selected pin, compact card, `Open this place` | PASS |
| Back | Pops selected place, then pile, then borough/search state | PASS |

## IPv4 browser walk

| # | Walk item | Evidence | Result |
|---|---|---|---|
| 1 | Cold NYC | Gold numbered piles, coach, three-item legend, and old-photo stamp visible | PASS |
| 2 | Brooklyn | Camera moved; `Looking at Brooklyn` states that the list still covers the active filter | PASS |
| 3 | Numbered pile | Click produced `This pile · 117 places` and a Back action | PASS |
| 4 | Back / Whole city | Pile-follow cleared and NYC frame restored | PASS |
| 5 | `broadway & rector` | One list hit, one map ID, picked-place card, camera landing | PASS |
| 6 | Hurt → Died | Map canvas changed `gold` → `brick`; picked place remained selected | PASS |
| 7 | Who = Walking | Map/list parity showed 9,418 places; first list result Eastern Pkwy & Utica Ave with 21 supporting records | PASS |
| 8 | Pick + open | Row selected the same place; `Open this place` reached the existing honest Why view | PASS |
| 9 | C6 lens-flip keep | `intersection_node:26912` and `intersection_node:21791` remained picked across lens flips | PASS |
| 10 | Runtime | No console errors during the acceptance walk | PASS |

Agreement remains baseline-only, persistence remains Everyone-only, named road-user groups remain overlapping, and off-baseline corridor totals remain governed by the released P2.5 lock.

## Automated verification

| Check | Result |
|---|---|
| G0 + G1 + rendered contract suite | 41/41 PASS |
| `npm test` (build + rendered suite) | PASS; 11/11 rendered checks |
| Source lint (`app`, `lib`, `tests`) | PASS |
| Production-style build | PASS |

The build retains its existing large-chunk warning; it did not block the local interaction walk.

## Frozen hash verification

All eight local public data artifacts are unchanged:

| Artifact | SHA-256 |
|---|---|
| `app-data.json.gz` | `7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614` |
| `ranked-places.geojson.gz` | `56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972` |
| `uncertainty.geojson.gz` | `a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137` |
| `place-labels.json.gz` | `21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9` |
| `situate-1f-index.json.gz` | `4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f` |
| `situate-approach-context-v1.json.gz` | `b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9` |
| `situate-approach-context-wave2-v1.json.gz` | `5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf` |
| `p2-5-ui-objects-v1.json.gz` | `b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454` |

## Scope integrity / stop

- G2 / LLM / task box: **not implemented**.
- Ranks, predicates, assignment, freshness, and frozen data: **unchanged**.
- Production / Vercel: **untouched**. The public site remains on the prior build.
- Git commit: **not created**.
- A future production redeploy remains a separate authorization and must extend W11 proof to all eight gzip artifacts.

