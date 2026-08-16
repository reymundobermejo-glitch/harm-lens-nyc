/**
 * Ask Legend G0 — ranked search over a caller-supplied frozen place universe.
 * Fail closed: never invents place ids outside `places`.
 */

import {
  STREET_SUFFIX_CANON,
  labelTokens,
  normalizeQuery,
  queryTokens,
  splitCrossStreet,
} from "./normalize.mjs";

const STREET_SUFFIXES = new Set(Object.values(STREET_SUFFIX_CANON));
const MIN_PREFIX_TOKEN = 3;

/**
 * @typedef {"intersection_node" | "midblock_segment"} AskLegendPlaceType
 *
 * @typedef {object} AskLegendPlace
 * @property {string} id
 * @property {AskLegendPlaceType} placeType
 * @property {number | string} placeId
 * @property {string | null} [title]
 * @property {string[]} [streetNames]
 * @property {string | null} [street]
 * @property {string | null} [displayName]
 *
 * @typedef {object} AskLegendMatch
 * @property {string} id
 * @property {number} score
 * @property {string} reason
 *
 * @typedef {object} SearchPlacesOptions
 * @property {number} [limit]
 */

const DEFAULT_LIMIT = 80;

/**
 * @param {AskLegendPlace} place
 * @returns {string[]}
 */
function placeHaystackTexts(place) {
  const names = Array.isArray(place.streetNames) ? place.streetNames : [];
  return [
    place.id,
    String(place.placeId),
    place.title,
    place.street,
    place.displayName,
    ...names,
    lionPhrase(place),
  ].filter((v) => v != null && String(v).trim() !== "");
}

/**
 * @param {AskLegendPlace} place
 * @returns {string}
 */
function lionPhrase(place) {
  const kind = place.placeType === "intersection_node" ? "node" : "segment";
  return `lion ${kind} ${place.placeId}`;
}

/**
 * @param {AskLegendPlace} place
 * @returns {string[][]}
 */
function placeStreetTokenSets(place) {
  const sets = [];
  const names = Array.isArray(place.streetNames) ? place.streetNames : [];
  for (const name of names) {
    const tokens = labelTokens(name);
    if (tokens.length) sets.push(tokens);
  }
  if (place.title) {
    const titleNorm = normalizeQuery(place.title);
    if (titleNorm.includes("&")) {
      const split = splitCrossStreet(titleNorm);
      if (split) {
        if (split.left.length) sets.push(split.left);
        if (split.right.length) sets.push(split.right);
      }
    } else {
      const tokens = queryTokens(titleNorm);
      if (tokens.length) sets.push(tokens);
    }
  }
  if (place.street) {
    const tokens = labelTokens(place.street);
    if (tokens.length) sets.push(tokens);
  }
  return sets;
}

/**
 * @param {string} token
 * @returns {boolean}
 */
function isStreetSuffix(token) {
  return STREET_SUFFIXES.has(token);
}

/**
 * Named-street identity: suffixes and 1–2 letter compass tokens are not
 * identity. `eastern` must not match hay `e` on "Henry Hudson Pkwy E".
 *
 * @param {string} needle
 * @param {string} hay
 * @returns {boolean}
 */
function tokenIdentity(needle, hay) {
  if (/^\d+$/.test(needle) || /^\d+$/.test(hay)) return hay === needle;
  if (isStreetSuffix(needle) || isStreetSuffix(hay)) return hay === needle;
  if (hay === needle) return true;
  if (needle.length >= MIN_PREFIX_TOKEN && hay.startsWith(needle)) return true;
  if (hay.length >= MIN_PREFIX_TOKEN && needle.startsWith(hay)) return true;
  return false;
}

/**
 * @param {string[]} needle
 * @param {string[]} hay
 * @returns {boolean}
 */
function tokensCovered(needle, hay) {
  if (!needle.length || !hay.length) return false;
  return needle.every((n) => hay.some((h) => tokenIdentity(n, h)));
}

/**
 * @param {string[]} needle
 * @param {string[][]} sets
 * @returns {boolean}
 */
function matchesAnyStreetSet(needle, sets) {
  return sets.some((set) => tokensCovered(needle, set));
}

/**
 * @param {string} normalized
 * @param {AskLegendPlace} place
 * @returns {{ score: number; reason: string } | null}
 */
