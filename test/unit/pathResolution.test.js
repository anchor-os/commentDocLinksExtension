// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
    chooseRoot,
    findCheckoutRoot,
    resolveInRoot
} from "../../src/services/pathResolution.js";

test("findCheckoutRoot returns the nearest linked worktree root", () => {
    const hasEntry = (candidate) =>
        candidate === "/repo" ||
        candidate === "/repo/worktrees/feature";

    assert.equal(
        findCheckoutRoot(
            "/repo/worktrees/feature/src/util",
            hasEntry
        ),
        "/repo/worktrees/feature"
    );
});

test("findCheckoutRoot returns the main repository root", () => {
    const hasEntry = (candidate) => candidate === "/repo";

    assert.equal(
        findCheckoutRoot("/repo/src/util", hasEntry),
        "/repo"
    );
});

test("findCheckoutRoot returns null outside any repository", () => {
    assert.equal(
        findCheckoutRoot("/no/repo/here", () => false),
        null
    );
});

test("findCheckoutRoot accepts a directory that is itself a root", () => {
    const hasEntry = (candidate) => candidate === "/repo";

    assert.equal(
        findCheckoutRoot("/repo", hasEntry),
        "/repo"
    );
});

test("resolveInRoot resolves a nested path", () => {
    assert.equal(
        resolveInRoot("/repo", "src/util/foo.js"),
        path.join("/repo", "src/util/foo.js")
    );
});

test("resolveInRoot rejects escaping paths", () => {
    assert.equal(
        resolveInRoot("/repo", "../secret.txt"),
        null
    );
});

test("resolveInRoot rejects absolute paths", () => {
    assert.equal(
        resolveInRoot("/repo", "/etc/passwd"),
        null
    );
});

test("chooseRoot prefers the deepest root that contains the document", () => {
    const root = chooseRoot(
        ["/repo", "/repo/worktrees/feature"],
        "/repo/worktrees/feature/src/util/foo.js"
    );

    assert.equal(root, "/repo/worktrees/feature");
});

test("chooseRoot keeps the workspace folder when it is inside the checkout", () => {
    const root = chooseRoot(
        ["/repo", "/repo/subfolder"],
        "/repo/subfolder/src/util/foo.js"
    );

    assert.equal(root, "/repo/subfolder");
});

test("chooseRoot ignores roots that do not contain the document", () => {
    const root = chooseRoot(
        ["/repo", "/elsewhere"],
        "/repo/src/util/foo.js"
    );

    assert.equal(root, "/repo");
});

test("chooseRoot falls back to the first root without a context path", () => {
    assert.equal(
        chooseRoot(["/repo"], undefined),
        "/repo"
    );
});
