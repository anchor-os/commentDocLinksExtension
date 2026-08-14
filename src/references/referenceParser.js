// @ts-check

import { REFERENCE_TYPE } from "./referenceTypes.js";

/**
 * Documentation reference syntax recognized inside comments:
 *
 *   documentation/file.md
 *   documentation/file.md#anchor
 *   documentation/file.md - anchor
 *   documentation/file.md — anchor
 *   documentation/file.md:42
 *   documentation/file.md#L42
 *   documentation/file.md#l42
 *
 * `file.md#42` is deliberately NOT treated as a line reference — it stays a
 * heading anchor so `#anchor` and `#L42` never conflict.
 *
 * The path is not allowed to start with `/` (absolute paths are rejected) and
 * the look-behind prevents false positives inside URLs
 * (`https://host/docs/file.md`), inside longer identifiers and after a
 * backslash (`C:\docs\file.md`, UNC paths).
 */
const DOCUMENTATION_REFERENCE_REGEX = new RegExp(
  `(?<![\\w:./\\\\])([A-Za-z0-9_.-][A-Za-z0-9_./-]*\\.md)` +
    `(?:(?::(\\d+))|` +
    `(?:#[Ll](\\d+))|` +
    `(?:#|\\s+-\\s+|\\s+\u2014\\s+)([A-Za-z0-9_-]+))?`,
  "g",
);

/**
 * Anchored variants used by {@link parseReference} to normalize a single
 * already-detected reference. Each group order mirrors the detection regex.
 */
const DOCUMENTATION_REFERENCE_ANCHORED = new RegExp(
  `^([A-Za-z0-9_.-][A-Za-z0-9_./-]*\\.md)` +
    `(?:(?::(\\d+))|` +
    `(?:#[Ll](\\d+))|` +
    `(?:#|\\s+-\\s+|\\s+\u2014\\s+)([A-Za-z0-9_-]+))?$`,
);

/**
 * Issue reference: `#123`.
 *
 * A leading word character is forbidden so `foo#123` is not an issue
 * reference and `file.md#L42` is not partially re-detected.
 */
