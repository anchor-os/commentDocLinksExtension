// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    buildHoverMarkdown
} from "../../src/references/hoverContent.js";

const REFERENCE = {
    type: "documentation",
    raw: "documentation/a.md",
    file: "documentation/a.md",
    anchor: null,
    line: null,
    identifier: null
};

test("valid documentation reference shows the file", () => {
    const markdown = buildHoverMarkdown(
        REFERENCE,
        {
            status: "valid",
            targetPath: "/repo/documentation/a.md",
            line: null,
            message: null
        }
    );

    assert.match(markdown, /^\*\*Documentation\*\*/);
    assert.match(markdown, /documentation\/a\.md/);
});

test("missing file reference shows the reason", () => {
    const markdown = buildHoverMarkdown(
        REFERENCE,
        {
            status: "missing-file",
            targetPath: "/repo/documentation/a.md",
            line: null,
            message: "Documentation file not found: documentation/a.md"
        }
    );

    assert.match(markdown, /not found/i);
});

test("anchor reference shows the anchor", () => {
    const markdown = buildHoverMarkdown(
        {
            ...REFERENCE,
            anchor: "checkout-flow"
        },
        {
            status: "valid",
            targetPath: "/repo/documentation/a.md",
            line: null,
            message: null
        }
    );

    assert.match(markdown, /Anchor: checkout-flow/);
});

test("line reference shows the line", () => {
    const markdown = buildHoverMarkdown(
        {
            ...REFERENCE,
            line: 42
        },
        {
            status: "valid",
            targetPath: "/repo/documentation/a.md",
            line: 42,
            message: null
        }
    );

    assert.match(markdown, /Line: 42/);
});

test("issue reference shows the identifier", () => {
    const markdown = buildHoverMarkdown(
        {
            type: "issue",
            raw: "#123",
            file: null,
            anchor: null,
            line: null,
            identifier: "123"
        },
        {
            status: "external",
            targetPath: null,
            line: null,
            message: null
        }
    );

    assert.match(markdown, /Issue reference/);
    assert.match(markdown, /#123/);
});

test("API reference shows the identifier", () => {
    const markdown = buildHoverMarkdown(
        {
            type: "api",
            raw: "API:Checkout",
            file: null,
            anchor: null,
            line: null,
            identifier: "Checkout"
        },
        {
            status: "external",
            targetPath: null,
            line: null,
            message: null
        }
    );

    assert.match(markdown, /API reference/);
    assert.match(markdown, /Checkout/);
});

test("DOC ticket reference is labelled as a ticket, not documentation", () => {
    const markdown = buildHoverMarkdown(
        {
            type: "documentation",
            raw: "DOC-123",
            file: null,
            anchor: null,
            line: null,
            identifier: "DOC-123"
        },
        {
            status: "external",
            targetPath: null,
            line: null,
            message: null
        }
    );

    assert.match(markdown, /Ticket reference/);
    assert.match(markdown, /DOC-123/);
    assert.doesNotMatch(markdown, /Documentation/);
});

test("missing anchor reference shows the reason", () => {
    const markdown = buildHoverMarkdown(
        {
            ...REFERENCE,
            anchor: "ghost"
        },
        {
            status: "missing-anchor",
            targetPath: "/repo/documentation/a.md",
            line: null,
            message: "Documentation anchor not found: ghost"
        }
    );

    assert.match(markdown, /anchor not found: ghost/);
});
