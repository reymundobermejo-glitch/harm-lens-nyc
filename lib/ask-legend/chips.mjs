/**
 * Ask Legend G1 — frozen chip catalog + apply/parse helpers.
 * Chips are data only. Not visible in Explore until a later page.tsx wire (after C6).
 */

import { filterSituateFamily } from "./situate-filter.mjs";
import { invokeAllowlistedTool } from "./tools.mjs";

/**
 * @typedef {object} AskLegendChip
 * @property {string} id
 * @property {"G1a" | "G1b"} stage
 * @property {string} label
 * @property {string} tool
 * @property {Record<string, unknown>} args
 * @property {string} [hint]
 */

/** @type {readonly AskLegendChip[]} */
export const ASK_LEGEND_CHIP_CATALOG = Object.freeze([
  // —— G1a: lens / mode / agreement / motion ——
  {
    id: "g1a-lens-injury",
    stage: "G1a",
    label: "Injury-involved lens",
    tool: "setLens",
    args: { lens: "injury" },
    hint: "Switch to injury-involved harm lens",
  },
  {
    id: "g1a-lens-fatal",
    stage: "G1a",
    label: "Fatal lens",
    tool: "setLens",
    args: { lens: "fatal" },
    hint: "Switch to fatal harm lens",
  },
  {
    id: "g1a-mode-intersection",
    stage: "G1a",
    label: "Intersections",
    tool: "setMode",
    args: { mode: "intersection_node" },
  },
  {
    id: "g1a-mode-midblock",
    stage: "G1a",
    label: "Midblock",
    tool: "setMode",
    args: { mode: "midblock_segment" },
  },
  {
    id: "g1a-agreement-all",
    stage: "G1a",
    label: "All agreement states",
    tool: "setAgreementFilter",
    args: { agreementFilter: "all" },
  },
  {
    id: "g1a-agreement-injury-led",
    stage: "G1a",
    label: "Injury-led",
    tool: "setAgreementFilter",
    args: { agreementFilter: "injury_led" },
  },
  {
    id: "g1a-agreement-fatal-led",
    stage: "G1a",
    label: "Fatal-led",
    tool: "setAgreementFilter",
    args: { agreementFilter: "fatal_led" },
  },
  {
    id: "g1a-agreement-both",
    stage: "G1a",
    label: "Both lenses elevated",
    tool: "setAgreementFilter",
    args: { agreementFilter: "both" },
  },
  {
    id: "g1a-fit-nyc",
    stage: "G1a",
    label: "Fit NYC",
    tool: "fitNyc",
    args: {},
    hint: "Five-borough camera frame",
  },
  {
    id: "g1a-clear-filters",
    stage: "G1a",
    label: "Clear Find filters",
    tool: "clearFilters",
    args: {},
  },

  // —— G1b: documented Yes Situate families only (H3 PASS) ——
  {
    id: "g1b-yes-lpi",
    stage: "G1b",
    label: "LPI documented",
    tool: "filterSituateFamily",
    args: { family: "oneF_lpi", matchMode: "documented_yes" },
    hint: "Documented Yes only — never untreated",
  },
  {
    id: "g1b-yes-aps",
    stage: "G1b",
    label: "APS documented",
    tool: "filterSituateFamily",
    args: { family: "oneF_aps", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-sip",
    stage: "G1b",
    label: "SIP documented",
    tool: "filterSituateFamily",
    args: { family: "oneF_sip", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-raised-crosswalk",
    stage: "G1b",
    label: "Raised crosswalk documented",
    tool: "filterSituateFamily",
    args: { family: "raised_crosswalk", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-bike",
    stage: "G1b",
    label: "Bike route published",
    tool: "filterSituateFamily",
    args: { family: "bike_routes", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-truck",
    stage: "G1b",
    label: "Truck route published",
    tool: "filterSituateFamily",
    args: { family: "truck_routes", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-speed",
    stage: "G1b",
    label: "Eligible posted speed",
    tool: "filterSituateFamily",
    args: { family: "speed_limits", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-bus",
    stage: "G1b",
    label: "Bus lane published",
    tool: "filterSituateFamily",
    args: { family: "bus_lanes", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-parking",
    stage: "G1b",
    label: "Parking regulation sign published",
    tool: "filterSituateFamily",
    args: { family: "parking_regulation_signs", matchMode: "documented_yes" },
  },
  {
    id: "g1b-yes-enhanced",
    stage: "G1b",
    label: "Enhanced crossing documented",
    tool: "filterSituateFamily",
    args: { family: "enhanced_crossings", matchMode: "documented_yes" },
  },
]);

const CHIP_BY_ID = new Map(ASK_LEGEND_CHIP_CATALOG.map((chip) => [chip.id, chip]));

/**
 * @param {string} chipId
 * @returns {AskLegendChip | null}
 */
export function getChip(chipId) {
  return CHIP_BY_ID.get(chipId) ?? null;
}

/**
 * @param {"G1a" | "G1b" | "all"} [stage]
 * @returns {AskLegendChip[]}
 */
export function listChips(stage = "all") {
  if (stage === "all") return [...ASK_LEGEND_CHIP_CATALOG];
  return ASK_LEGEND_CHIP_CATALOG.filter((chip) => chip.stage === stage);
}

/**
 * Validate a chip-shaped object (id/label/tool/args). Fail closed.
 *
 * @param {unknown} raw
 * @returns {{ ok: true, chip: AskLegendChip } | { ok: false, refused: true, reason: string }}
 */
export function parseChip(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, refused: true, reason: "chip must be an object" };
  }
  const chip = /** @type {Partial<AskLegendChip>} */ (raw);
  if (typeof chip.id !== "string" || !chip.id) {
    return { ok: false, refused: true, reason: "chip.id required" };
  }
  const frozen = CHIP_BY_ID.get(chip.id);
  if (!frozen) {
    return { ok: false, refused: true, reason: "chip id not in frozen catalog" };
  }
  if (chip.tool && chip.tool !== frozen.tool) {
    return { ok: false, refused: true, reason: "chip tool does not match catalog" };
  }
  if (chip.args && JSON.stringify(chip.args) !== JSON.stringify(frozen.args)) {
    return { ok: false, refused: true, reason: "chip args do not match catalog" };
  }
  return { ok: true, chip: frozen };
}

/**
 * Apply a frozen chip → validated allowlisted tool payload.
 *
 * @param {string | AskLegendChip} chipOrId
 * @param {{
 *   allowedPlaceIds?: ReadonlySet<string> | readonly string[],
 *   situateIndex?: import("./situate-filter.mjs").SituateFilterIndex | null,
 * }} [ctx]
 * @returns {Record<string, unknown>}
 */
export function applyChip(chipOrId, ctx = {}) {
  const chip = typeof chipOrId === "string" ? CHIP_BY_ID.get(chipOrId) : chipOrId;
  if (!chip || typeof chip.id !== "string") {
    return { ok: false, refused: true, tool: "unknown", reason: "unknown chip" };
  }
  const parsed = parseChip(chip);
  if (!parsed.ok) return parsed;

  if (parsed.chip.tool === "filterSituateFamily") {
    return filterSituateFamily(parsed.chip.args, ctx.situateIndex, {
      allowedPlaceIds: ctx.allowedPlaceIds,
    });
  }

  return invokeAllowlistedTool(parsed.chip.tool, parsed.chip.args, {
    allowedPlaceIds: ctx.allowedPlaceIds,
  });
}
