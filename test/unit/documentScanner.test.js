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

test("yaml strings and block scalars are not scanned as references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "description: |",
            "  see documentation/a.md #123",
            'title: "#b.md"',
            "key: value#c.md",
            "# see documentation/d.md"
        ], "yaml")
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].line, 4);
    assert.equal(scanned[0].reference.file, "documentation/d.md");
});

test("terraform strings and heredocs are not scanned as references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "# see documentation/a.md",
            'resource "x" {',
            '  description = "#123"',
            "  body = <<EOT",
            "see documentation/b.md #456",
            "EOT",
            "}",
            "// see documentation/c.md"
        ], "terraform")
    );

    assert.equal(scanned.length, 2);
    assert.equal(scanned[0].line, 0);
    assert.equal(scanned[0].reference.file, "documentation/a.md");
    assert.equal(scanned[1].line, 7);
    assert.equal(scanned[1].reference.file, "documentation/c.md");
});

test("graphql strings are not scanned as references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "# see documentation/a.md",
            "type Query {",
            '  field(arg: "#b.md")',
            "}",
            '"""see documentation/c.md #123',
            'still inside # not a comment"""',
            "}"
        ], "graphql")
    );

    assert.equal(scanned.length, 1);
    assert.equal(scanned[0].line, 0);
    assert.equal(scanned[0].reference.file, "documentation/a.md");
});

test("velocity strings and directives are not scanned as references", () => {
    const scanned = scanDocumentForReferences(
        makeDocument([
            "## see documentation/a.md",
            '#set($msg = "see documentation/b.md ##c")',
            "#if($x)",
            "$value ## see documentation/d.md",
            "#end"
        ], "velocity")
    );

    assert.equal(scanned.length, 2);
    assert.equal(scanned[0].line, 0);
    assert.equal(scanned[0].reference.file, "documentation/a.md");
    assert.equal(scanned[1].line, 3);
    assert.equal(scanned[1].reference.file, "documentation/d.md");
});
