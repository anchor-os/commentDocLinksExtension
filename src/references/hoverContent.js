// @ts-check

import { REFERENCE_TYPE, RESOLUTION_STATUS } from "./referenceTypes.js";

/**
 * @typedef {object} HoverReference
 * @property {string} type
 * @property {string} raw
 * @property {string|null} file
 * @property {string|null} anchor
 * @property {number|null} line
 * @property {string|null} identifier
 * @property {string|null} url Resolved click URL (ticket references only).
 * @property {string|null} label Hover label (ticket references only).
 */

/**
 * Build the concise hover markdown for a reference.
 *
 * Pure function so the exact copy can be unit-tested without a VS Code host.
 *
 * @param {HoverReference} reference
 * @param {import("./resolver.js").ResolutionResult} result
 * @returns {string}
 */
export function buildHoverMarkdown(reference, result) {
  if (reference.type === REFERENCE_TYPE.DOCUMENTATION && reference.file !== null) {
    return documentationHover(reference, result);
  }

  if (reference.type === REFERENCE_TYPE.TICKET) {
    return ticketHover(reference, result);
  }

  return externalHover(reference);
}

/**
 * @param {HoverReference} reference
 * @param {import("./resolver.js").ResolutionResult} result
 * @returns {string}
 */
function documentationHover(reference, result) {
  const lines = ["**Documentation**"];

  if (result.status === RESOLUTION_STATUS.MISSING_FILE) {
    lines.push(`\`${reference.file}\``);
    lines.push("Documentation file not found");
    return lines.join("\n\n");
  }

  lines.push(`\`${reference.file}\``);

  if (result.status === RESOLUTION_STATUS.MISSING_ANCHOR) {
    lines.push(`Documentation anchor not found: ${reference.anchor}`);
  } else if (result.status === RESOLUTION_STATUS.INVALID_LINE) {
    lines.push(`Documentation line out of range: ${reference.line}`);
  } else if (result.status === RESOLUTION_STATUS.INVALID_PATH) {
    lines.push("Documentation path is not allowed");
  } else if (reference.anchor !== null) {
    lines.push(`Anchor: ${reference.anchor}`);
  } else if (reference.line !== null) {
    lines.push(`Line: ${reference.line}`);
  }

  return lines.join("\n\n");
}

/**
 * @param {HoverReference} reference
 * @param {import("./resolver.js").ResolutionResult} result
 * @returns {string}
 */
function ticketHover(reference, result) {
  const lines = ["**Ticket reference**"];

  if (reference.label !== null) {
    lines.push(reference.label);
  }

  lines.push(`\`${reference.identifier}\``);

  if (result.url !== null) {
    const label = reference.label !== null ? reference.label : "Open";

    lines.push(`[${label}](${result.url})`);
  }

  return lines.join("\n\n");
}

/**
 * @param {HoverReference} reference
 * @returns {string}
 */
function externalHover(reference) {
  if (reference.type === REFERENCE_TYPE.ISSUE) {
    return `**Issue reference**\n\n\`#${reference.identifier}\``;
  }

  if (reference.type === REFERENCE_TYPE.API) {
    return `**API reference**\n\n\`${reference.identifier}\``;
  }

  return `**Documentation reference**\n\n\`${reference.raw}\``;
}
