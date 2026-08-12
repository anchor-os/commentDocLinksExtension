// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fileVersion } from "../../src/scanning/fileVersion.js";

/** @type {string} */
let root;
let seq = 0;

/** @param {string} name @returns {string} */
function tmpPath(name) {
    return path.join(root, name);
}

test.before(() => {
    root = fs.mkdtempSync(
        path.join(os.tmpdir(), "file-version-")
    );
});

test.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

test("fileVersion returns null for a missing file", () => {
    assert.equal(fileVersion(tmpPath(`missing-${++seq}.md`)), null);
});

test("fileVersion token contains mtimeMs and size", () => {
    const file = tmpPath(`doc-${++seq}.md`);

    fs.writeFileSync(file, "abc", "utf8");

    const token = fileVersion(file);

    assert.ok(token, "an existing file must produce a token");
    assert.match(token, /^[\d.]+:\d+$/);
});

test("fileVersion changes when the file content changes", () => {
    const file = tmpPath(`doc-${++seq}.md`);

    fs.writeFileSync(file, "abc", "utf8");
    const before = fileVersion(file);

    fs.writeFileSync(file, "abcde", "utf8");
    const after = fileVersion(file);

    assert.notEqual(after, before);
});
