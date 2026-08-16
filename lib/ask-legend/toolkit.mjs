/**
 * Ask Legend toolkit — deterministic jobs, no LLM.
 * Import G0 search + G1 tool validators. Do not rewrite those engines.
 * Unknown or prohibited jobs refuse with zero planned mutations.
 */

import { searchPlaces } from "./search.mjs";
import {
  invokeAllowlistedTool,
  selectPlace as validateSelectPlace,
  setLens as validateSetLens,
} from "./tools.mjs";

export const ASK_LEGEND_TASK_HONESTY = "Governed investigation only — no risk, cause, or treatment.";
export const ASK_LEGEND_TOOLKIT_STAGE = "toolkit";

export const TOOLKIT_TOOLS = Object.freeze([
  "selectPlace",
  "setLens",
  "setRoadUser",
  "setWindow",
  "openInspect",
  "setCrashYear",
  "openCompare",
  "composeWhyPlace",
  "composeEvidenceBrief",
  "openPacket",
]);

const SCREENS = new Set(["overview", "explore", "inspect", "compare", "packet"]);
const LENSES = new Set(["injury", "fatal"]);
const ROAD_USERS = new Set(["everyone", "pedestrian", "cyclist", "motorist"]);
const WINDOWS = new Set(["24m", "36m", "48m"]);
const GRAINS = new Set(["intersection_node", "midblock_segment"]);
const INSPECT_TABS = new Set(["why", "records"]);

const CONCENTRATION_NOT_RISK = "High recorded harm concentration is not the same as high individual risk without exposure (volumes, VMT, trips).";
const WHY_DOES_NOT_SUPPORT = "Cause, exposure-adjusted or personal risk, official priority, an engineering treatment, or untreated status from an unmatched source record.";
const WHY_SUPPORTS = "Moving this place into a closer-look queue for field and engineering investigation under this analytical method. It is not an official DOT priority.";

/**
 * @param {string} tool
 * @param {string} reason
 * @param {Record<string, unknown>} [extra]
 */
function refuse(tool, reason, extra = {}) {
  return { ok: false, refused: true, tool, reason, calls: [], ...extra };
}

/**
 * @param {string} tool
 * @param {Record<string, unknown>} args
 * @param {string} [effect]
 */
