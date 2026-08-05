# Harm Lens — stage-gated project foundation

Status: **PASS WITH CONDITIONS — build the MVP only**  
Decision date: 2026-08-05

## 1. Exact audience and decision

Primary audience: NYC residents, advocates, students, and general-news readers who are curious about traffic harm but do not work with collision data.

Decision the experience supports: decide whether “the group appearing in the most injury-involved crash records” is also “the group appearing in the most fatal crash records,” and leave with a more careful way to interpret traffic-harm rankings.

It does not support operational resource allocation. That would require geography, time windows, exposure, population, and more causal context.

## 2. User promise

In under 30 seconds, the viewer can change the definition of harm, see the ranking change, inspect the exact live aggregate values, and understand what the comparison does not measure.

## 3. One-sentence insight

Across the currently published NYC crash table, motorist injuries appear in the most collision records, but pedestrian deaths appear in the most fatal collision records—the leading group changes when the outcome changes.

## 4. Non-goals

- No dashboard, map, borough filter, timeline, contributing-factor analysis, or record browser in the MVP.
- No claim about individual risk, dangerousness, causation, fault, or policy priority.
- No comparison of raw injury counts with raw fatal counts on one shared scale.
- No “real-time” claim; the page is live-connected, while the source itself is currently paused.
- No people-count claim. The metric is collision records with at least one person in the named group injured or killed.

## 5. Data contract

Source: NYC Open Data, **Motor Vehicle Collisions — Crashes**, dataset `h9gi-nx95`. Each row represents one police-reported crash event.

Required source fields:

| Output | Source-field predicate | Unit |
|---|---|---|
| Motorists, injury | `number_of_motorist_injured > 0` | collision records |
| Pedestrians, injury | `number_of_pedestrians_injured > 0` | collision records |
| Cyclists, injury | `number_of_cyclist_injured > 0` | collision records |
| Motorists, fatal | `number_of_motorist_killed > 0` | collision records |
| Pedestrians, fatal | `number_of_pedestrians_killed > 0` | collision records |
| Cyclists, fatal | `number_of_cyclist_killed > 0` | collision records |

Also return `count(*)` as `total_rows` and `max(crash_date)` as `latest_crash_date` for freshness context.

Contract rules:

- All eight outputs must parse as finite non-negative values; the date must parse successfully.
- Categories may overlap: one crash can count for more than one road-user group.
- A crash with multiple injured people in one group still counts once for that group.
- If the live response fails validation, show an honest unavailable state rather than invented or stale values.

Validated 2026-08-05: 2,269,187 rows; injury-involved records—motorists 353,245, pedestrians 132,157, cyclists 66,461; fatal records—motorists 1,355, pedestrians 1,778, cyclists 293; latest crash date 2026-06-11.

## 6. Live API aggregate strategy

The browser calls a same-origin server endpoint. The server sends one SoQL aggregate request to Socrata and returns one compact row. No raw records, pagination, or client-side secrets.

```sql
select
  count(*) as total_rows,
  sum(case when number_of_motorist_injured > 0 then 1 else 0 end) as motorist_injury_collisions,
  sum(case when number_of_pedestrians_injured > 0 then 1 else 0 end) as pedestrian_injury_collisions,
  sum(case when number_of_cyclist_injured > 0 then 1 else 0 end) as cyclist_injury_collisions,
  sum(case when number_of_motorist_killed > 0 then 1 else 0 end) as motorist_fatal_collisions,
  sum(case when number_of_pedestrians_killed > 0 then 1 else 0 end) as pedestrian_fatal_collisions,
  sum(case when number_of_cyclist_killed > 0 then 1 else 0 end) as cyclist_fatal_collisions,
  max(crash_date) as latest_crash_date
```

Cache public responses briefly (five minutes) to reduce source load. A refresh control re-requests the endpoint but does not pretend to bypass upstream caching.

## 7. Limitations

