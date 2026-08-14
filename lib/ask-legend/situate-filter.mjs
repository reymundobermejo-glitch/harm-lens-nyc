/**
 * Ask Legend G1b — claim-safe Situate family filters (documented Yes only).
 * Never implies untreated / No / Plan from no-match or empty evidence.
 */

/** Families authorized for G1b chips after H3 PASS (Wave-1 + locked Wave-2 trio). */
export const CLAIM_SAFE_SITUATE_FAMILIES = Object.freeze([
  // Wave-1 documented street changes
  "oneF_lpi",
  "oneF_aps",
  "oneF_sip",
  "raised_crosswalk",
  // Wave-1 street network / rules (published Yes only)
  "bike_routes",
  "truck_routes",
  "speed_limits",
  // Wave-2 locked trio
  "bus_lanes",
  "parking_regulation_signs",
  "enhanced_crossings",
]);

/** Explicit HOLD — refuse even if a caller invents a chip. */
export const HOLD_SITUATE_FAMILIES = Object.freeze([
  "exclusive_ped",
  "slow_zones",
  "turn_calming",
  "sign_work_orders",
]);

const YES_CLAIM_CLASSES = new Set([
  "documented_history",
  "current_inventory",
  "regulatory_posted",
  "current_network_attribute",
]);

const ONLY_MATCH_MODE = "documented_yes";

/**
 * @typedef {object} SituateEvidenceRow
 * @property {string} family
 * @property {string} [claimClass]
 * @property {boolean} [speedClaimEligible]
 */

/**
 * @typedef {object} SituateFilterPlace
 * @property {string} [id]
 * @property {SituateEvidenceRow[]} [documentedStreetChanges]
 * @property {SituateEvidenceRow[]} [streetNetworkAndRules]
 * @property {SituateEvidenceRow[]} [evidence]
 * @property {Record<string, { status?: string; documentedYes?: boolean }>} [familyStatus]
 * @property {Record<string, { documentedYes?: boolean }>} [families]
 */

/**
 * @typedef {object} SituateFilterIndex
 * @property {Record<string, SituateFilterPlace>} places
 */

/**
 * True only when frozen evidence establishes a documented/published Yes for the family.
 * Unmatched / ambiguous / empty → false (not a No claim).
 *
 * @param {SituateFilterPlace | null | undefined} place
 * @param {string} family
 * @returns {boolean}
 */
export function placeHasDocumentedYes(place, family) {
  if (!place || typeof family !== "string") return false;

  const predeclared = place.families?.[family]?.documentedYes;
  if (predeclared === true) return true;
  if (place.familyStatus?.[family]?.documentedYes === true) return true;

  const wave2Status = place.familyStatus?.[family]?.status;
  if (wave2Status === "established") return true;
  // unmatched / ambiguous never count as Yes

  /** @type {SituateEvidenceRow[]} */
  const rows = [
    ...(Array.isArray(place.documentedStreetChanges) ? place.documentedStreetChanges : []),
    ...(Array.isArray(place.streetNetworkAndRules) ? place.streetNetworkAndRules : []),
    ...(Array.isArray(place.evidence) ? place.evidence : []),
  ];

  for (const row of rows) {
    if (!row || row.family !== family) continue;
    if (!YES_CLAIM_CLASSES.has(String(row.claimClass || ""))) continue;
    if (family === "speed_limits" && row.speedClaimEligible !== true) continue;
    return true;
  }
  return false;
}

/**
 * Filter the frozen situate index to place ids with documented Yes for a claim-safe family.
 *
 * @param {unknown} rawArgs
 * @param {SituateFilterIndex | null | undefined} situateIndex
 * @param {{ allowedPlaceIds?: ReadonlySet<string> | readonly string[] }} [ctx]
 * @returns {{ ok: true, tool: "filterSituateFamily", args: { family: string, matchMode: "documented_yes" }, placeIds: string[], effect: string } | { ok: false, refused: true, tool: "filterSituateFamily", reason: string, args?: Record<string, unknown> }}
 */
export function filterSituateFamily(rawArgs, situateIndex, ctx = {}) {
  const family = rawArgs && typeof rawArgs === "object"
    ? /** @type {{ family?: unknown }} */ (rawArgs).family
    : rawArgs;
  const matchMode = rawArgs && typeof rawArgs === "object"
    ? /** @type {{ matchMode?: unknown }} */ (rawArgs).matchMode ?? ONLY_MATCH_MODE
    : ONLY_MATCH_MODE;

  if (typeof family !== "string" || !family) {
    return { ok: false, refused: true, tool: "filterSituateFamily", reason: "family required", args: { family } };
  }
  if (HOLD_SITUATE_FAMILIES.includes(family)) {
    return {
      ok: false,
      refused: true,
      tool: "filterSituateFamily",
      reason: "family on HOLD — not authorized for Ask Legend chips",
      args: { family },
    };
  }
  if (!CLAIM_SAFE_SITUATE_FAMILIES.includes(family)) {
    return {
      ok: false,
      refused: true,
      tool: "filterSituateFamily",
      reason: "family not in claim-safe allowlist",
      args: { family },
    };
  }
  if (matchMode !== ONLY_MATCH_MODE) {
    return {
      ok: false,
      refused: true,
      tool: "filterSituateFamily",
      reason: "only documented_yes matchMode is allowed (no untreated/No/Plan filters)",
      args: { family, matchMode },
    };
  }
  if (!situateIndex || typeof situateIndex !== "object" || !situateIndex.places) {
    return {
      ok: false,
      refused: true,
      tool: "filterSituateFamily",
      reason: "situate index required",
      args: { family },
    };
  }

  const allowed = ctx.allowedPlaceIds
    ? (ctx.allowedPlaceIds instanceof Set ? ctx.allowedPlaceIds : new Set(ctx.allowedPlaceIds))
    : null;

  /** @type {string[]} */
  const placeIds = [];
  for (const [id, place] of Object.entries(situateIndex.places)) {
    if (allowed && !allowed.has(id)) continue;
    if (placeHasDocumentedYes(place, family)) placeIds.push(id);
  }
  placeIds.sort();

  return {
    ok: true,
    tool: "filterSituateFamily",
    args: { family, matchMode: ONLY_MATCH_MODE },
    placeIds,
    effect: `Show places with documented Yes for ${family}`,
  };
}

/**
 * Build a minimal filter index from precomputed Yes maps (for tests / page wire).
 *
 * @param {Record<string, string[] | Record<string, boolean>>} yesByPlace
 * @returns {SituateFilterIndex}
 */
export function buildSituateFilterIndexFromYesMap(yesByPlace) {
  /** @type {Record<string, SituateFilterPlace>} */
  const places = {};
  for (const [id, value] of Object.entries(yesByPlace || {})) {
    /** @type {Record<string, { documentedYes: boolean }>} */
    const families = {};
    if (Array.isArray(value)) {
      for (const family of value) families[family] = { documentedYes: true };
    } else if (value && typeof value === "object") {
      for (const [family, yes] of Object.entries(value)) {
        if (yes) families[family] = { documentedYes: true };
      }
    }
    places[id] = { id, families };
  }
  return { places };
}
