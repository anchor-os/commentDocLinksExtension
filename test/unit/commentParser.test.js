// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    parseComment
} from "../../src/parsers/commentParser.js";

test("plain file reference parses with null anchor", () => {
    const matches = parseComment(
        "documentation/file.md",
        0
    );

    assert.deepEqual(matches, [{
        type: "documentation",
        raw: "documentation/file.md",
        file: "documentation/file.md",
        anchor: null,
        line: null,
        identifier: null,
        start: 0,
        end: "documentation/file.md".length
    }]);
});

test("hash-anchored reference parses", () => {
    const matches = parseComment(
        "documentation/file.md#checkout-flow",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, "checkout-flow");
});

test("space-hyphen anchored reference parses", () => {
    const matches = parseComment(
        "documentation/file.md - checkout-flow",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, "checkout-flow");
});

test("em-dash anchored reference parses", () => {
    const matches = parseComment(
        "documentation/file.md — checkout-flow",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, "checkout-flow");
});

test("multiple references in one comment parse in order", () => {
    const matches = parseComment(
        "see documentation/a.md and documentation/b.md#foo",
        0
    );

    assert.equal(matches.length, 2);
    assert.equal(matches[0].file, "documentation/a.md");
    assert.equal(matches[1].file, "documentation/b.md");
    assert.equal(matches[1].anchor, "foo");
});

test("start/end offsets include the reference prefix offset", () => {
    const text = "leading text documentation/file.md#anchor";
    const matches = parseComment(text, 0);

    assert.equal(matches.length, 1);
    assert.equal(matches[0].start, text.indexOf("documentation"));
    assert.equal(matches[0].end, text.length);
});

test("offsets include a nonzero parser offset", () => {
    const text = "documentation/file.md#anchor";
    const offset = 42;
    const matches = parseComment(text, offset);

    assert.equal(matches.length, 1);
    assert.equal(matches[0].start, offset + text.indexOf("documentation"));
    assert.equal(matches[0].end, offset + text.length);
});

test("no reference yields no matches", () => {
    const matches = parseComment("nothing to see here", 0);

    assert.equal(matches.length, 0);
});

test("colon line-number reference parses", () => {
    const matches = parseComment(
        "documentation/file.md:42",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, null);
    assert.equal(matches[0].line, 42);
});

test("hash line-number reference parses", () => {
    const matches = parseComment(
        "documentation/file.md#L42",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, null);
    assert.equal(matches[0].line, 42);
});

test("lowercase hash line-number reference parses", () => {
    const matches = parseComment(
        "documentation/file.md#l42",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].anchor, null);
    assert.equal(matches[0].line, 42);
});

test("heading anchors still parse with a null line", () => {
    for (const text of [
        "documentation/file.md#checkout-flow",
        "documentation/file.md - checkout-flow",
        "documentation/file.md — checkout-flow"
    ]) {
        const matches = parseComment(text, 0);

        assert.equal(matches.length, 1, text);
        assert.equal(matches[0].anchor, "checkout-flow", text);
        assert.equal(matches[0].line, null, text);
    }
});

test("line and anchor references in one comment parse in order", () => {
    const matches = parseComment(
        "see documentation/a.md:10 and documentation/b.md#foo",
        0
    );

    assert.equal(matches.length, 2);
    assert.equal(matches[0].line, 10);
    assert.equal(matches[0].anchor, null);
    assert.equal(matches[1].anchor, "foo");
    assert.equal(matches[1].line, null);
});

test("line-number reference offsets include the reference prefix offset", () => {
    const text = "leading text documentation/file.md#L42";
    const matches = parseComment(text, 0);

    assert.equal(matches.length, 1);
    assert.equal(matches[0].start, text.indexOf("documentation"));
    assert.equal(matches[0].end, text.length);
});
