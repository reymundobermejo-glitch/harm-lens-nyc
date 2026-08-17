/**
 * Ask Legend — public integration API (library only).
 *
 * G0: frozen place search
 * G1a/G1b: allowlisted tools + chip catalog (NOT wired into page.tsx here)
 *
 * Do not import LLM / live Socrata. Chips are not visible until a later
 * page.tsx wire (planned after C6).
 */

import { searchPlaces } from "./search.mjs";

export {
  normalizeQuery,
  queryTokens,
  splitCrossStreet,
  labelTokens,
} from "./normalize.mjs";

export { searchPlaces, searchNearMisses } from "./search.mjs";

export {
  ALLOWLISTED_TOOLS,
  setLens,
  setMode,
  setAgreementFilter,
  filterByQuery,
  clearFilters,
  fitNyc,
  flyToPlace,
  selectPlace,
  invokeAllowlistedTool,
} from "./tools.mjs";

export {
  CLAIM_SAFE_SITUATE_FAMILIES,
  HOLD_SITUATE_FAMILIES,
  placeHasDocumentedYes,
  filterSituateFamily,
  buildSituateFilterIndexFromYesMap,
} from "./situate-filter.mjs";

export {
  ASK_LEGEND_CHIP_CATALOG,
  getChip,
  listChips,
  parseChip,
  applyChip,
} from "./chips.mjs";

export {
  ASK_LEGEND_TASK_HONESTY,
  ASK_LEGEND_TOOLKIT_STAGE,
  TOOLKIT_TOOLS,
  readSessionBag,
  parsePlannerJob as parsePlannerJobV1,
  invokeToolkitTool,
  setRoadUser,
  setWindow,
  openInspect,
  setCrashYear,
  openCompare,
  composeWhyPlace,
  isSelectedPlacePronoun,
} from "./toolkit.mjs";

export {
  ASK_LEGEND_TOOLKIT_V11,
  WALK_THROUGH_STEPS,
  MISSING_EVIDENCE_ITEMS,
  bucketObservedHours,
  walkThroughPlace,
  challengeCase,
  listMissingEvidence,
  observedHours,
  parseCloserLookJob,
  parsePlannerJob as parsePlannerJobV11,
  runPlannerJob as runPlannerJobV11,
} from "./toolkit-v11.mjs";

export {
  ASK_LEGEND_JOB_COACH,
  ASK_LEGEND_JOB_COACH_HONESTY,
  LIST_ORDER_NOT_DANGEROUS,
  JOB_COACH_TOOLS,
  lockPhrase,
  resolveCoachLock,
  boroughOfLonLat,
  normalizeBoroughName,
  startCoachJob,
  selectTopInBorough,
  parseCoachJob,
  parsePlannerJob,
  runPlannerJob,
} from "./toolkit-job-coach.mjs";

/** Required UI subtitle when Ask Legend search chrome ships. */
export const ASK_LEGEND_SUBTITLE = "Searches this frozen evidence only";

/** Search stage id (G0). Kept for existing G0 tests / wire. */
export const ASK_LEGEND_STAGE = "G0";

/** Chip/tool stages available in this library (not UI-visible yet). */
export const ASK_LEGEND_CHIP_STAGES = Object.freeze(["G1a", "G1b"]);

/**
 * Build a search universe from Phase 3 app places + place-labels index.
 * Only emits ids present in `places` (fail closed).
 *
 * @param {readonly { id: string; placeType: "intersection_node" | "midblock_segment"; placeId: number | string; street?: string | null; displayName?: string | null }} places
 * @param {{ labels?: Record<string, { title?: string; streetNames?: string[] }> } | null | undefined} labelIndex
 * @returns {import("./search.mjs").AskLegendPlace[]}
 */
export function buildSearchUniverse(places, labelIndex) {
  if (!Array.isArray(places)) return [];
  const labels = labelIndex?.labels ?? {};
  /** @type {import("./search.mjs").AskLegendPlace[]} */
  const out = [];
  for (const place of places) {
    if (!place?.id) continue;
    const label = labels[place.id];
    out.push({
      id: place.id,
      placeType: place.placeType,
      placeId: place.placeId,
      title: label?.title ?? null,
      streetNames: Array.isArray(label?.streetNames) ? label.streetNames : [],
      street: place.street ?? null,
      displayName: place.displayName ?? null,
    });
  }
  return out;
}

/**
 * Convenience: return match ids in rank order (for list filtering).
 *
 * @param {string} query
 * @param {readonly import("./search.mjs").AskLegendPlace[]} places
 * @param {{ limit?: number }} [options]
 * @returns {string[]}
 */
export function searchPlaceIds(query, places, options) {
  return searchPlaces(query, places, options).map((m) => m.id);
}
