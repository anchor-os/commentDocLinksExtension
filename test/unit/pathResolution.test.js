// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import {
    chooseRoot,
    findCheckoutRoot,
    resolveInRoot
} from "../../src/services/pathResolution.js";

const ROOT = path.parse(process.cwd()).root;

const REPO = path.join(ROOT, "repo");
const WORKTREE = path.join(REPO, "worktrees", "feature");
const WORKTREE_SRC = path.join(WORKTREE, "src", "util");
const REPO_SRC = path.join(REPO, "src", "util");
const SUBFOLDER = path.join(REPO, "subfolder");
const ELSEWHERE = path.join(ROOT, "elsewhere");
const NO_REPO = path.join(ROOT, "no", "repo", "here");
const FOO_JS = path.join("src", "util", "foo.js");

test("findCheckoutRoot returns the nearest linked worktree root", () => {
    const hasEntry = (candidate) =>
        candidate === REPO ||
        candidate === WORKTREE;

    assert.equal(
        findCheckoutRoot(WORKTREE_SRC, hasEntry),
        WORKTREE
    );
});

test("findCheckoutRoot returns the main repository root", () => {
    const hasEntry = (candidate) => candidate === REPO;

    assert.equal(
        findCheckoutRoot(REPO_SRC, hasEntry),
        REPO
    );
});

test("findCheckoutRoot returns null outside any repository", () => {
    assert.equal(
        findCheckoutRoot(NO_REPO, () => false),
        null
    );
});

test("findCheckoutRoot accepts a directory that is itself a root", () => {
    const hasEntry = (candidate) => candidate === REPO;

    assert.equal(
        findCheckoutRoot(REPO, hasEntry),
        REPO
    );
});

test("resolveInRoot resolves a nested path", () => {
    assert.equal(
        resolveInRoot(REPO, "src/util/foo.js"),
        path.join(REPO, FOO_JS)
    );
});

test("resolveInRoot rejects escaping paths", () => {
    assert.equal(
        resolveInRoot(REPO, "../secret.txt"),
        null
    );
});

test("resolveInRoot rejects absolute paths", () => {
    assert.equal(
        resolveInRoot(REPO, path.join(ROOT, "etc", "passwd")),
        null
    );
});

test("chooseRoot prefers the deepest root that contains the document", () => {
    const root = chooseRoot(
        [REPO, WORKTREE],
        path.join(WORKTREE, FOO_JS)
    );

    assert.equal(root, WORKTREE);
});

test("chooseRoot keeps the workspace folder when it is inside the checkout", () => {
    const root = chooseRoot(
        [REPO, SUBFOLDER],
        path.join(SUBFOLDER, FOO_JS)
    );

    assert.equal(root, SUBFOLDER);
});

test("chooseRoot ignores roots that do not contain the document", () => {
    const root = chooseRoot(
        [REPO, ELSEWHERE],
        path.join(REPO, FOO_JS)
    );

    assert.equal(root, REPO);
});

test("chooseRoot falls back to the first root without a context path", () => {
    assert.equal(
        chooseRoot([REPO], undefined),
        REPO
    );
});

test("resolveInRoot rejects a symlink escaping the root", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cdl-root-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cdl-out-"));
    const link = path.join(dir, "escape");

    try {
        fs.symlinkSync(outside, link);

        assert.equal(
            resolveInRoot(dir, path.join("escape", "secret.txt")),
            null
        );
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(outside, { recursive: true, force: true });
    }
});

test("resolveInRoot follows a symlink that stays inside the root", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cdl-root-"));
    const real = path.join(dir, "real");
    const link = path.join(dir, "alias");

    try {
        fs.mkdirSync(real);
        fs.symlinkSync(real, link);

        assert.equal(
            resolveInRoot(dir, path.join("alias", "file.md")),
            path.join(fs.realpathSync(real), "file.md")
        );
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("resolveInRoot resolves a symlinked root", () => {
    const realRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cdl-real-"));
    const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cdl-link-"));
    const link = path.join(linkRoot, "workspace");

    try {
        fs.symlinkSync(realRoot, link);

        assert.equal(
            resolveInRoot(link, "docs/file.md"),
            path.join(fs.realpathSync(realRoot), "docs", "file.md")
        );
    } finally {
        fs.rmSync(realRoot, { recursive: true, force: true });
        fs.rmSync(linkRoot, { recursive: true, force: true });
    }
});
