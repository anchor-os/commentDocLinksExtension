// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    detectReferenceSpans,
    parseReference,
    parseComment
} from "../../src/references/referenceParser.js";

test("detects a plain documentation reference", () => {
    const spans = detectReferenceSpans(
        "see documentation/file.md here"
    );

    assert.deepEqual(spans, [{
        raw: "documentation/file.md",
        start: 4,
        end: 4 + "documentation/file.md".length
    }]);
});

test("rejects documentation references inside URLs", () => {
    assert.deepEqual(
        detectReferenceSpans(
            "see https://example.com/docs/file.md"
        ),
        []
    );
});

test("rejects absolute documentation paths", () => {
    assert.deepEqual(
        detectReferenceSpans(
            "see /Users/me/docs/file.md"
        ),
        []
    );
});

test("rejects references after a backslash (Windows drive letter)", () => {
    assert.deepEqual(
        detectReferenceSpans("C:\\docs\\file.md"),
        []
    );
});

test("rejects references inside UNC paths", () => {
    assert.deepEqual(
        detectReferenceSpans("\\\\server\\share\\docs\\file.md"),
        []
    );
});

test("accepts relative dot paths", () => {
    assert.deepEqual(
        detectReferenceSpans("./docs/file.md"),
        [{
            raw: "./docs/file.md",
            start: 0,
            end: "./docs/file.md".length
        }]
    );
});

test("detects an issue reference", () => {
    assert.deepEqual(
        parseReference("#123"),
        {
            type: "issue",
            raw: "#123",
            file: null,
            anchor: null,
            line: null,
            identifier: "123"
        }
    );
});

test("issue reference does not match a word prefix", () => {
    assert.deepEqual(
        detectReferenceSpans("foo#123"),
        []
    );
});

test("issue reference inside a file anchor is consumed by documentation", () => {
    const spans = detectReferenceSpans("file.md#123");

    assert.equal(spans.length, 1);
    assert.equal(spans[0].raw, "file.md#123");
    assert.equal(parseReference(spans[0].raw).type, "documentation");
});

test("detects a DOC ticket reference", () => {
    assert.deepEqual(
        parseReference("DOC-123"),
        {
            type: "documentation",
            raw: "DOC-123",
            file: null,
            anchor: null,
            line: null,
            identifier: "DOC-123"
        }
    );
});

test("ticket reference does not match a word suffix", () => {
    assert.deepEqual(
        detectReferenceSpans("DOC-123x"),
        []
    );
});

test("detects an API reference", () => {
    assert.deepEqual(
        parseReference("API:Checkout"),
        {
            type: "api",
            raw: "API:Checkout",
            file: null,
            anchor: null,
            line: null,
            identifier: "Checkout"
        }
    );
});

test("API reference does not match a word prefix", () => {
    assert.deepEqual(
        detectReferenceSpans("xAPI:Foo"),
        []
    );
});

test("documentation reference wins over overlapping forms", () => {
    const matches = parseComment(
        "see documentation/a.md#123 and #456",
        0
    );

    assert.equal(matches.length, 2);
    assert.equal(matches[0].type, "documentation");
    assert.equal(matches[0].anchor, "123");
    assert.equal(matches[1].type, "issue");
    assert.equal(matches[1].identifier, "456");
});

test("mixed reference types parse in order", () => {
    const matches = parseComment(
        "DOC-42 API:Checkout documentation/a.md #7",
        0
    );

    assert.deepEqual(
        matches.map((m) => m.type),
        ["documentation", "api", "documentation", "issue"]
    );
});

test("parseComment offsets include the parser offset", () => {
    const matches = parseComment(
        "see documentation/a.md #7",
        20
    );

    assert.equal(
        matches[0].start,
        20 + "see ".length
    );
});

test("no reference yields no matches", () => {
    assert.deepEqual(parseComment("nothing here", 0), []);
    assert.deepEqual(parseComment("", 0), []);
});