const ISSUE_REFERENCE_REGEX = /(?<![\w:#])#(\d+)\b/g;

const ISSUE_REFERENCE_ANCHORED = /^#(\d+)$/;

/**
 * API reference: `API:Foo`.
 */
const API_REFERENCE_REGEX = /(?<!\w)API:([A-Za-z0-9_-]+)\b/g;

const API_REFERENCE_ANCHORED = /^API:([A-Za-z0-9_-]+)$/;

/**
 * @typedef {object} TicketLink
 * @property {string} baseUrl URL prefix appended with the matched key.
 * @property {RegExp} regex Compiled ticket-key pattern.
 * @property {string|null} label Optional hover label.
 */

/**
 * @typedef {object} ReferenceSpan
 * @property {string} raw
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} ReferenceSpan
 * @property {string} raw
 * @property {number} start
 * @property {number} end
 * @property {string} [url] Resolved click URL for ticket references.
 * @property {string|null} [label] Hover label for ticket references.
 */

/**
 * Detect reference spans in a piece of text, in priority order.
 *
 * Documentation references win over the generic issue/ticket/API forms so a
 * reference inside an already-matched span (for example `file.md#123`) is
 * never reported twice with conflicting types. Ticket keys from
 * `ticketLinks` are detected last; a span already consumed by a higher-priority
 * reference is skipped, and the first matching ticket entry wins.
 *
 * @param {string} text
 * @param {TicketLink[]} [ticketLinks]
 * @returns {ReferenceSpan[]} Spans sorted by start offset.
 */
export function detectReferenceSpans(text, ticketLinks = []) {
  const accepted = [];
  const consumed = [];

  const accept = (match, meta) => {
    const span = {
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
    };

    if (meta) {
      span.url = meta.url;
      span.label = meta.label;
    }

    for (const existing of consumed) {
      if (span.start < existing.end && existing.start < span.end) {
        return;
      }
    }

    consumed.push(span);
    accepted.push(span);
  };

  for (const match of text.matchAll(DOCUMENTATION_REFERENCE_REGEX)) {
    accept(match);
  }

  for (const match of text.matchAll(ISSUE_REFERENCE_REGEX)) {
    accept(match);
  }

  for (const match of text.matchAll(API_REFERENCE_REGEX)) {
    accept(match);
  }

  for (const entry of ticketLinks) {
    for (const match of text.matchAll(entry.regex)) {
      accept(match, { url: entry.baseUrl + match[0], label: entry.label });
    }
  }

  return accepted.sort((a, b) => a.start - b.start);
}

/**
 * Normalize a raw reference string into a typed reference.
 *
 * A documentation reference carries a `file` plus optional `anchor`/`line`.
 * Issue/API/DOC-… references carry an `identifier`.
 *
 * @param {string} raw
 * @returns {{
 *   type: string,
 *   raw: string,
 *   file: string|null,
 *   anchor: string|null,
 *   line: number|null,
 *   identifier: string|null,
 *   url: string|null,
 *   label: string|null
 * }|null}
 */
export function parseReference(raw) {
  const documentation = raw.match(DOCUMENTATION_REFERENCE_ANCHORED);

  if (documentation) {
    const line =
      documentation[2] !== undefined
        ? Number(documentation[2])
        : documentation[3] !== undefined
          ? Number(documentation[3])
          : null;

    return {
      type: REFERENCE_TYPE.DOCUMENTATION,
      raw,
      file: documentation[1],
      anchor: documentation[4] ?? null,
      line,
      identifier: null,
    };
  }

  const issue = raw.match(ISSUE_REFERENCE_ANCHORED);

  if (issue) {
    return {
      type: REFERENCE_TYPE.ISSUE,
      raw,
      file: null,
      anchor: null,
      line: null,
      identifier: issue[1],
    };
  }

  const api = raw.match(API_REFERENCE_ANCHORED);

  if (api) {
    return {
      type: REFERENCE_TYPE.API,
      raw,
      file: null,
      anchor: null,
      line: null,
      identifier: api[1],
    };
  }

  return null;
}

/**
 * @typedef {object} ParsedReference
 * @property {string} type
 * @property {string} raw
 * @property {string|null} file
 * @property {string|null} anchor
 * @property {number|null} line
 * @property {string|null} identifier
 * @property {string|null} url Resolved click URL (ticket references only).
 * @property {string|null} label Hover label (ticket references only).
 * @property {number} start
 * @property {number} end
 */

/**
 * Parse every reference found in a comment text.
 *
 * Ticket references are produced directly from the spans detected by
 * {@link detectReferenceSpans} (which carries the resolved URL/label), so they
 * never rely on `parseReference`. `parseReference` handles documentation,
 * issue and API references only.
 *
 * Offsets are relative to `offset`, which should be the position of the
 * comment text inside its containing line.
 *
 * @param {string} text
 * @param {number} [offset]
 * @param {TicketLink[]} [ticketLinks]
 * @returns {ParsedReference[]}
 */
export function parseComment(text, offset = 0, ticketLinks = []) {
  const references = [];

  for (const span of detectReferenceSpans(text, ticketLinks)) {
    /** @type {object} */
    let parsed;

    if (span.url !== undefined && span.url !== null) {
      parsed = {
        type: REFERENCE_TYPE.TICKET,
        raw: span.raw,
        file: null,
        anchor: null,
        line: null,
        identifier: span.raw,
        url: span.url,
        label: span.label ?? null,
      };
    } else {
      parsed = parseReference(span.raw);

      if (parsed === null) {
        continue;
      }
    }

    references.push({
      ...parsed,
      start: offset + span.start,
      end: offset + span.end,
    });
  }

  return references;
}
