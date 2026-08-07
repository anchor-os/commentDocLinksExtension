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
        file: "documentation/file.md",
        anchor: null,
        start: 0,
        end: "documentation/file.md".length
    }]);
});

test("hash-anchored reference parses", () => {
    const matches = parseComment(
        "documentation/file.md#reconciliation-guarantee",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, "reconciliation-guarantee");
});

test("space-hyphen anchored reference parses", () => {
    const matches = parseComment(
        "documentation/file.md - reconciliation-guarantee",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, "reconciliation-guarantee");
});

test("em-dash anchored reference parses", () => {
    const matches = parseComment(
        "documentation/file.md — reconciliation-guarantee",
        0
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].file, "documentation/file.md");
    assert.equal(matches[0].anchor, "reconciliation-guarantee");
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

test("no reference yields no matches", () => {
    const matches = parseComment("nothing to see here", 0);

    assert.equal(matches.length, 0);
});
