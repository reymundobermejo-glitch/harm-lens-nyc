/**
 * Ask Legend job coach v1 — start / confirm / next + drive existing hands.
 * No LLM. Does not rebuild v1 Why / Prepare / refuse or v1.1 closer-look parsers.
 */

import {
  ASK_LEGEND_TASK_HONESTY,
  invokeToolkitTool,
  readSessionBag,
} from "./toolkit.mjs";
import {
  parsePlannerJob as parsePlannerJobV11,
  runPlannerJob as runPlannerJobV11,
} from "./toolkit-v11.mjs";
import { invokeAllowlistedTool } from "./tools.mjs";

export const ASK_LEGEND_JOB_COACH = "job-coach-v1";
export const ASK_LEGEND_JOB_COACH_HONESTY = "Legend moves this workspace — frozen evidence only; not official priority.";
export const LIST_ORDER_NOT_DANGEROUS = "This is list order under the lock, not most-dangerous.";

export const JOB_COACH_TOOLS = Object.freeze([
  "startCoachJob",
  "selectTopInBorough",
  "selectPlace",
  "setRoadUser",
  "setWindow",
  "setLens",
  "setMode",
  "openInspect",
  "openCompare",
  "openPacket",
  "walkThroughPlace",
]);

const ROAD_USERS = new Set(["everyone", "pedestrian", "cyclist", "motorist"]);
const WINDOWS = new Set(["24m", "36m", "48m"]);
const LENSES = new Set(["injury", "fatal"]);
const GRAINS = new Set(["intersection_node", "midblock_segment"]);
const BOROUGHS = Object.freeze(["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]);

const DEFAULT_LOCK = Object.freeze({
  roadUser: "everyone",
  windowKey: "36m",
  lens: "injury",
  grain: "intersection_node",
});

const WHO_WORDS = Object.freeze({
  everyone: "Everyone",
  pedestrian: "Walking",
  cyclist: "Bikes",
  motorist: "Cars",
});

function collapseJobKey(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase().replace(/[\u2018\u2019\u201c\u201d“”"']/g, "");
}

function refuse(reason, extra = {}) {
  return {
    ok: false,
    refused: true,
    tool: "parsePlannerJob",
    reason,
    calls: [],
    job: extra.job ?? "refuse",
    prohibition: extra.prohibition ?? null,
  };
}

function jobOk(job, understood, calls, extra = {}) {
  return { ok: true, refused: false, job, understood, calls, ...extra };
}

export function lockPhrase(lock) {
  const who = WHO_WORDS[lock.roadUser] ?? "Everyone";
  const lens = lock.lens === "fatal" ? "Died" : "Hurt";
  const grain = lock.grain === "midblock_segment" ? "midblock" : "intersections";
  return `${who} / ${lock.windowKey} / ${lens} / ${grain}`;
}

/**
 * Raw session missing any lock field → product default, and say so.
 *
 * @param {Record<string, unknown>} [state]
 */
export function resolveCoachLock(state = {}) {
  const hasWho = ROAD_USERS.has(state.roadUser);
  const hasWindow = WINDOWS.has(state.windowKey);
  const hasLens = LENSES.has(state.lens);
  const hasGrain = GRAINS.has(state.grain) || GRAINS.has(state.mode);
  const unset = !hasWho || !hasWindow || !hasLens || !hasGrain;
  if (unset) {
    return { unset: true, ...DEFAULT_LOCK };
  }
  const session = readSessionBag(state);
  return {
    unset: false,
    roadUser: session.roadUser,
    windowKey: session.windowKey,
    lens: session.lens,
    grain: session.grain,
  };
}

/**
 * Deterministic NYC borough from WGS84 lon/lat using water-boundary half-planes.
 * Fail closed (null) without coordinates. Not a cadastral product.
 *
 * @param {number} lon
 * @param {number} lat
 * @returns {"Manhattan"|"Brooklyn"|"Queens"|"Bronx"|"Staten Island"|null}
 */
export function boroughOfLonLat(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon <= -74.05) return "Staten Island";
  if (lon <= -74.012 && lat <= 40.648) return "Staten Island";
  if (lat >= 40.915) return "Bronx";
  if (lat >= 40.88 && lon >= -73.91) return "Bronx";
  if (lat >= 40.80 && lon >= -73.933) return "Bronx";
  if (lon >= -74.04 && lon <= -73.91 && lat >= 40.698 && lat <= 40.882) {
    if (lon <= manhattanEastLon(lat)) return "Manhattan";
  }
  if (lat <= 40.615 && lon >= -73.94) return "Queens";
  if (lon >= -73.836) return "Queens";
  if (lat >= 40.725 && lon >= -73.94) return "Queens";
  if (lat <= 40.739) {
    if (lon <= -73.88) return "Brooklyn";
    return "Queens";
  }
  if (lon > -73.94) return "Queens";
  return "Brooklyn";
}

function manhattanEastLon(lat) {
  if (lat < 40.70) return -74.01;
  if (lat < 40.72) return -73.975;
  if (lat < 40.74) return -73.968;
  if (lat < 40.76) return -73.955;
  if (lat < 40.78) return -73.944;
  if (lat < 40.80) return -73.933;
  if (lat < 40.83) return -73.928;
  if (lat < 40.86) return -73.922;
  return -73.91;
}

export function normalizeBoroughName(raw) {
  const key = collapseJobKey(raw).replace(/^the /, "");
  if (key === "manhattan") return "Manhattan";
  if (key === "brooklyn") return "Brooklyn";
  if (key === "queens") return "Queens";
  if (key === "bronx") return "Bronx";
  if (key === "staten island") return "Staten Island";
  return null;
}

function isBaselineLock(lock) {
  return lock.roadUser === "everyone" && lock.windowKey === "36m";
}

function rankedList(ctx, lock) {
  const rows = Array.isArray(ctx.rankedPlaces) ? ctx.rankedPlaces : [];
  const allowed = ctx.allowedPlaceIds
    ? (ctx.allowedPlaceIds instanceof Set ? ctx.allowedPlaceIds : new Set(ctx.allowedPlaceIds))
    : null;
  const usable = rows.filter((place) => {
    if (!place || typeof place.id !== "string" || !place.id) return false;
    if (place.placeType && place.placeType !== lock.grain) return false;
    if (allowed && !allowed.has(place.id)) return false;
    return true;
  });
  const baseline = isBaselineLock(lock);
  return [...usable].sort((left, right) => {
    if (baseline) {
      const rankA = lock.lens === "fatal" ? Number(left.fatalRank) : Number(left.injuryRank);
      const rankB = lock.lens === "fatal" ? Number(right.fatalRank) : Number(right.injuryRank);
      if (Number.isFinite(rankA) && Number.isFinite(rankB) && rankA !== rankB) return rankA - rankB;
    }
    const countA = Number(left.count);
    const countB = Number(right.count);
    if (Number.isFinite(countA) && Number.isFinite(countB) && countA !== countB) return countB - countA;
    const idA = Number(left.placeId);
    const idB = Number(right.placeId);
    if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) return idA - idB;
    return String(left.id).localeCompare(String(right.id));
  });
}

function pickTop(ctx, lock, borough = null) {
  const ordered = rankedList(ctx, lock);
  for (const place of ordered) {
    if (borough) {
      const assigned = typeof place.borough === "string" && place.borough
        ? normalizeBoroughName(place.borough)
        : boroughOfLonLat(Number(place.longitude), Number(place.latitude));
      if (assigned !== borough) continue;
    }
    return place;
  }
  return null;
}

function placeCounts(place, lock, ctx) {
  if (!place) return { injuryCount: ctx.injuryCount, fatalCount: ctx.fatalCount };
  const injuryCount = Number.isFinite(place.injuryCount) ? place.injuryCount : ctx.injuryCount;
  const fatalCount = Number.isFinite(place.fatalCount) ? place.fatalCount : ctx.fatalCount;
  if (lock.lens === "fatal") return { injuryCount, fatalCount };
  return { injuryCount, fatalCount };
}

export function startCoachJob(raw = {}) {
  const phrase = typeof raw.lockPhrase === "string" ? raw.lockPhrase.trim() : "";
  if (!phrase) {
    return { ok: false, refused: true, tool: "startCoachJob", reason: "Lock phrase required.", calls: [] };
  }
  const lockUnset = Boolean(raw.lockUnset);
  const note = lockUnset ? `Lock was unset. Using ${phrase}.` : `Lock: ${phrase}.`;
  return {
    ok: true,
    tool: "startCoachJob",
    args: {
      lockUnset,
      lockPhrase: phrase,
      roadUser: raw.roadUser,
      windowKey: raw.windowKey,
      lens: raw.lens,
      grain: raw.grain,
      note,
      honesty: ASK_LEGEND_JOB_COACH_HONESTY,
    },
    effect: "Confirm the method lock in human words",
  };
}

export function selectTopInBorough(raw = {}, ctx = {}, lock = DEFAULT_LOCK) {
  const borough = normalizeBoroughName(raw.borough ?? raw);
  if (!borough || !BOROUGHS.includes(borough)) {
    return {
      ok: false,
      refused: true,
      tool: "selectTopInBorough",
      reason: "borough must be Manhattan|Brooklyn|Queens|Bronx|Staten Island",
      calls: [],
      args: { borough: raw.borough },
    };
  }
  if (!Array.isArray(ctx.rankedPlaces)) {
    return {
      ok: false,
      refused: true,
      tool: "selectTopInBorough",
      reason: "No ranked list under the current lock. No invented place.",
      calls: [],
      args: { borough },
    };
  }
  const place = pickTop(ctx, lock, borough);
  if (!place) {
    return {
      ok: false,
      refused: true,
      tool: "selectTopInBorough",
      reason: `No ${borough} place under the current lock. No invented place.`,
      calls: [],
      args: { borough },
    };
  }
  return {
    ok: true,
    tool: "selectTopInBorough",
    args: {
      borough,
      placeId: place.id,
      listRank: 1,
      prohibition: LIST_ORDER_NOT_DANGEROUS,
    },
    effect: `Select analytical #1 in ${borough} under the current lock`,
  };
}

function lockHands(lock) {
  if (!lock.unset) return [];
  return [
    invokeToolkitTool("setRoadUser", { roadUser: lock.roadUser }),
    invokeToolkitTool("setWindow", { windowKey: lock.windowKey }),
    invokeAllowlistedTool("setLens", { lens: lock.lens }),
    invokeAllowlistedTool("setMode", { mode: lock.grain }),
  ];
}

function coachStartJob(sessionState, ctx) {
  const lock = resolveCoachLock(sessionState);
  const phrase = lockPhrase(lock);
  if (!Array.isArray(ctx.rankedPlaces)) {
    return refuse("No ranked list under the current lock. No invented place.");
  }
  const top = pickTop(ctx, lock);
  if (!top) {
    return refuse("No place under the current lock. No invented place.");
  }
  const counts = placeCounts(top, lock, ctx);
  const session = { ...readSessionBag(sessionState), selectedId: top.id, lens: lock.lens };
  const nextScreen = "Inspect Why";
  const stepCopy = lock.unset
    ? `Lock was unset. Using ${phrase}. Step done: selected analytical #1 and opened Why. ${LIST_ORDER_NOT_DANGEROUS} Next screen: ${nextScreen}.`
    : `Lock: ${phrase}. Step done: selected analytical #1 and opened Why. ${LIST_ORDER_NOT_DANGEROUS} Next screen: ${nextScreen}.`;
  return jobOk(
    "coach",
    `Start under ${phrase}: select analytical #1 and open Why`,
    [
      startCoachJob({ ...lock, lockPhrase: phrase }),
      ...lockHands(lock),
      invokeToolkitTool("selectPlace", { placeId: top.id }, ctx),
      invokeToolkitTool("openInspect", { tab: "why" }),
      invokeToolkitTool("composeWhyPlace", {
        placeId: top.id,
        lens: lock.lens,
        injuryCount: counts.injuryCount,
        fatalCount: counts.fatalCount,
      }, { session }),
    ],
    {
      deliverable: "coach",
      nextScreen,
      stepCopy,
      coachCopy: stepCopy,
      keepCamera: false,
    },
  );
}

function coachBoroughCompareJob(sessionState, ctx) {
  const lock = resolveCoachLock(sessionState);
  const phrase = lockPhrase(lock);
  const queens = selectTopInBorough({ borough: "Queens" }, ctx, lock);
  const brooklyn = selectTopInBorough({ borough: "Brooklyn" }, ctx, lock);
  if (!queens.ok || !brooklyn.ok) {
    return refuse(queens.ok ? brooklyn.reason : queens.reason);
  }
  if (queens.args.placeId === brooklyn.args.placeId) {
    return refuse("Queens and Brooklyn #1 resolved to the same place. No invented pair.");
  }
  const nextScreen = "Compare";
  const stepCopy = [
    lock.unset ? `Lock was unset. Using ${phrase}.` : `Lock: ${phrase}.`,
    `Step done: Queens list #1 and Brooklyn list #1.`,
    LIST_ORDER_NOT_DANGEROUS,
    `Next screen: ${nextScreen}.`,
  ].join(" ");
  return jobOk(
    "coach",
    `Compare Queens list #1 with Brooklyn list #1 under ${phrase}`,
    [
      startCoachJob({ ...lock, lockPhrase: phrase }),
      ...lockHands(lock),
      queens,
      brooklyn,
      invokeToolkitTool("selectPlace", { placeId: queens.args.placeId }, ctx),
      invokeToolkitTool("openCompare", { compareIds: [queens.args.placeId, brooklyn.args.placeId] }, {
        session: readSessionBag(sessionState),
        compareLockPass: true,
      }),
    ],
    {
      deliverable: "coach",
      nextScreen,
      stepCopy,
      coachCopy: stepCopy,
      keepCamera: false,
    },
  );
}

/**
 * Job-coach utterances only. Returns null so v1.1 / v1 can own other jobs.
 *
 * @param {string} utterance
 * @param {object} [sessionState]
 * @param {object} [ctx]
 */
export function parseCoachJob(utterance, sessionState = {}, ctx = {}) {
  const key = collapseJobKey(utterance);
  if (!key) return null;
  if (/^i don'?t know where to start\??$/.test(key) || /^where do i start\??$/.test(key) || /^start me$/.test(key)) {
    return coachStartJob(sessionState, ctx);
  }
  if (
    /compare (the )?queens (location|place) with the most collisions with brooklyn/.test(key)
    || /compare queens'? top collisions with brooklyn/.test(key)
  ) {
    return coachBoroughCompareJob(sessionState, ctx);
  }
  return null;
}

function nextScreenFor(result) {
  if (result.nextScreen) return result.nextScreen;
  const names = result.toolNames ?? [];
  const tools = result.tools ?? [];
  if (names.includes("openPacket") || names.includes("composeEvidenceBrief")) return "Packet";
  if (names.includes("openCompare")) return "Compare";
  if (names.includes("walkThroughPlace")) return "Inspect";
  if (names.includes("setCrashYear") || names.includes("observedHours") || tools.some((call) => call.tool === "openInspect" && call.args?.tab === "records")) {
    return "Inspect Crashes";
  }
  if (names.includes("openInspect") || names.includes("composeWhyPlace") || names.includes("challengeCase") || names.includes("listMissingEvidence")) {
    return "Inspect Why";
  }
  if (result.keepCamera) return "Explore";
  return "Explore";
}

function finishCoach(planned, sessionState) {
  const session = readSessionBag(sessionState);
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
      dataThrough: session.analysisEnd,
      honesty: ASK_LEGEND_TASK_HONESTY,
    };
  }
  const tools = (planned.calls ?? []).filter(Boolean);
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
      dataThrough: session.analysisEnd,
      honesty: ASK_LEGEND_TASK_HONESTY,
    };
  }
  const why = tools.find((call) => call.tool === "composeWhyPlace");
  const nextScreen = planned.nextScreen ?? "Explore";
  const stepCopy = planned.stepCopy ?? planned.coachCopy ?? null;
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
    coachCopy: stepCopy,
    stepCopy,
    nextScreen,
    dataThrough: session.analysisEnd,
    sourceStatus: session.sourceStatus,
    honesty: ASK_LEGEND_TASK_HONESTY,
    trace: [
      planned.understood,
      `Tools: ${tools.map((call) => call.tool).join(", ")}`,
      session.analysisEnd ? `Records through ${session.analysisEnd}${session.sourceStatus ? ` · ${session.sourceStatus}` : ""}` : "Records through the accepted freeze",
      `Next: ${nextScreen}`,
      stepCopy,
    ].filter(Boolean).join(" · "),
  };
}

export function parsePlannerJob(utterance, sessionState = {}, ctx = {}) {
  return parseCoachJob(utterance, sessionState, ctx) ?? parsePlannerJobV11(utterance, sessionState, ctx);
}

export function runPlannerJob(utterance, sessionState = {}, ctx = {}) {
  const coach = parseCoachJob(utterance, sessionState, ctx);
  if (coach) return finishCoach(coach, sessionState);
  const result = runPlannerJobV11(utterance, sessionState, ctx);
  if (!result.ok) return result;
  const nextScreen = nextScreenFor(result);
  const stepCopy = `Step done: ${result.understood}. Next screen: ${nextScreen}.`;
  return {
    ...result,
    nextScreen,
    stepCopy,
    trace: `${result.trace} · Next: ${nextScreen}`,
  };
}
