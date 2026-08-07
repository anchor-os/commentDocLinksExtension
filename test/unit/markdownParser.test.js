// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    parseMarkdownHeading
} from "../../src/parsers/markdownParser.js";

test("em-dash heading parses", () => {
    const parsed = parseMarkdownHeading(
        "## src/util/foo.js — reconciliation-guarantee"
    );

    assert.deepEqual(parsed, {
        source: "src/util/foo.js",
        anchor: "reconciliation-guarantee",
        start: "## ".length,
        end: "## ".length + "src/util/foo.js".length
    });
});

test("space-hyphen heading parses", () => {
    const parsed = parseMarkdownHeading(
        "## src/util/foo.js - reconciliation-guarantee"
    );

    assert.equal(parsed.source, "src/util/foo.js");
    assert.equal(parsed.anchor, "reconciliation-guarantee");
});

test("hash-separated heading parses (legacy tolerance)", () => {
    const parsed = parseMarkdownHeading(
        "## scripts/local/localGraphqlResolverPipeline.js" +
        "#function-config-map-rationale"
    );

    assert.equal(
        parsed.source,
        "scripts/local/localGraphqlResolverPipeline.js"
    );
    assert.equal(parsed.anchor, "function-config-map-rationale");
});

test("heading without anchor does not parse", () => {
    assert.equal(
        parseMarkdownHeading("## src/util/foo.js"),
        null
    );
});

test("single-hash heading does not parse", () => {
    assert.equal(
        parseMarkdownHeading("# src/util/foo.js — anchor"),
        null
    );
});

test("non-heading line does not parse", () => {
    assert.equal(
        parseMarkdownHeading("some prose text here"),
        null
    );
});