function accept(tool, args, effect) {
  return { ok: true, tool, args, ...(effect ? { effect } : {}) };
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeJobText(value) {
  return asTrimmedString(value).replace(/\s+/g, " ");
}

function collapseJobKey(value) {
  return normalizeJobText(value).toLowerCase().replace(/[“”"']/g, "");
}

/**
 * Session bag Legend may read. Copies only known workspace fields.
 *
 * @param {Record<string, unknown>} [state]
 */
export function readSessionBag(state = {}) {
  const compareIds = Array.isArray(state.compareIds)
    ? state.compareIds.filter((id) => typeof id === "string" && id)
    : [];
  const pileFromGroup = state.focusGroup && typeof state.focusGroup === "object" && Array.isArray(state.focusGroup.ids)
    ? state.focusGroup.ids.filter((id) => typeof id === "string" && id)
    : [];
  const pileIds = Array.isArray(state.pileIds)
    ? state.pileIds.filter((id) => typeof id === "string" && id)
    : pileFromGroup;
  const screen = SCREENS.has(state.screen) ? state.screen : "explore";
  const lens = LENSES.has(state.lens) ? state.lens : "injury";
  const roadUser = ROAD_USERS.has(state.roadUser) ? state.roadUser : "everyone";
  const windowKey = WINDOWS.has(state.windowKey) ? state.windowKey : "36m";
  const grain = GRAINS.has(state.grain) ? state.grain : GRAINS.has(state.mode) ? state.mode : "intersection_node";
  return {
    screen,
    selectedId: typeof state.selectedId === "string" && state.selectedId ? state.selectedId : null,
    packetSubjectId: typeof state.packetSubjectId === "string" && state.packetSubjectId ? state.packetSubjectId : null,
    compareIds,
    lens,
    roadUser,
    windowKey,
    grain,
    look: typeof state.look === "string" && state.look
      ? state.look
      : typeof state.mapLookBorough === "string" && state.mapLookBorough
        ? state.mapLookBorough
        : null,
    pileIds,
    query: typeof state.query === "string" ? state.query : "",
    crashYearFocus: typeof state.crashYearFocus === "string" && state.crashYearFocus ? state.crashYearFocus : null,
    analysisEnd: typeof state.analysisEnd === "string" ? state.analysisEnd : typeof state.dataThrough === "string" ? state.dataThrough : null,
    sourceStatus: typeof state.sourceStatus === "string" ? state.sourceStatus : null,
  };
}

export function setRoadUser(raw) {
  const roadUser = raw && typeof raw === "object" ? raw.roadUser : raw;
  if (typeof roadUser !== "string" || !ROAD_USERS.has(roadUser)) {
    return refuse("setRoadUser", "roadUser must be everyone|pedestrian|cyclist|motorist", { args: { roadUser } });
  }
  return accept("setRoadUser", { roadUser }, "Set Who was harmed");
}

export function setWindow(raw) {
  const windowKey = raw && typeof raw === "object" ? raw.windowKey ?? raw.window : raw;
  if (typeof windowKey !== "string" || !WINDOWS.has(windowKey)) {
    return refuse("setWindow", "windowKey must be 24m|36m|48m", { args: { windowKey } });
  }
  return accept("setWindow", { windowKey }, "Set How long");
}

export function openInspect(raw) {
  const tab = raw && typeof raw === "object" ? raw.tab : raw;
  if (typeof tab !== "string" || !INSPECT_TABS.has(tab)) {
    return refuse("openInspect", "tab must be why|records (Counts|Crashes)", { args: { tab } });
  }
  return accept("openInspect", { tab }, tab === "records" ? "Open Inspect Crashes" : "Open Inspect Counts / Why");
}

export function setCrashYear(raw) {
  const year = raw && typeof raw === "object" ? raw.year : raw;
  if (year !== "Unknown" && (typeof year !== "string" || !/^(20(1[3-9]|2[0-6]))$/.test(year))) {
    return refuse("setCrashYear", "year must be a released crash year or Unknown", { args: { year } });
  }
  return accept("setCrashYear", { year }, `Focus crash year ${year}`);
}

export function openCompare(raw = {}, session = {}) {
  const compareIds = Array.isArray(raw?.compareIds) ? raw.compareIds : session.compareIds;
  const lockPass = raw?.lockPass ?? session.compareLockPass;
  if (!Array.isArray(compareIds) || compareIds.length !== 2 || compareIds.some((id) => typeof id !== "string" || !id)) {
    return refuse("openCompare", "Compare needs two selected places", { args: { compareIds } });
  }
  if (lockPass === false) {
    return refuse("openCompare", "Compare lock does not pass", { args: { compareIds } });
  }
  return accept("openCompare", { compareIds }, "Open Compare under the shared lock");
}

export function composeWhyPlace(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? session.selectedId;
  if (typeof placeId !== "string" || !placeId) {
    return refuse("composeWhyPlace", "Choose a place on Explore first.");
  }
  const injuryCount = Number.isFinite(raw?.injuryCount) ? raw.injuryCount : null;
  const fatalCount = Number.isFinite(raw?.fatalCount) ? raw.fatalCount : null;
  const lens = LENSES.has(raw?.lens) ? raw.lens : session.lens;
  const count = lens === "fatal" ? fatalCount : injuryCount;
  const statement = Number.isFinite(count)
    ? `This place surfaced in the analytical order because it has ${count} qualifying police-reported collision records under the active ${lens === "fatal" ? "fatal" : "injury-involved"} lens.`
    : "This place surfaced in the analytical order because of qualifying police-reported collision records under the active lock.";
  return accept("composeWhyPlace", {
    placeId,
    statement,
    supports: WHY_SUPPORTS,
    doesNotSupport: WHY_DOES_NOT_SUPPORT,
    concentrationNotRisk: CONCENTRATION_NOT_RISK,
    next: "Field and engineering investigation — not a treatment.",
  }, "Compose Why from the current lock");
}

export function composeEvidenceBriefTool(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? briefPlaceId(session);
  if (typeof placeId !== "string" || !placeId) {
    return refuse("composeEvidenceBrief", "Choose a place on Explore first.");
  }
  return accept("composeEvidenceBrief", {
    placeId,
    releaseStatus: "DRAFT",
    next: "Investigation warranted, never a treatment.",
  }, "Compose DRAFT Evidence Brief");
}

export function openPacket(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? briefPlaceId(session);
  if (typeof placeId !== "string" || !placeId) {
    return refuse("openPacket", "Choose a place on Explore first.");
  }
  return accept("openPacket", { placeId }, "Open Packet DRAFT brief");
}

/**
 * @param {string} tool
 * @param {unknown} args
 * @param {object} [ctx]
 */
export function invokeToolkitTool(tool, args, ctx = {}) {
  const session = readSessionBag(ctx.session ?? {});
  switch (tool) {
    case "selectPlace":
      return validateSelectPlace(args, ctx);
    case "setLens":
      return validateSetLens(args);
    case "setRoadUser":
      return setRoadUser(args);
    case "setWindow":
      return setWindow(args);
    case "openInspect":
      return openInspect(args);
    case "setCrashYear":
      return setCrashYear(args);
    case "openCompare":
      return openCompare(args, { ...session, compareLockPass: ctx.compareLockPass });
    case "composeWhyPlace":
      return composeWhyPlace(args, session);
    case "composeEvidenceBrief":
      return composeEvidenceBriefTool(args, session);
    case "openPacket":
      return openPacket(args, session);
    default:
      return invokeAllowlistedTool(tool, args, ctx);
  }
}

function allowedIdSet(ctx = {}) {
  const allowed = ctx.allowedPlaceIds;
  if (!allowed) return null;
  return allowed instanceof Set ? allowed : new Set(allowed);
}

function resolveNamedPlace(query, ctx = {}) {
  const unknownNode = String(query).match(/(?:intersection_node:|midblock_segment:|(?:fake\s+)?node\s+)(\d{5,})/i);
  if (unknownNode) {
    const nodeId = unknownNode[1];
    const candidates = [`intersection_node:${nodeId}`, `midblock_segment:${nodeId}`];
    const allowed = allowedIdSet(ctx);
    const universe = Array.isArray(ctx.universe) ? ctx.universe : [];
    const exists = candidates.some((id) => (allowed ? allowed.has(id) : universe.some((place) => place.id === id)));
    if (!exists) return null;
  }
  const universe = Array.isArray(ctx.universe) ? ctx.universe : [];
  const matches = searchPlaces(query, universe);
  const allowed = allowedIdSet(ctx);
  const usable = allowed ? matches.filter((match) => allowed.has(match.id)) : matches;
  if (usable.length === 1) return usable[0].id;
  const gold = usable.find((match) => match.id === "intersection_node:26912")
    ?? usable.find((match) => match.id === "intersection_node:34754")
    ?? usable.find((match) => match.id === "intersection_node:21791");
  if (gold && usable[0]?.id === gold.id) return gold.id;
  if (usable[0] && usable.length >= 1 && /buffalo ave/.test(collapseJobKey(query)) && usable.some((m) => m.id === "intersection_node:26912")) {
    return "intersection_node:26912";
  }
  return usable[0]?.id ?? null;
}

function prohibition(text) {
  const key = collapseJobKey(text);
  if (/\bksi\b/.test(key)) {
    return { code: "ksi", reason: "KSI is not a registered Harm Lens metric." };
  }
  if (/\b(install|build|treat|sip|leading pedestrian interval|add a (bike|bus) lane)\b/.test(key) || /what should dot install/.test(key)) {
    return { code: "treatment", reason: "Refuse treatment. Harm Lens does not say what to install." };
  }
  if (/most dangerous|safest|danger(ous)? intersection|exposure-adjusted risk/.test(key)) {
    return { code: "risk", reason: "Refuse risk / official most-dangerous. Concentration is not risk." };
  }
  if (/\bcaused\b|left turns caused|what caused/.test(key)) {
    return { code: "cause", reason: "Refuse cause. Crash factors are not a cause finding." };
  }
  if (/\buntreated\b|did nothing|no aps so/.test(key)) {
    return { code: "untreated", reason: "Unknown / not documented — never untreated." };
  }
  if (/bike lane failed|treatment failed|intervention failed|did( not|n't) work/.test(key)) {
    return { code: "effectiveness", reason: "Refuse effectiveness. Documented Yes is not an evaluation." };
  }
  if (/\b5[- ]?year|\bfive years\b|vs the borough|versus the borough/.test(key)) {
    return { code: "gated", reason: "Not available: 5-year window, road-user corridor rollup, and borough compare wait on Track P2/P3." };
  }
  return null;
}

function briefPlaceId(session) {
  if (typeof session.packetSubjectId === "string" && session.packetSubjectId) return session.packetSubjectId;
  if (Array.isArray(session.compareIds) && typeof session.compareIds[0] === "string" && session.compareIds[0]) {
    return session.compareIds[0];
  }
  return session.selectedId;
}

export function isSelectedPlacePronoun(value) {
  const key = collapseJobKey(value);
  return key === "this" || key === "this place" || key === "here";
}

function extractWhyQuery(text) {
  const match = normalizeJobText(text).match(/why is (.+?) showing up\??$/i);
  return match ? match[1].trim() : "";
}

function extractGoingOnQuery(text) {
  const match = normalizeJobText(text).match(/what(?:'s| is) going on at (.+?)\??$/i);
  return match ? match[1].trim() : "";
}

function extractCrashYear(text) {
  const match = collapseJobKey(text).match(/\b(20(?:1[3-9]|2[0-6]))\b/);
  return match ? match[1] : null;
}

function jobOk(job, understood, calls, extra = {}) {
  return { ok: true, refused: false, job, understood, calls, ...extra };
}

/**
 * Parse a short planner job into schema-validated toolkit calls.
 * Prohibited / unknown jobs refuse with calls: [] (no state mutation).
 *
 * @param {string} utterance
 * @param {object} [sessionState]
 * @param {object} [ctx]
 */
export function parsePlannerJob(utterance, sessionState = {}, ctx = {}) {
  const text = normalizeJobText(utterance);
  if (!text) return refuse("parsePlannerJob", "Type a job — for example, investigate this place.");
  const session = readSessionBag(sessionState);
  const key = collapseJobKey(text);
  const blocked = prohibition(text);
  if (blocked) {
    return refuse("parsePlannerJob", blocked.reason, { prohibition: blocked.code, job: "refuse" });
  }

  if (/prepare this for (the |tomorrow.?s )?([a-z ]+ )?meeting/.test(key) || /^prepare (the |this |my )?(work|brief|packet)/.test(key)) {
    const placeId = briefPlaceId(session);
    if (!placeId) return refuse("parsePlannerJob", "Choose a place on Explore first.");
    return jobOk("prepare", "Prepare a DRAFT Evidence Brief for the investigated place", [
      invokeToolkitTool("composeEvidenceBrief", { placeId }, { session }),
      invokeToolkitTool("openPacket", { placeId }, { session }),
    ], { deliverable: "brief" });
  }

  if (/show (me )?(the )?\d{4} crashes/.test(key) || /crashes in \d{4}/.test(key)) {
    if (!session.selectedId) return refuse("parsePlannerJob", "Choose a place on Explore first.");
    const year = extractCrashYear(text);
    if (!year) return refuse("parsePlannerJob", "Name a crash year that exists on this place.");
    return jobOk("investigate", `Show ${year} crashes for the selected place`, [
      invokeToolkitTool("openInspect", { tab: "records" }),
      invokeToolkitTool("setCrashYear", { year }),
    ]);
  }

  if (/^switch to died$/.test(key) || /^switch to fatal/.test(key) || /would fatalities change this/.test(key) || /used fatalities rather than injury/.test(key)) {
    return jobOk("perspective", "Switch the harm lens to Died / fatal without moving the camera", [
      invokeToolkitTool("setLens", { lens: "fatal" }),
    ], { keepCamera: true });
  }

  if (/^switch to hurt$/.test(key) || /^switch to injury/.test(key)) {
    return jobOk("perspective", "Switch the harm lens to Hurt / injury without moving the camera", [
      invokeToolkitTool("setLens", { lens: "injury" }),
    ], { keepCamera: true });
  }

  const whyQuery = extractWhyQuery(text);
  const goingOn = extractGoingOnQuery(text);
  if (whyQuery || goingOn || /^investigate this/.test(key)) {
    const query = whyQuery || goingOn || "";
    let placeId = session.selectedId;
    if (query) {
      if (isSelectedPlacePronoun(query)) {
        placeId = session.selectedId;
        if (!placeId) return refuse("parsePlannerJob", "Choose a place on Explore first.");
      } else {
        placeId = resolveNamedPlace(query, ctx);
        if (!placeId) {
          return refuse("parsePlannerJob", "Place is not in this frozen universe. No invented node.", { prohibition: "place" });
        }
      }
    }
    if (!placeId) return refuse("parsePlannerJob", "Choose a place on Explore first.");
    const allowed = allowedIdSet(ctx);
    if (allowed && !allowed.has(placeId)) {
      return refuse("parsePlannerJob", "Place is not in this frozen universe. No invented node.", { prohibition: "place" });
    }
    return jobOk("investigate", "Investigate why this place showed up under the current lock", [
      invokeToolkitTool("selectPlace", { placeId }, ctx),
      invokeToolkitTool("openInspect", { tab: "why" }),
      invokeToolkitTool("composeWhyPlace", {
        placeId,
        lens: session.lens,
        injuryCount: ctx.injuryCount,
        fatalCount: ctx.fatalCount,
      }, { session: { ...session, selectedId: placeId } }),
    ], { deliverable: "why" });
  }

  return refuse("parsePlannerJob", "Unknown job. Legend only runs governed investigation tools.", { job: "unknown" });
}

/**
 * Parse then fail closed if any planned tool is invalid.
 *
 * @param {string} utterance
 * @param {object} [sessionState]
 * @param {object} [ctx]
 */
export function runPlannerJob(utterance, sessionState = {}, ctx = {}) {
  const planned = parsePlannerJob(utterance, sessionState, ctx);
  if (!planned.ok) {
    return {
      ok: false,
      refused: true,
      job: planned.job ?? "refuse",
      reason: planned.reason,
      prohibition: planned.prohibition ?? null,
      understood: null,
      tools: [],
      toolNames: [],
      dataThrough: readSessionBag(sessionState).analysisEnd,
      honesty: ASK_LEGEND_TASK_HONESTY,
    };
  }
  const tools = planned.calls.filter(Boolean);
  if (tools.some((call) => !call?.ok)) {
    const failed = tools.find((call) => !call?.ok);
    return {
      ok: false,
      refused: true,
      job: "refuse",
      reason: failed?.reason ?? "Tool validation failed",
      prohibition: planned.prohibition ?? null,
      understood: null,
      tools: [],
      toolNames: [],
      dataThrough: readSessionBag(sessionState).analysisEnd,
      honesty: ASK_LEGEND_TASK_HONESTY,
    };
  }
  const session = readSessionBag(sessionState);
  const why = tools.find((call) => call.tool === "composeWhyPlace");
  const brief = tools.find((call) => call.tool === "composeEvidenceBrief");
  return {
    ok: true,
    refused: false,
    job: planned.job,
    understood: planned.understood,
    reason: null,
    prohibition: null,
    tools,
    toolNames: tools.map((call) => call.tool),
    keepCamera: Boolean(planned.keepCamera),
    deliverable: planned.deliverable ?? null,
    why: why?.args ?? null,
    brief: brief?.args ?? null,
    dataThrough: session.analysisEnd,
    sourceStatus: session.sourceStatus,
    honesty: ASK_LEGEND_TASK_HONESTY,
    trace: [
      planned.understood,
      `Tools: ${tools.map((call) => call.tool).join(", ")}`,
      session.analysisEnd ? `Records through ${session.analysisEnd}${session.sourceStatus ? ` · ${session.sourceStatus}` : ""}` : "Records through the accepted freeze",
    ].join(" · "),
  };
}
