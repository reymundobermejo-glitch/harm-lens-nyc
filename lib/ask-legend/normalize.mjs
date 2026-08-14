/**
 * Ask Legend G0 — query normalization (frozen-label search only).
 * No LLM. No live data. No infrastructure claims.
 */

/** @type {Readonly<Record<string, string>>} */
const STREET_SUFFIX_CANON = Object.freeze({
  avenue: "ave",
  ave: "ave",
  street: "st",
  st: "st",
  road: "rd",
  rd: "rd",
  boulevard: "blvd",
  blvd: "blvd",
  place: "pl",
  pl: "pl",
  lane: "ln",
  ln: "ln",
  drive: "dr",
  dr: "dr",
  court: "ct",
  ct: "ct",
  terrace: "ter",
  ter: "ter",
  parkway: "pkwy",
  pkwy: "pkwy",
  plaza: "plz",
  plz: "plz",
  beach: "bch",
  bch: "bch",
  square: "sq",
  sq: "sq",
});

/**
 * Lowercase, collapse whitespace, strip most punctuation, canonicalize
 * common NYC street suffixes. Empty/whitespace → "".
 *
 * @param {string} query
 * @returns {string}
 */
export function normalizeQuery(query) {
  if (query == null) return "";
  const raw = String(query).trim().toLowerCase();
  if (!raw) return "";

  // Preserve cross-street separators as " & " for later split.
  let text = raw
    .replace(/\band\b/g, "&")
    .replace(/\bat\b/g, "&")
    .replace(/[@/+,|]/g, "&")
    .replace(/\s*&\s*/g, " & ");

  // Keep ":" and "_" so compound place ids like intersection_node:15193 survive.
  text = text
    .replace(/[^a-z0-9:_&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  const parts = text.split(" ").map((token) => {
    if (token === "&") return "&";
    return STREET_SUFFIX_CANON[token] ?? token;
  });

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Token list for matching (excludes bare "&").
 *
 * @param {string} normalized
 * @returns {string[]}
 */
export function queryTokens(normalized) {
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t && t !== "&");
}

/**
 * Split a normalized query into cross-street sides when a separator is present.
 * Returns null when not a cross-street-shaped query.
 *
 * @param {string} normalized
 * @returns {{ left: string[]; right: string[] } | null}
 */
export function splitCrossStreet(normalized) {
  if (!normalized || !normalized.includes("&")) return null;
  const sides = normalized.split("&").map((side) => side.trim()).filter(Boolean);
  if (sides.length < 2) return null;
  const left = queryTokens(sides[0]);
  const right = queryTokens(sides.slice(1).join(" "));
  if (!left.length || !right.length) return null;
  return { left, right };
}

/**
 * Normalize a free-text street label into comparable tokens.
 *
 * @param {string | null | undefined} value
 * @returns {string[]}
 */
export function labelTokens(value) {
  if (value == null) return [];
  const normalized = normalizeQuery(String(value));
  return queryTokens(normalized);
}

export { STREET_SUFFIX_CANON };
