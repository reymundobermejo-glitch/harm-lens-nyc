/**
 * Ask Legend G1 — allowlisted tool validators (pure; no UI; no LLM).
 * Fail closed on unknown tools / bad args. Never invent place ids.
 */

/** @typedef {"injury" | "fatal"} AskLegendLens */
/** @typedef {"intersection_node" | "midblock_segment"} AskLegendPlaceType */
/** @typedef {"all" | "injury_led" | "fatal_led" | "both"} AskLegendAgreementFilter */

/** @typedef {object} ToolOk
 * @property {true} ok
 * @property {string} tool
 * @property {Record<string, unknown>} args
 * @property {string} [effect]
 */

/** @typedef {object} ToolRefuse
 * @property {false} ok
 * @property {true} refused
 * @property {string} tool
 * @property {string} reason
 * @property {Record<string, unknown>} [args]
 */

/** @typedef {ToolOk | ToolRefuse} ToolResult */

export const ALLOWLISTED_TOOLS = Object.freeze([
  "setLens",
  "setMode",
  "setAgreementFilter",
  "filterByQuery",
  "filterSituateFamily",
  "clearFilters",
  "fitNyc",
  "flyToPlace",
  "selectPlace",
]);

const LENSES = new Set(["injury", "fatal"]);
const MODES = new Set(["intersection_node", "midblock_segment"]);
const AGREEMENTS = new Set(["all", "injury_led", "fatal_led", "both"]);

/**
 * @param {string} tool
 * @param {string} reason
 * @param {Record<string, unknown>} [args]
 * @returns {ToolRefuse}
 */
function refuse(tool, reason, args) {
  return { ok: false, refused: true, tool, reason, ...(args ? { args } : {}) };
}

/**
 * @param {string} tool
 * @param {Record<string, unknown>} args
 * @param {string} [effect]
 * @returns {ToolOk}
 */
function accept(tool, args, effect) {
  return { ok: true, tool, args, ...(effect ? { effect } : {}) };
}

/**
 * @param {unknown} raw
 * @returns {ToolResult}
 */
export function setLens(raw) {
  const lens = raw && typeof raw === "object" ? /** @type {{ lens?: unknown }} */ (raw).lens : raw;
  if (typeof lens !== "string" || !LENSES.has(lens)) {
    return refuse("setLens", "lens must be injury|fatal", { lens });
  }
  return accept("setLens", { lens }, "Set active harm lens");
}

/**
 * @param {unknown} raw
 * @returns {ToolResult}
 */
export function setMode(raw) {
  const mode = raw && typeof raw === "object" ? /** @type {{ mode?: unknown }} */ (raw).mode : raw;
  if (typeof mode !== "string" || !MODES.has(mode)) {
    return refuse("setMode", "mode must be intersection_node|midblock_segment", { mode });
  }
  return accept("setMode", { mode }, "Set place grain");
}

/**
 * @param {unknown} raw
 * @returns {ToolResult}
 */
export function setAgreementFilter(raw) {
  const agreementFilter = raw && typeof raw === "object"
    ? /** @type {{ agreementFilter?: unknown }} */ (raw).agreementFilter
    : raw;
  if (typeof agreementFilter !== "string" || !AGREEMENTS.has(agreementFilter)) {
    return refuse("setAgreementFilter", "agreementFilter must be all|injury_led|fatal_led|both", { agreementFilter });
  }
  return accept("setAgreementFilter", { agreementFilter }, "Set lens-agreement filter");
}

/**
 * @param {unknown} raw
 * @returns {ToolResult}
 */
export function filterByQuery(raw) {
  const query = raw && typeof raw === "object" ? /** @type {{ query?: unknown }} */ (raw).query : raw;
  if (typeof query !== "string") {
    return refuse("filterByQuery", "query must be a string", { query });
  }
  return accept("filterByQuery", { query }, "Filter by frozen label/id query");
}

/**
 * @returns {ToolResult}
 */
export function clearFilters() {
  return accept("clearFilters", {}, "Clear Find filters");
}

/**
 * @returns {ToolResult}
 */
export function fitNyc() {
  return accept("fitNyc", { frame: "nyc" }, "Fit camera to five-borough NYC frame");
}

/**
 * @param {unknown} raw
 * @param {{ allowedPlaceIds?: ReadonlySet<string> | readonly string[] }} [ctx]
 * @returns {ToolResult}
 */
export function selectPlace(raw, ctx = {}) {
  return validatePlaceTool("selectPlace", raw, ctx, "Select existing frozen place");
}

/**
 * @param {unknown} raw
 * @param {{ allowedPlaceIds?: ReadonlySet<string> | readonly string[] }} [ctx]
 * @returns {ToolResult}
 */
export function flyToPlace(raw, ctx = {}) {
  return validatePlaceTool("flyToPlace", raw, ctx, "Fly camera to existing frozen place");
}

/**
 * @param {"selectPlace" | "flyToPlace"} tool
 * @param {unknown} raw
 * @param {{ allowedPlaceIds?: ReadonlySet<string> | readonly string[] }} ctx
 * @param {string} effect
 * @returns {ToolResult}
 */
function validatePlaceTool(tool, raw, ctx, effect) {
  const placeId = raw && typeof raw === "object"
    ? /** @type {{ placeId?: unknown; id?: unknown }} */ (raw).placeId
      ?? /** @type {{ id?: unknown }} */ (raw).id
    : raw;
  if (typeof placeId !== "string" || !placeId.trim()) {
    return refuse(tool, "placeId must be a non-empty string", { placeId });
  }
  const allowed = ctx.allowedPlaceIds;
  if (allowed) {
    const set = allowed instanceof Set ? allowed : new Set(allowed);
    if (!set.has(placeId)) {
      return refuse(tool, "placeId not in frozen place universe", { placeId });
    }
  }
  return accept(tool, { placeId }, effect);
}

/**
 * Dispatch a named allowlisted tool. Unknown tool → refuse.
 *
 * @param {string} tool
 * @param {unknown} args
 * @param {{ allowedPlaceIds?: ReadonlySet<string> | readonly string[] }} [ctx]
 * @returns {ToolResult}
 */
export function invokeAllowlistedTool(tool, args, ctx = {}) {
  if (typeof tool !== "string" || !ALLOWLISTED_TOOLS.includes(tool)) {
    return refuse(tool || "unknown", "tool not allowlisted");
  }
  switch (tool) {
    case "setLens":
      return setLens(args);
    case "setMode":
      return setMode(args);
    case "setAgreementFilter":
      return setAgreementFilter(args);
    case "filterByQuery":
      return filterByQuery(args);
    case "clearFilters":
      return clearFilters();
    case "fitNyc":
      return fitNyc();
    case "selectPlace":
      return selectPlace(args, ctx);
    case "flyToPlace":
      return flyToPlace(args, ctx);
    case "filterSituateFamily":
      return refuse("filterSituateFamily", "use filterSituateFamily() with situate index — not bare invoke");
    default:
      return refuse(tool, "tool not allowlisted");
  }
}
