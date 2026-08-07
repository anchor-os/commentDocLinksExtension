// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    hasExactSourceReference
} from "../../src/services/sourceResolver.js";

import {
    makeDocument
} from "./helpers.js";

test("exact anchor match returns true", () => {
    const document = makeDocument([
        "// see documentation/a.md#reconciliation-guarantee"
    ]);

    assert.equal(
        hasExactSourceReference(
            document,
            "documentation/a.md",
            "reconciliation-guarantee"
        ),
        true
    );
});

test("different anchor returns false", () => {
    const document = makeDocument([
        "// see documentation/a.md#different-anchor"
    ]);

    assert.equal(
        hasExactSourceReference(
            document,
            "documentation/a.md",
            "reconciliation-guarantee"
        ),
        false
    );
});

test("different file returns false", () => {
    const document = makeDocument([
        "// see documentation/b.md#reconciliation-guarantee"
    ]);

    assert.equal(
        hasExactSourceReference(
            document,
            "documentation/a.md",
            "reconciliation-guarantee"
        ),
        false
    );
});

test("empty anchor returns false", () => {
    const document = makeDocument([
        "// see documentation/a.md"
    ]);

    assert.equal(
        hasExactSourceReference(
            document,
            "documentation/a.md",
            ""
        ),
        false
    );
});
