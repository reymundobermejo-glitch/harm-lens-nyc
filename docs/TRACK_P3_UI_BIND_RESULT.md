# Track P3 UI Bind Result

**Version:** `HL-P3-UI-BIND-v1`  
**Input authority:** `HL-P2.5-OBJECT-RELEASE-v1`  
**Decision:** **PASS (local only)**

The released P2.5 objects are bound locally across Explore, map eligibility, Inspect, Compare, Why, exact supporting IDs, and the DRAFT Evidence Brief. Automated contract, equality, build, hash, and the required interactive browser walk all pass on the IPv4-only local wrapper at `http://127.0.0.1:3012/`. No production deployment was attempted.

## Bound families

| Family | Local UI binding | Claim boundary |
|---|---|---|
| Road-user crash frequency | Everyone / Pedestrians / Cyclists / Motorists; map and list share positive-count eligibility outside the baseline | Named groups overlap; published injured-or-killed Crash fields only; Person does not replace Crash |
| Human toll | Optional at 36m, beside frequency in Inspect and Brief | Crash-field sum only; frequency remains default; 668 injury / 13 fatal reconciliation disclosure retained |
| Windows | 24m / 36m / 48m through `2026-06-11` | Existing 36m screened place universe stays fixed; no 12m, 5y, or all-available object |
| Persistence | `HL-PERSISTENCE-36M-48M-P90POS-v1` in Inspect and Brief | Everyone predicate only; never stable, chronic, hotspot, risk, or priority; fatal means at least one fatal record |
| Corridors | Picker limited to 18 released components; component metric and exact supporting-ID equality shown | `HL-CORRIDOR-LION26B-v0`; no street-name merge; not an official DOT program layer |

## Acceptance

| Check | Result | Evidence |
|---|---|---|
| Everyone · 36m · injury baseline | **PASS automated** | `intersection_node:26912` remains first with 66 records; label remains Buffalo Ave & Eastern Pkwy |
| Pedestrian · injury · 36m | **PASS automated** | map/list eligibility uses the same positive-count place set; `intersection_node:26863` has 21 records and 21 exact IDs |
| Toll beside frequency | **PASS automated** | separate optional 36m block; frequency is not replaced |
| Persistence | **PASS automated** | released 36m/48m state and thresholds rendered; fatal disclosure says “at least one fatal crash record” |
| Corridor conservation | **PASS automated** | all 18 components have metric count = exact unique-ID count; Flatbush components remain distinct; Northern Boulevard Queens and Staten Island remain separate |
| Compare lock | **PASS automated** | A/B captures road-user + window and hard-blocks after either changes; grain lock retained |
| DRAFT Brief | **PASS automated** | lock, optional toll, persistence, corridor evidence, exact IDs, and limitations are composed from released objects |
| Browser interaction on `127.0.0.1:3012` | **PASS** | fresh IPv4 tab; host, map/list, exact IDs, locks, safeguards, Brief, and regressions walked below |

## IPv4 host evidence

Captured `2026-08-14T16:21:01Z`:

| Service | PID / bind | Evidence | Result |
|---|---|---|---|
| Production-mode app upstream | `62296` · `*:3011` IPv4 | wrapper upstream only; not used as the acceptance URL | PASS |
| Local preview wrapper | `59795` · `127.0.0.1:3012` IPv4 | `http://127.0.0.1:3012/` returned HTTP 200 | PASS |
| P2.5 projection response | wrapper `/data/p2-5-ui-objects-v1.json.gz` | `Content-Type: application/gzip`; `Cache-Control: no-store`; no `Content-Encoding` header | PASS |
| P2.5 bytes | app and wrapper-served dist copies | both SHA-256 `b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454` | PASS |

## Interactive browser walk — `http://127.0.0.1:3012/`

