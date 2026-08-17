/**
 * Ask Legend job coach v1.2 — clickable offer hands + utterance Who/borough lock.
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

export const ASK_LEGEND_JOB_COACH = "job-coach-v1.2";
export const ASK_LEGEND_JOB_COACH_HONESTY = "Legend moves this workspace — frozen evidence only; not official priority.";
export const LIST_ORDER_NOT_DANGEROUS = "This is list order under the lock, not most-dangerous.";
export const ONE_INTERSECTION_NOT_AREA = "This is one intersection under the lock — list order, not an area or hotspot, not most-dangerous.";
export const DEFAULT_COMPARE_COPY = "This run is Queens vs Brooklyn list #1, not any two boroughs.";
export const COACH_OFFER_COPY = "Choose Start, Compare two boroughs, or Investigate this. Rank #1 is list order under the lock, not most-dangerous.";
export const COACH_OFFER_ACTIONS = Object.freeze([
  { id: "start", label: "Start", utterance: "Start" },
  { id: "compare", label: "Compare two boroughs", utterance: "Compare two boroughs" },
  { id: "investigate", label: "Investigate this", utterance: "Investigate this" },
]);

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

export function namedWhoInUtterance(raw) {
  const key = collapseJobKey(raw);
  if (/\b(walking|pedestrians?)\b/.test(key)) return "pedestrian";
  if (/\b(bikes?|biking|cyclists?)\b/.test(key)) return "cyclist";
  if (/\b(cars?|motorists?|driving)\b/.test(key)) return "motorist";
  if (/\beveryone\b/.test(key)) return "everyone";
  return null;
}

export function namedBoroughsInUtterance(raw) {
  const key = collapseJobKey(raw).replace(/\b(manhattan|brooklyn|bronx|staten island)s\b/g, "$1");
  const patterns = [
    ["staten island", "Staten Island"],
    ["manhattan", "Manhattan"],
    ["brooklyn", "Brooklyn"],
    ["queens", "Queens"],
    ["the bronx", "Bronx"],
    ["bronx", "Bronx"],
  ];
  const hits = [];
  for (const [needle, name] of patterns) {
    const match = new RegExp(`\\b${needle}\\b`).exec(key);
    if (match && !hits.some((hit) => hit.name === name)) hits.push({ idx: match.index, name });
  }
  hits.sort((left, right) => left.idx - right.idx);
  return hits.map((hit) => hit.name);
}

function resolveUtteranceLock(state = {}, raw = "") {
  const base = resolveCoachLock(state);
  const who = namedWhoInUtterance(raw);
  const boroughs = namedBoroughsInUtterance(raw);
  if (!who) return { ...base, namedWho: false, namedBoroughs: boroughs };
  return {
    ...base,
    roadUser: who,
    namedWho: true,
    namedBoroughs: boroughs,
  };
}

function isBaselineLock(lock) {
  return lock.roadUser === "everyone" && lock.windowKey === "36m";
}

function coachMustDeferToRefuse(key) {
  if (/\bksi\b/.test(key)) return true;
  if (/\b(install|build|treat|sip|leading pedestrian interval|add a (bike|bus) lane)\b/.test(key) || /what should dot install/.test(key)) return true;
  if (/most dangerous|safest|danger(ous)? intersection|exposure-adjusted risk/.test(key)) return true;
  if (/\bcaused\b|left turns caused|what caused/.test(key)) return true;
  if (/\buntreated\b|did nothing|no aps so/.test(key)) return true;
  if (/bike lane failed|treatment failed|intervention failed|did( not|n't) work/.test(key)) return true;
  if (/\b5[- ]?year|\bfive years\b|vs the borough|versus the borough/.test(key)) return true;
  return false;
}

function isBoroughCompareUtterance(key) {
  if (/compare two boroughs/.test(key)) return true;
  if (/compare (the )?queens (location|place) with the most collisions with brooklyn/.test(key)) return true;
  if (/compare queens'? top collisions with brooklyn/.test(key)) return true;
  const boroughs = namedBoroughsInUtterance(key);
  return /\bcompare\b/.test(key) && boroughs.length >= 2;
}

function isStartUtterance(key) {
  if (isBoroughCompareUtterance(key) || coachMustDeferToRefuse(key)) return false;
  if (/^(please )?start( please)?\??$/.test(key)) return true;
  if (/^i don'?t know where to start\??$/.test(key)) return true;
  if (/^where do i start\??$/.test(key) || /^start me$/.test(key)) return true;
  if (/harm.{0,24}concentrated/.test(key)) return true;
  if (/most collisions/.test(key)) return true;
  return false;
}

function isInvestigateThisUtterance(key) {
  return /^investigate this\b/.test(key);
}

function isUnknownPlannerJob(planned) {
  return Boolean(planned) && planned.ok === false && planned.job === "unknown";
}

function coachOfferJob() {
  return jobOk(
    "offer",
    "Start / Compare two boroughs / Investigate this",
    [],
    {
      deliverable: "coach",
      nextScreen: "Explore",
      stepCopy: COACH_OFFER_COPY,
      coachCopy: COACH_OFFER_COPY,
      offerActions: COACH_OFFER_ACTIONS,
      keepCamera: true,
    },
  );
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
    const countA = sortCount(left, lock);
    const countB = sortCount(right, lock);
    if (Number.isFinite(countA) && Number.isFinite(countB) && countA !== countB) return countB - countA;
    const idA = Number(left.placeId);
    const idB = Number(right.placeId);
    if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) return idA - idB;
    return String(left.id).localeCompare(String(right.id));
  });
}

function sortCount(place, lock) {
  const whoCount = place?.countsByWho?.[lock.roadUser];
  if (Number.isFinite(whoCount)) return Number(whoCount);
  return Number(place.count);
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
  const who = lock.roadUser;
  const injuryFromWho = place.injuryByWho?.[who];
  const fatalFromWho = place.fatalByWho?.[who];
  const whoCount = place.countsByWho?.[who];
  const injuryCount = Number.isFinite(injuryFromWho)
    ? injuryFromWho
    : (lock.lens === "injury" && Number.isFinite(whoCount) ? whoCount : (Number.isFinite(place.injuryCount) ? place.injuryCount : ctx.injuryCount));
  const fatalCount = Number.isFinite(fatalFromWho)
    ? fatalFromWho
    : (lock.lens === "fatal" && Number.isFinite(whoCount) ? whoCount : (Number.isFinite(place.fatalCount) ? place.fatalCount : ctx.fatalCount));
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

function lockHands(lock, sessionState = {}) {
  const session = readSessionBag(sessionState);
  const hands = [];
  if (lock.unset || session.roadUser !== lock.roadUser) {
    hands.push(invokeToolkitTool("setRoadUser", { roadUser: lock.roadUser }));
  }
  if (lock.unset || session.windowKey !== lock.windowKey) {
    hands.push(invokeToolkitTool("setWindow", { windowKey: lock.windowKey }));
  }
  if (lock.unset || session.lens !== lock.lens) {
    hands.push(invokeAllowlistedTool("setLens", { lens: lock.lens }));
  }
  if (lock.unset || session.grain !== lock.grain) {
    hands.push(invokeAllowlistedTool("setMode", { mode: lock.grain }));
  }
  return hands;
}

function coachStartJob(sessionState, ctx, utterance = "") {
  const lock = resolveUtteranceLock(sessionState, utterance);
  const phrase = lockPhrase(lock);
  const borough = lock.namedBoroughs.length === 1 ? lock.namedBoroughs[0] : null;
  if (!Array.isArray(ctx.rankedPlaces)) {
    return refuse("No ranked list under the current lock. No invented place.");
  }
  let top = null;
  let boroughHand = null;
  if (borough) {
    boroughHand = selectTopInBorough({ borough }, ctx, lock);
    if (!boroughHand.ok) return refuse(boroughHand.reason);
    top = pickTop(ctx, lock, borough);
  } else {
    top = pickTop(ctx, lock);
  }
  if (!top) {
    return refuse("No place under the current lock. No invented place.");
  }
  const counts = placeCounts(top, lock, ctx);
  const session = { ...readSessionBag(sessionState), selectedId: top.id, lens: lock.lens, roadUser: lock.roadUser };
  const nextScreen = "Inspect Why";
  const where = borough ? `${borough} list #1` : "analytical #1";
  const lockLead = lock.unset
    ? `Lock was unset. Using ${phrase}.`
    : `Lock: ${phrase}.`;
  const boroughLead = borough ? ` ${borough} list #1 under this lock.` : "";
  const stepCopy = `${lockLead}${boroughLead} Step done: selected one intersection (${where}) and opened Why. ${ONE_INTERSECTION_NOT_AREA} Next screen: ${nextScreen}.`;
  return jobOk(
    "coach",
    `Start under ${phrase}${borough ? ` · ${borough}` : ""}: select one intersection and open Why`,
    [
      startCoachJob({ ...lock, lockPhrase: phrase }),
      ...lockHands(lock, sessionState),
      ...(boroughHand ? [boroughHand] : []),
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

function coachBoroughCompareJob(sessionState, ctx, utterance = "") {
  const lock = resolveUtteranceLock(sessionState, utterance);
  const phrase = lockPhrase(lock);
  const named = namedBoroughsInUtterance(utterance);
  if (named.length === 1) {
    return refuse("Name two boroughs to compare, or say Compare two boroughs for Queens vs Brooklyn list #1.");
  }
  const usedDefault = named.length < 2;
  const pair = usedDefault ? ["Queens", "Brooklyn"] : named.slice(0, 2);
  if (pair[0] === pair[1]) {
    return refuse("Name two different boroughs to compare. No invented pair.");
  }
  const first = selectTopInBorough({ borough: pair[0] }, ctx, lock);
  const second = selectTopInBorough({ borough: pair[1] }, ctx, lock);
  if (!first.ok || !second.ok) {
    return refuse(first.ok ? second.reason : first.reason);
  }
  if (first.args.placeId === second.args.placeId) {
    return refuse(`${pair[0]} and ${pair[1]} #1 resolved to the same place. No invented pair.`);
  }
  const nextScreen = "Compare";
  const pairCopy = usedDefault
    ? DEFAULT_COMPARE_COPY
    : `This run is ${pair[0]} vs ${pair[1]} list #1.`;
  const stepCopy = [
    lock.unset ? `Lock was unset. Using ${phrase}.` : `Lock: ${phrase}.`,
    `Step done: ${pair[0]} list #1 and ${pair[1]} list #1.`,
    pairCopy,
    LIST_ORDER_NOT_DANGEROUS,
    `Next screen: ${nextScreen}.`,
  ].join(" ");
  return jobOk(
    "coach",
    `Compare ${pair[0]} list #1 with ${pair[1]} list #1 under ${phrase}`,
    [
      startCoachJob({ ...lock, lockPhrase: phrase }),
      ...lockHands(lock, sessionState),
      first,
      second,
      invokeToolkitTool("selectPlace", { placeId: first.args.placeId }, ctx),
      invokeToolkitTool("openCompare", { compareIds: [first.args.placeId, second.args.placeId] }, {
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
  if (coachMustDeferToRefuse(key)) return null;
  if (isBoroughCompareUtterance(key)) {
    return coachBoroughCompareJob(sessionState, ctx, utterance);
  }
  if (isStartUtterance(key)) {
    const boroughs = namedBoroughsInUtterance(utterance);
    if (boroughs.length >= 2) return coachBoroughCompareJob(sessionState, ctx, utterance);
    return coachStartJob(sessionState, ctx, utterance);
  }
  if (isInvestigateThisUtterance(key) && !readSessionBag(sessionState).selectedId) {
    return coachStartJob(sessionState, ctx, utterance);
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
    offerActions: planned.offerActions ?? null,
    dataThrough: session.analysisEnd,
    sourceStatus: session.sourceStatus,
    honesty: ASK_LEGEND_TASK_HONESTY,
    trace: [
      planned.understood,
      tools.length ? `Tools: ${tools.map((call) => call.tool).join(", ")}` : null,
      session.analysisEnd ? `Records through ${session.analysisEnd}${session.sourceStatus ? ` · ${session.sourceStatus}` : ""}` : "Records through the accepted freeze",
      `Next: ${nextScreen}`,
      stepCopy,
    ].filter(Boolean).join(" · "),
  };
}

export function parsePlannerJob(utterance, sessionState = {}, ctx = {}) {
  const coach = parseCoachJob(utterance, sessionState, ctx);
  if (coach) return coach;
  const next = parsePlannerJobV11(utterance, sessionState, ctx);
  if (isUnknownPlannerJob(next)) return coachOfferJob();
  return next;
}

export function runPlannerJob(utterance, sessionState = {}, ctx = {}) {
  const coach = parseCoachJob(utterance, sessionState, ctx);
  if (coach) return finishCoach(coach, sessionState);
  const result = runPlannerJobV11(utterance, sessionState, ctx);
  if (isUnknownPlannerJob(result)) return finishCoach(coachOfferJob(), sessionState);
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
