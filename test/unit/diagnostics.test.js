// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    collectBrokenReferences
} from "../../src/diagnostics/brokenReferenceScanner.js";

import {
    makeDocument
} from "./helpers.js";

/**
 * @param {Record<string, string>} files path -> content
 */
function makeFileSystem(files) {
    return {
        exists(relativePath) {
            return Object.prototype.hasOwnProperty.call(
                files,
                relativePath
            );
        },
        readText(relativePath) {
            return files[relativePath] ?? null;
        }
    };
}

test("missing documentation file is reported", () => {
    const line = "// see documentation/missing.md";
    const document = makeDocument([line]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({}),
        ""
    );

    const start = line.indexOf("documentation");

    assert.deepEqual(broken, [{
        line: 0,
        start,
        end: start + "documentation/missing.md".length,
        message: "Documentation file not found: documentation/missing.md"
    }]);
});

test("existing file with missing anchor is reported", () => {
    const line = "// see documentation/a.md#ghost-anchor";
    const document = makeDocument([line]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md": "# title\n"
        }),
        ""
    );

    const start = line.indexOf("documentation");

    assert.deepEqual(broken, [{
        line: 0,
        start,
        end: start + "documentation/a.md#ghost-anchor".length,
        message: "Documentation anchor not found: ghost-anchor"
    }]);
});

test("existing file with matching anchor is not reported", () => {
    const document = makeDocument([
        "// see documentation/a.md#real-anchor"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md":
                "## src/util/foo.js — real-anchor\n"
        }),
        ""
    );

    assert.deepEqual(broken, []);
});

test("CRLF target with matching anchor is not reported", () => {
    const document = makeDocument([
        "// see documentation/a.md#real-anchor"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md":
                "## src/util/foo.js — real-anchor\r\n"
        }),
        ""
    );

    assert.deepEqual(broken, []);
});

test("bare-CR target with matching anchor is not reported", () => {
    const document = makeDocument([
        "// see documentation/a.md#real-anchor"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md":
                "intro\r## src/util/foo.js — real-anchor\r"
        }),
        ""
    );

    assert.deepEqual(broken, []);
});

test("existing file without anchor is not reported", () => {
    const document = makeDocument([
        "// see documentation/a.md"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md": "# title\n"
        }),
        ""
    );

    assert.deepEqual(broken, []);
});

test("line reference beyond the file is reported", () => {
    const line = "// see documentation/a.md:99";
    const document = makeDocument([line]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md": "# title\n## src/util/foo.js — a\n"
        }),
        ""
    );

    const start = line.indexOf("documentation");

    assert.deepEqual(broken, [{
        line: 0,
        start,
        end: start + "documentation/a.md:99".length,
        message: "Documentation line out of range: 99"
    }]);
});

test("line reference within the file is not reported", () => {
    const document = makeDocument([
        "// see documentation/a.md#L2"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/a.md": "# title\n## src/util/foo.js — a\n"
        }),
        ""
    );

    assert.deepEqual(broken, []);
});

test("line reference to a missing file is reported as missing", () => {
    const line = "// see documentation/missing.md:5";
    const document = makeDocument([line]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({}),
        ""
    );

    const start = line.indexOf("documentation");

    assert.deepEqual(broken, [{
        line: 0,
        start,
        end: start + "documentation/missing.md:5".length,
        message: "Documentation file not found: documentation/missing.md"
    }]);
});

test("unreadable target file is skipped, not reported", () => {
    const document = makeDocument([
        "// see documentation/a.md#anything"
    ]);

    const broken = collectBrokenReferences(
        document,
        {
            exists() {
                return true;
            },
            readText() {
                return null;
            }
        },
        ""
    );

    assert.deepEqual(broken, []);
});

test("markdown heading to missing source file is reported", () => {
    const line = "## src/util/missing.js — some-anchor";
    const document = makeDocument([line], "markdown");

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({}),
        "documentation/a.md"
    );

    const start = line.indexOf("src/util/missing.js");

    assert.deepEqual(broken, [{
        line: 0,
        start,
        end: start + "src/util/missing.js".length,
        message: "Source file not found: src/util/missing.js"
    }]);
});

test("markdown heading with missing source anchor is reported", () => {
    const line = "## src/util/foo.js — ghost-anchor";
    const document = makeDocument([line], "markdown");

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "src/util/foo.js":
                "// see documentation/a.md#different-anchor\n"
        }),
        "documentation/a.md"
    );

    const start = line.indexOf("src/util/foo.js");

    assert.deepEqual(broken, [{
        line: 0,
        start,
        end: start + "src/util/foo.js".length,
        message: "Source anchor not found: ghost-anchor"
    }]);
});

test("markdown heading with matching source anchor is not reported", () => {
    const document = makeDocument([
        "## src/util/foo.js — real-anchor"
    ], "markdown");

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "src/util/foo.js":
                "// see documentation/a.md#real-anchor\n"
        }),
        "documentation/a.md"
    );

    assert.deepEqual(broken, []);
});

test("markdown heading pointing at a markdown target skips anchor check", () => {
    const document = makeDocument([
        "## documentation/other.md — anything"
    ], "markdown");

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({
            "documentation/other.md": "# whatever\n"
        }),
        "documentation/a.md"
    );

    assert.deepEqual(broken, []);
});

test("references inside block comments are checked", () => {
    const document = makeDocument([
        "/*",
        " * see documentation/missing.md",
        " */"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({}),
        ""
    );

    assert.equal(broken.length, 1);
    assert.equal(broken[0].line, 1);
    assert.equal(
        broken[0].message,
        "Documentation file not found: documentation/missing.md"
    );
});

test("issue, DOC ticket and API references are external, not broken", () => {
    const document = makeDocument([
        "// track #123, DOC-42 and API:Checkout"
    ]);

    const broken = collectBrokenReferences(
        document,
        makeFileSystem({}),
        ""
    );

    assert.deepEqual(broken, []);
});