| # | Walk | Result | Evidence |
|---|---|---|---|
| 1 | Cold baseline: Everyone · 36m · injury | **PASS** | Buffalo Ave & Eastern Pkwy (`intersection_node:26912`) is analytical order #1 with 66 collision records. |
| 2 | Pedestrians and map/list parity | **PASS** | eligible map/list set changed to 9,418 places; Eastern Pkwy & Utica Ave showed 21 injury records and 21 exact supporting IDs with Equality PASS. |
| 3 | Human toll | **PASS** | 36m displayed 21 people recorded injured beside—not instead of—frequency; it was disabled and cleared outside 36m. |
| 4 | Window and persistence | **PASS** | 48m lock changed counts; persistence remained explicitly Everyone-only. Fatal view disclosed its threshold as at least one fatal crash record, not a high-count tier. |
| 5 | Corridor identity and active-lock honesty | **PASS** | Northern Boulevard Queens and Staten Island are separate component options; Flatbush remains split. Off Everyone · 36m, the component filter now shows no misleading roll-up and says why. |
| 6 | Compare lock | **PASS** | after choosing A/B then changing road-user predicate, Compare hard-blocked with restart guidance; grain lock remained retained. |
| 7 | DRAFT Evidence Brief | **PASS** | generated Brief carried the active lock, exact-ID/equality context, Unknown as Unknown, concentration ≠ risk, and investigation—not treatment—next action. Browser console had no errors. |
| 8 | Restore baseline | **PASS** | Clear Find filters restored the normal 32-row top list and Buffalo #1 / 66. |
| 9 | Regression walk | **PASS** | P0 Why honesty, G0 frozen-label search (`broadway & rector` = one list/map place), G1 Bike-route Yes filter parity, C5 chrome, and C6 retained selected pins for nodes 26912 and 21791 all held. |

### Local defect corrected during the walk

The Explore mode and harm-lens switches were present but collapsed to 2px by flex shrink, making them invisible and untappable. The local CSS now reserves their intrinsic height. The corridor panel additionally withholds its Everybody/36m-only roll-up when a different road-user/window lock is active; it explains the release boundary rather than showing a mismatched total.

## Additive projection

- `phase-3/app/public/data/p2-5-ui-objects-v1.json.gz`
- SHA-256: `b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454`
- 40,549 exact existing Phase 3 place keys
- 18 corridor components
- Builder: `phase-3/scripts/build_p2_5_ui_projection.py`

The projection is additive. It does not rewrite the seven pre-existing public data artifacts.

## Frozen hash integrity

All seven hashes in `P2_5_OBJECT_RELEASE_MANIFEST.json.public_data_baseline_hashes` re-verified **PASS**:

| Artifact | SHA-256 |
|---|---|
| `app-data.json.gz` | `7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614` |
| `place-labels.json.gz` | `21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9` |
| `ranked-places.geojson.gz` | `56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972` |
| `situate-1f-index.json.gz` | `4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f` |
| `situate-approach-context-v1.json.gz` | `b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9` |
| `situate-approach-context-wave2-v1.json.gz` | `5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf` |
| `uncertainty.geojson.gz` | `a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137` |

## Verification

```bash
cd phase-3/app
node --test tests/ask-legend-g0.test.mjs tests/ask-legend-g1.test.mjs tests/rendered-html.test.mjs
npm test
npx eslint app/page.tsx lib/evidence-brief.ts
```

- Ask Legend G0/G1: **30/30 PASS**
- Combined G0/G1/rendered suite: **41/41 PASS**
- `npm test`: build PASS + rendered suite **11/11 PASS**
- Scoped changed-code lint: **PASS**
- Full repository lint remains polluted by previously generated `vercel-out/` files, which are outside this slice and were not changed.

## Scope integrity

- No G2/LLM, KSI, treatment, exposure-risk, 12m/5y/all-available, or citywide corridor object was added.
- No new predicate meaning, official priority, or mutually exclusive road-user share was created.
- No production redeploy or commit was performed.
- Production still serves the prior P0/P1 build until separately authorized.

## Stop

P3 is **PASS locally**. **G2 is still blocked; production is not updated.** A separate explicit production-redeploy authorization is required, including the additive eighth gzip artifact in its serving proof.
