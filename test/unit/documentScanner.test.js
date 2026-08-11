// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    scanDocumentForReferences
} from "../../src/references/documentScanner.js";

import {
    makeDocument
} from "./helpers.js";

test("scans references inside line comments", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "// see documentation/a.md",
            "const x = 1; // DOC-42"
        ])
    );

    assert.equal(scanned.length, 2);
    assert.equal(scanned[0].line, 0);
    assert.equal(scanned[1].line, 1);
    assert.equal(scanned[1].reference.type, "documentation");
});

test("ignores references outside comments", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "const url = 'documentation/a.md';",
            "// see documentation/b.md"
        ])
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].reference.file, "documentation/b.md");
});

test("scans inside multiline block comments", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "/*",
            " * see documentation/missing.md",
            " */"
        ])
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].line, 1);
});

test("unsupported languages return no references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument(["# see documentation/a.md"], "css")
    );

    assert.deepEqual(scanned, []);
});

test("marks whole-line hash comment languages", () => {
    const scanned = scanDocumentForReferences(
        makeDocument(
            ["# see documentation/a.md"],
            "python"
        )
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].reference.file, "documentation/a.md");
});

test("go raw string content is not scanned as references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "const help = `see documentation/a.md",
            "// still inside the raw string",
            "more`",
            "// see documentation/b.md"
        ], "go")
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].line, 3);
    assert.equal(scanned[0].reference.file, "documentation/b.md");
});

test("php attribute lines are not scanned as references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "<?php",
            "#[Route(\"/api/checkout\", name: \"checkout\")]",
            "# see documentation/a.md"
        ], "php")
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].reference.file, "documentation/a.md");
});

test("php HTML apostrophes do not hide later comments", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "<p>It's here</p>",
            "<?php",
            "// see documentation/a.md",
            "?>",
            "<p>More text</p>"
        ], "php")
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].line, 2);
    assert.equal(scanned[0].reference.file, "documentation/a.md");
});