- Police-reported crashes only; reporting rules and practices shape inclusion.
- Preliminary records can be amended.
- The source currently warns that automated updates are temporarily paused.
- Published coverage currently ends 2026-06-11, so this is not a picture of today.
- No travel exposure (trips, miles, hours), population denominator, or risk rate.
- Group categories can overlap within a crash.
- The measure is occurrence in crash records, not the number of people harmed.
- The all-time accumulation is influenced by the dataset's coverage period and does not describe recent trends.

## 8. Visualization concept

One coordinated **rank-shift lens**: three labeled horizontal marks share a single outcome state. Switching from “Injury volume” to “Fatal harm” changes the values, normalizes each outcome's leader to 100, and reorders the marks so the motorist/pedestrian reversal is visible as the central event. Exact record counts remain attached to each mark.

This is stronger than a map for the MVP because the claim is a rank reversal, not a geographic pattern. It is stronger than two charts because the viewer changes one shared view instead of comparing separate panels. It avoids a dual axis and explicitly labels the normalization.

## 9. Interaction model

- Default: injury-involved crash records.
- Primary control: two-state segmented buttons, “Injury volume” and “Fatal harm.”
- On change: headline, order, mark length, exact values, and annotation update together.
- Secondary control: “Refresh live data.”
- Details disclosure: methodology and limitations; not a second exploratory surface.
- No filters in MVP.

## 10. Accessibility

- Native buttons with visible focus and an explicit pressed state.
- Full keyboard operation without drag-only behavior.
- Outcome change announced through an `aria-live` summary.
- Text labels and exact values carry meaning; color is redundant.
- A screen-reader table mirrors the visual values.
- Motion is brief and disabled under `prefers-reduced-motion`.
- Responsive layout, strong contrast, and touch targets at least 44px high.

## 11. Success criteria

- At least 80% of five comprehension-test participants can state the reversal unaided after 30 seconds.
- At least 80% correctly identify the unit as collision records, not people or risk.
- All six displayed values match a direct Socrata aggregate response.
- API payload is one aggregate row and the page never downloads raw crash rows.
- Keyboard-only and reduced-motion checks pass.
- Mobile view preserves labels, exact values, and the outcome control without horizontal scrolling.
- Failure state does not display unverified numbers.

## 12. MVP scope

One route; one headline; one two-state control; one coordinated three-group visualization; exact live values; source freshness; refresh; short methodology/limitations disclosure; accessible fallback/error state.

Explicitly deferred: map, years, boroughs, road-user filters, rate calculations, sharing features, annotations by place, and multiple chart modes.

## 13. Validation plan

1. Query validation: compare the endpoint's eight values with a direct Socrata request.
2. Unit tests: parse/validation, ranking, normalization, and both outcome states.
3. Content QA: prohibit “people,” “risk,” “real-time,” and “current conditions” claims where unsupported.
4. Interaction QA: mouse, touch-sized controls, keyboard, focus, live announcement, reduced motion.
5. Responsive QA: narrow mobile and desktop layouts.
6. Failure QA: simulate upstream timeout, non-200 response, malformed row, and empty response.
7. Comprehension test: five people answer “who leads each outcome?” and “what is being counted?”

## 14. Build / no-build gate

### Gate questions

- Is the insight supported by a compact authoritative query? **Yes.** Direct validation reproduced all six values.
- Is the unit defensible and explainable? **Yes, if presented as collision records containing at least one injury/death in the group.**
- Does one visualization directly express the claim? **Yes.** The rank-shift lens makes the reversal visible.
- Can the MVP avoid implying risk or causality? **Yes, with persistent unit and limitation copy.**
- Is source freshness adequate for a “current conditions” product? **No.**
- Can it still be an honest live-connected data story? **Yes, if the source pause and latest crash date are prominent.**

### Decision

**PASS WITH CONDITIONS.** Build only the narrow MVP. Do not add the map or exploratory filters until the source resumes updating and a separate geographic question passes its own gate. If the public story requires current conditions rather than a live view of the currently published table, do not launch.
