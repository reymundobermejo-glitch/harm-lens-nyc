/**
 * P6.H4 citywide coverage footnotes from HL-P6-H1-COVERAGE-FREEZE-v1.
 * source_fact of the frozen statement only. Never a place flag, G1b chip, or node join.
 */

export const P6_H1_COVERAGE_FREEZE_VERSION = "HL-P6-H1-COVERAGE-FREEZE-v1";
export const P6_H1_PROBE_UTC = "2026-08-17T16:11:25Z";
export const P6_H4_COVERAGE_HEADING = "Citywide coverage — not at this place";

/** @typedef {{ id: string, statement: string, cannotSupport: string }} CoverageFootnote */

/** @type {readonly CoverageFootnote[]} */
export const P6_COVERAGE_FOOTNOTES = Object.freeze([
  Object.freeze({
    id: "p6-h1-dot-signals-citywide-count",
    statement: "NYC DOT: as of March 2022, there were 13,543 intersections with traffic signals citywide (2,862 Manhattan, 1,768 Bronx, 4,848 Brooklyn, 3,432 Queens, 633 Staten Island). Citywide count statement only.",
    cannotSupport: "Does not say this intersection is signalized. Does not provide plant or controller ID, activation or removal date, or a join to intersection_node:26912 or any LION node.",
  }),
  Object.freeze({
    id: "p6-h1-qt6m-xctn-coverage-magnitude",
    statement: "DOT Street Sign Work Orders (qt6m-xctn): 1,281,256 Current and 13,929,146 Historical completed work-order rows. Coverage magnitude only.",
    cannotSupport: "Not signs present now or at crash date. Work-order ID is not a physical instance ID.",
  }),
  Object.freeze({
    id: "p6-h1-fb86-vt7u-fms-phase-vocabulary",
    statement: "Capital Projects Dashboard (fb86-vt7u): 60 current_phase labels on 56,525 FMS-grain rows (FMS ID + budget line + reporting period). Coverage vocabulary only.",
    cannotSupport: "Not the six-value Plan enum (planned | approved | funded | procured | built | cancelled) at a street or LION node.",
  }),
]);

export function coverageFootnotesBlock() {
  return {
    claimClass: "source_fact",
    freezeVersion: P6_H1_COVERAGE_FREEZE_VERSION,
    probeUtc: P6_H1_PROBE_UTC,
    heading: P6_H4_COVERAGE_HEADING,
    items: P6_COVERAGE_FOOTNOTES.map((item) => ({ ...item })),
  };
}
