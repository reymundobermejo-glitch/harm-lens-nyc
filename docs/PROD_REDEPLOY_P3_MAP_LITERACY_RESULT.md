# Production Redeploy — P3 + Map Literacy

**Decision:** PASS

**Checked:** 2026-08-14T19:08:46Z

**Production:** https://harm-lens-nyc.vercel.app

**Deployment:** `dpl_4bn2XN5H79aZutaiWadKf6zMmSpH`

**Deployment URL:** https://harm-lens-8a3jd4ylw-reymundobermejo-5871s-projects.vercel.app

**GitHub:** https://github.com/reymundobermejo-glitch/harm-lens-nyc

**Source commit:** `a954f5ff2730d857ba59c890b80d5571dbfcd826`

The existing `harm-lens-nyc` repository received the local P3 UI bind and map first-glance literacy source. The production alias was promoted to the exact static deployment only after authenticated pre-alias W11 passed 8/8. A second public-alias W11 proof also passed 8/8. Git is source history; the host remains the established static Vercel payload.

## W11 production proof

Every response was HTTP 200, byte-identical to the built distribution, gzip magic `1f 8b`, `Content-Type: application/gzip`, and `Content-Encoding: identity`.

| File | SHA-256 | Result |
|---|---|---|
| `app-data.json.gz` | `7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614` | PASS |
| `p2-5-ui-objects-v1.json.gz` | `b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454` | PASS |
| `place-labels.json.gz` | `21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9` | PASS |
| `ranked-places.geojson.gz` | `56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972` | PASS |
| `situate-1f-index.json.gz` | `4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f` | PASS |
| `situate-approach-context-v1.json.gz` | `b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9` | PASS |
| `situate-approach-context-wave2-v1.json.gz` | `5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf` | PASS |
| `uncertainty.geojson.gz` | `a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137` | PASS |

Evidence: `phase-3/STEP_E_PREFLIGHT_W11_HOST_PROOF.json`.

## Production browser spot-check

| Check | Result | Evidence |
|---|---|---|
| Cold load | PASS | NYC ortho, Hurt-gold piles, three-item legend, old-photo 2018 warning, and baseline list loaded |
| Baseline | PASS | Buffalo Ave & Eastern Pkwy remained analytical order 1 with 66 injury-involved records |
| Borough look | PASS | “Looking at Brooklyn” moved the view while explicitly retaining the full active-filter list |
| Pile trail | PASS | Numbered pile entered `This pile · N places`; Back returned to the prior frame |
| Street search | PASS | `broadway & rector` returned one list place and matching selected map place |
| Harm lens | PASS | Hurt and Died changed the active lens; fatal city marks rendered in brick |
| Who filter | PASS | Walking reduced the map/list universe together and showed the active Pedestrians lock |
| Open place / Why | PASS | Why disclosed record count, window, grain, limitations, concentration ≠ risk, and investigation rather than treatment |
| Lens-flip selection | PASS | Fixtures 26912 and 21791 remained selected across Hurt/Died changes |
| Data load / console | PASS | Eighth P2.5 gzip loaded; no fatal loading screen and no console warnings/errors |

## Integrity and scope

- `wrapper_shipped: false`; `phase-3/start_local_preview.mjs` and the 3012 wrapper are not in the static payload.
- Framework remains Vercel **Other** with a static `vercel-out` payload.
- No new GitHub repository was created and no force-push was used.
- Frozen gzip bytes, ranks, predicates, and evidence contracts were not changed.
- G2/LLM remains blocked and untouched.

An initial guarded attempt from the nested `vercel-out` working directory was rejected by Vercel before readiness because of the project output-directory setting. It was not promoted. The established app-root static deploy path then produced the READY deployment above; the product alias was promoted only after its authenticated W11 8/8 proof.
