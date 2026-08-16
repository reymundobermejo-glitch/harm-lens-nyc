/**
 * P5 shareable investigation set — method lock + place IDs.
 * URL is the share. localStorage may keep the same-browser tray; it is not the share.
 * Fail-closed: unknown/invented IDs, missing lock fields, or freeze mismatch refuse once.
 * Not a priority list. Not official DOT ranking. No accounts.
 */

export const SHARE_SET_VERSION = "HL-SHARE-SET-v1";
export const SHARE_HASH_KEY = "hlshare";
export const SHARE_STORAGE_KEY = "hl-share-set-v1";
export const SHARE_SET_COPY = "Your working set — not a priority list. Investigation set / working set — not official DOT ranking.";

export const LENSES = Object.freeze(["injury", "fatal"]);
export const ROAD_USERS = Object.freeze(["everyone", "pedestrian", "cyclist", "motorist"]);
export const WINDOW_KEYS = Object.freeze(["24m", "36m", "48m"]);
export const PLACE_MODES = Object.freeze(["intersection_node", "midblock_segment"]);
export const FREEZE_KEYS = Object.freeze([
  "objectVersion",
  "assignmentVersion",
  "analysisEnd",
  "p25ObjectVersion",
  "corridorVersion",
]);

const REFUSE = {
  missing: "This investigation set could not be opened. A required method-lock field is missing. The current lock was not changed.",
  invented: "This investigation set could not be opened. Unknown or invented place IDs are refused. The current lock was not changed.",
  freeze: "This investigation set could not be opened. Snapshot versions do not match this freeze. The current lock was not changed.",
  corridor: "This investigation set could not be opened. Corridor identity must be an exact component id, not a street name. The current lock was not changed.",
  grain: "This investigation set could not be opened. Place grain does not match the locked mode. The current lock was not changed.",
  mixed: "This investigation set could not be opened. Query and hash disagree, so nothing was applied. The current lock was not changed.",
  empty: "This investigation set could not be opened. The saved set is empty. The current lock was not changed.",
  version: "This investigation set could not be opened. Unknown share version. The current lock was not changed.",
  token: "This investigation set could not be opened. The share token is not a valid investigation set. The current lock was not changed.",
};

export function shareRefuseCopy(code) {
  return REFUSE[code] ?? REFUSE.token;
}

function isEnum(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}

function utf8ToBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToUtf8(token) {
  if (typeof token !== "string" || !token.length) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (token.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function buildSharePayload(input = {}) {
  const placeIds = Array.isArray(input.placeIds) ? input.placeIds.map((id) => String(id)) : [];
  const freeze = input.freeze && typeof input.freeze === "object" ? input.freeze : {};
  const corridorId = typeof input.corridorId === "string" ? input.corridorId.trim() : "";
  const packetSubjectId = typeof input.packetSubjectId === "string" ? input.packetSubjectId : "";
  const payload = {
    version: SHARE_SET_VERSION,
    lens: input.lens,
    roadUser: input.roadUser,
    windowKey: input.windowKey,
    mode: input.mode,
    placeIds,
    packetSubjectId,
    freeze: {
      objectVersion: freeze.objectVersion,
      assignmentVersion: freeze.assignmentVersion,
      analysisEnd: freeze.analysisEnd,
      p25ObjectVersion: freeze.p25ObjectVersion,
      corridorVersion: freeze.corridorVersion,
    },
  };
  if (corridorId) payload.corridorId = corridorId;
  return payload;
}

export function encodeSharePayload(payload) {
  return utf8ToBase64Url(JSON.stringify(payload));
}

export function parseShareToken(token) {
  const text = base64UrlToUtf8(token);
  if (!text) return { ok: false, reason: shareRefuseCopy("token") };
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: shareRefuseCopy("token") };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, reason: shareRefuseCopy("token") };
  }
}

export function shareHref(origin, payload) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/#${SHARE_HASH_KEY}=${encodeSharePayload(payload)}`;
}

export function readShareTokenFromHref(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, reason: shareRefuseCopy("token") };
  }
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashToken = new URLSearchParams(hash).get(SHARE_HASH_KEY);
  const queryToken = url.searchParams.get(SHARE_HASH_KEY);
  if (hashToken && queryToken && hashToken !== queryToken) {
    return { ok: false, reason: shareRefuseCopy("mixed") };
  }
  return { ok: true, token: hashToken || queryToken || null };
}

