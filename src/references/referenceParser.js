// @ts-check

import {
    REFERENCE_TYPE
} from "./referenceTypes.js";

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
    "g"
);

/**
 * Anchored variants used by {@link parseReference} to normalize a single
 * already-detected reference. Each group order mirrors the detection regex.
 */
const DOCUMENTATION_REFERENCE_ANCHORED = new RegExp(
    `^([A-Za-z0-9_.-][A-Za-z0-9_./-]*\\.md)` +
    `(?:(?::(\\d+))|` +
    `(?:#[Ll](\\d+))|` +
    `(?:#|\\s+-\\s+|\\s+\u2014\\s+)([A-Za-z0-9_-]+))?$`
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
 * Documentation ticket reference: `DOC-123`.
 */
const TICKET_REFERENCE_REGEX = /(?<!\w)DOC-(\d+)\b/g;

const TICKET_REFERENCE_ANCHORED = /^DOC-(\d+)$/;

/**
 * API reference: `API:Foo`.
 */
const API_REFERENCE_REGEX = /(?<!\w)API:([A-Za-z0-9_-]+)\b/g;

const API_REFERENCE_ANCHORED = /^API:([A-Za-z0-9_-]+)$/;

/**
 * @typedef {object} ReferenceSpan
 * @property {string} raw
 * @property {number} start
 * @property {number} end
 */

/**
 * Detect reference spans in a piece of text, in priority order.
 *
 * Documentation references win over the generic issue/ticket/API forms so a
 * reference inside an already-matched span (for example `file.md#123`) is
 * never reported twice with conflicting types.
 *
 * @param {string} text
 * @returns {ReferenceSpan[]} Spans sorted by start offset.
 */
export function detectReferenceSpans(text) {
    const accepted = [];
    const consumed = [];

    const accept = (match) => {
        const span = {
            raw: match[0],
            start: match.index,
            end: match.index + match[0].length
        };

        for (const existing of consumed) {
            if (
                span.start < existing.end &&
                existing.start < span.end
            ) {
                return;
            }
        }

        consumed.push(span);
        accepted.push(span);
    };

    for (const match of text.matchAll(
        DOCUMENTATION_REFERENCE_REGEX
    )) {
        accept(match);
    }

    for (const match of text.matchAll(
        ISSUE_REFERENCE_REGEX
    )) {
        accept(match);
    }

    for (const match of text.matchAll(
        TICKET_REFERENCE_REGEX
    )) {
        accept(match);
    }

    for (const match of text.matchAll(
        API_REFERENCE_REGEX
    )) {
        accept(match);
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
 *   identifier: string|null
 * }|null}
 */
export function parseReference(raw) {
    const documentation = raw.match(
        DOCUMENTATION_REFERENCE_ANCHORED
    );

    if (documentation) {
        const line =
            documentation[2] !== undefined
                ? Number(documentation[2]) :
            documentation[3] !== undefined
                ? Number(documentation[3]) :
                null;

        return {
            type: REFERENCE_TYPE.DOCUMENTATION,
            raw,
            file: documentation[1],
            anchor: documentation[4] ?? null,
            line,
            identifier: null
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
            identifier: issue[1]
        };
    }

    const ticket = raw.match(TICKET_REFERENCE_ANCHORED);

    if (ticket) {
        return {
            type: REFERENCE_TYPE.DOCUMENTATION,
            raw,
            file: null,
            anchor: null,
            line: null,
            identifier: raw
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
            identifier: api[1]
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
 * @property {number} start
 * @property {number} end
 */

/**
 * Parse every reference found in a comment text.
 *
 * Offsets are relative to `offset`, which should be the position of the
 * comment text inside its containing line.
 *
 * @param {string} text
 * @param {number} [offset]
 * @returns {ParsedReference[]}
 */
export function parseComment(text, offset = 0) {
    const references = [];

    for (const span of detectReferenceSpans(text)) {
        const parsed = parseReference(span.raw);

        if (parsed === null) {
            continue;
        }

        references.push({
            ...parsed,
            start: offset + span.start,
            end: offset + span.end
        });
    }

    return references;
}