function scorePlace(normalized, place) {
  if (!normalized) return null;

  const idLower = place.id.toLowerCase();
  const placeIdStr = String(place.placeId);
  const tokens = queryTokens(normalized);
  const streetSets = placeStreetTokenSets(place);
  const titleNorm = place.title ? normalizeQuery(place.title) : "";

  // Exact compound id
  if (normalized === idLower || normalized.replace(/\s+/g, "") === idLower) {
    return { score: 100, reason: "exact place id" };
  }

  // Bare LION id
  if (tokens.length === 1 && tokens[0] === placeIdStr) {
    return { score: 96, reason: "exact LION id" };
  }

  // "node 15193" / "segment 100008" / "lion node 15193"
  const lionKind = place.placeType === "intersection_node" ? "node" : "segment";
  const lionPatterns = [
    `lion ${lionKind} ${placeIdStr}`,
    `${lionKind} ${placeIdStr}`,
    `lion ${placeIdStr}`,
  ];
  if (lionPatterns.includes(normalized)) {
    return { score: 94, reason: `LION ${lionKind} id` };
  }

  // Cross-street-ish: both sides must hit distinct street sets (or title)
  const cross = splitCrossStreet(normalized);
  if (cross) {
    const leftHit = matchesAnyStreetSet(cross.left, streetSets);
    const rightHit = matchesAnyStreetSet(cross.right, streetSets);
    if (leftHit && rightHit) {
      let score = 82;
      let reason = "cross-street label match";
      if (titleNorm && tokensCovered([...cross.left, ...cross.right], queryTokens(titleNorm.replace(/&/g, " ")))) {
        score = 88;
        reason = "cross-street title match";
      }
      // Prefer exact two-street titles
      if (titleNorm === normalized || titleNorm.replace(/\s+/g, " ") === normalized) {
        score = 92;
        reason = "exact cross-street title";
      }
      return { score, reason };
    }
    // Fail closed for cross-street shape: one side only is not enough
    return null;
  }

  // Exact title
  if (titleNorm && titleNorm === normalized) {
    return { score: 90, reason: "exact title" };
  }

  // All query tokens covered by a single street name / title.
  // Suffixes are required when present, but they are not street identity.
  if (tokens.length && matchesAnyStreetSet(tokens, streetSets)) {
    const exactStreet = (place.streetNames ?? []).some(
      (name) => normalizeQuery(name) === normalized,
    );
    return {
      score: exactStreet ? 78 : 70,
      reason: exactStreet ? "exact street name" : "partial street match",
    };
  }

  const namedTokens = tokens.filter((t) => !isStreetSuffix(t) && !/^\d+$/.test(t));
  const suffixTokens = tokens.filter((t) => isStreetSuffix(t));
  // Named-street + suffix already failed identity; do not let `pkwy`
  // substring-match Henry Hudson / Mosholu.
  const allowSubstring = !(namedTokens.length && suffixTokens.length);

  // Substring fallback across haystack (partial street / id fragment)
  const haystack = placeHaystackTexts(place)
    .map((v) => normalizeQuery(String(v)))
    .filter(Boolean);
  if (allowSubstring && tokens.length && haystack.some((h) => tokens.every((t) => h.includes(t)))) {
    return { score: 55, reason: "label substring match" };
  }

  // Single-token prefix against any street token. Suffixes are not identity.
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.length >= MIN_PREFIX_TOKEN && !isStreetSuffix(t)) {
      const hit = streetSets.some((set) => set.some((s) => s.startsWith(t) || (s.length >= MIN_PREFIX_TOKEN && t.startsWith(s))));
      if (hit) return { score: 48, reason: "street token prefix" };
      if (placeIdStr.startsWith(t)) return { score: 45, reason: "LION id prefix" };
    }
  }

  return null;
}

/**
 * Rank frozen places for a query. Empty query → []. Unknown places never appear.
 *
 * @param {string} query
 * @param {readonly AskLegendPlace[]} places
 * @param {SearchPlacesOptions} [options]
 * @returns {AskLegendMatch[]}
 */
export function searchPlaces(query, places, options = {}) {
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Math.floor(options.limit)
    : DEFAULT_LIMIT;

  if (!Array.isArray(places) || places.length === 0) return [];

  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  /** @type {AskLegendMatch[]} */
  const matches = [];
  const seen = new Set();

  for (const place of places) {
    if (!place || typeof place.id !== "string" || !place.id) continue;
    if (seen.has(place.id)) continue;
    const hit = scorePlace(normalized, place);
    if (!hit) continue;
    seen.add(place.id);
    matches.push({ id: place.id, score: hit.score, reason: hit.reason });
  }

  matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return matches.slice(0, limit);
}

/**
 * Conservative spelling/number near-misses for an otherwise empty query.
 * Results are still members of the caller's frozen universe and are never
 * promoted to established search hits.
 *
 * @param {string} query
 * @param {readonly AskLegendPlace[]} places
 * @param {{ limit?: number }} [options]
 * @returns {AskLegendMatch[]}
 */
export function searchNearMisses(query, places, options = {}) {
  if (!Array.isArray(places) || !places.length || searchPlaces(query, places).length) return [];
  const needle = queryTokens(normalizeQuery(query));
  if (needle.length < 2) return [];
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : 3;
  const candidates = [];
  for (const place of places) {
    if (!place?.id || !place.title) continue;
    const hay = new Set(queryTokens(normalizeQuery(place.title)));
    const shared = needle.filter((token) => hay.has(token)).length;
    if (shared < 2) continue;
    candidates.push({ id: place.id, score: shared, reason: "possible frozen-label near-match" });
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return candidates.slice(0, limit);
}