export function stripShareFromHref(href) {
  const url = new URL(href);
  url.searchParams.delete(SHARE_HASH_KEY);
  if (url.hash) {
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (params.has(SHARE_HASH_KEY)) {
      params.delete(SHARE_HASH_KEY);
      const next = params.toString();
      url.hash = next ? `#${next}` : "";
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function validateSharePayload(raw, universe = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: shareRefuseCopy("token") };
  }
  if (raw.version !== SHARE_SET_VERSION) {
    return { ok: false, reason: shareRefuseCopy("version") };
  }
  if (!isEnum(raw.lens, LENSES) || !isEnum(raw.roadUser, ROAD_USERS) || !isEnum(raw.windowKey, WINDOW_KEYS) || !isEnum(raw.mode, PLACE_MODES)) {
    return { ok: false, reason: shareRefuseCopy("missing") };
  }
  if (!raw.freeze || typeof raw.freeze !== "object") {
    return { ok: false, reason: shareRefuseCopy("freeze") };
  }
  const expectedFreeze = universe.freeze ?? {};
  for (const key of FREEZE_KEYS) {
    if (typeof raw.freeze[key] !== "string" || !raw.freeze[key]) {
      return { ok: false, reason: shareRefuseCopy("freeze") };
    }
    if (expectedFreeze[key] && raw.freeze[key] !== expectedFreeze[key]) {
      return { ok: false, reason: shareRefuseCopy("freeze") };
    }
  }
  if (!Array.isArray(raw.placeIds) || raw.placeIds.length === 0) {
    return { ok: false, reason: shareRefuseCopy("empty") };
  }
  const placeIds = [];
  const seen = new Set();
  const places = universe.places ?? {};
  for (const id of raw.placeIds) {
    if (typeof id !== "string" || !id) return { ok: false, reason: shareRefuseCopy("invented") };
    if (seen.has(id)) return { ok: false, reason: shareRefuseCopy("invented") };
    const place = places[id];
    if (!place) return { ok: false, reason: shareRefuseCopy("invented") };
    if (place.placeType && place.placeType !== raw.mode) return { ok: false, reason: shareRefuseCopy("grain") };
    seen.add(id);
    placeIds.push(id);
  }
  if (typeof raw.packetSubjectId !== "string" || !raw.packetSubjectId) {
    return { ok: false, reason: shareRefuseCopy("missing") };
  }
  const subject = places[raw.packetSubjectId];
  if (!subject) return { ok: false, reason: shareRefuseCopy("invented") };
  if (subject.placeType && subject.placeType !== raw.mode) return { ok: false, reason: shareRefuseCopy("grain") };

  const corridorId = typeof raw.corridorId === "string" ? raw.corridorId.trim() : "";
  if (corridorId) {
    if (corridorId === "Eastern Parkway" || !corridorId.startsWith("HL-CORRIDOR-")) {
      return { ok: false, reason: shareRefuseCopy("corridor") };
    }
    const corridorIds = universe.corridorIds ?? new Set();
    if (!corridorIds.has(corridorId)) return { ok: false, reason: shareRefuseCopy("corridor") };
    const members = universe.corridorPlaceIds?.[corridorId];
    if (members) {
      for (const id of placeIds) {
        if (!members.has(id)) return { ok: false, reason: shareRefuseCopy("corridor") };
      }
      if (!members.has(raw.packetSubjectId)) return { ok: false, reason: shareRefuseCopy("corridor") };
    }
  }

  return {
    ok: true,
    payload: buildSharePayload({
      ...raw,
      placeIds,
      corridorId,
    }),
  };
}

export function parseAndValidateShareHref(href, universe) {
  const tokenRead = readShareTokenFromHref(href);
  if (!tokenRead.ok) return tokenRead;
  if (!tokenRead.token) return { ok: true, payload: null };
  const parsed = parseShareToken(tokenRead.token);
  if (!parsed.ok) return parsed;
  return validateSharePayload(parsed.payload, universe);
}
