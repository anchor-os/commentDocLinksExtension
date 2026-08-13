// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  documentsToRefresh,
  ReferenceDependencyIndex,
  targetsReferencedBy,
} from "../../src/diagnostics/referenceDependencyIndex.js";

import { makeDocument } from "./helpers.js";

/**
 * A reference context whose resolver maps every relative path below a root.
 *
 * @param {string} root
 */
function contextFor(root) {
  return {
    resolveTargetPath(relativePath) {
      return `${root}/${relativePath}`;
    },
  };
}

test("targetsReferencedBy extracts resolved comment targets", () => {
  const document = makeDocument([
    "// see documentation/a.md#anchor",
    "// see documentation/b.md",
    "// Fixes #123",
    "// Uses API:Checkout",
  ]);

  const targets = targetsReferencedBy(document, contextFor("/root"));

  assert.deepEqual([...targets], ["/root/documentation/a.md", "/root/documentation/b.md"]);
});

test("targetsReferencedBy extracts resolved markdown targets", () => {
  const document = makeDocument(
    [
      "## src/util/foo.js — checkout-flow",
      "## src/util/bar.js - some-anchor",
      "## src/util/baz.js#other-anchor",
      "# A plain heading is ignored",
    ],
    "markdown",
  );

  const targets = targetsReferencedBy(document, contextFor("/root"));

  assert.deepEqual(
    [...targets],
    ["/root/src/util/foo.js", "/root/src/util/bar.js", "/root/src/util/baz.js"],
  );
});

test("targetsReferencedBy records paths even when the file does not exist", () => {
  const document = makeDocument(["// see documentation/not-created-yet.md"]);

  const targets = targetsReferencedBy(document, contextFor("/root"));

  assert.deepEqual([...targets], ["/root/documentation/not-created-yet.md"]);
});

test("references that fail to resolve produce no dependency", () => {
  const document = makeDocument(["// see documentation/a.md", "// see blocked.md"]);

  const context = {
    resolveTargetPath(relativePath) {
      return relativePath === "blocked.md" ? null : `/root/${relativePath}`;
    },
  };

  const targets = targetsReferencedBy(document, context);

  assert.deepEqual([...targets], ["/root/documentation/a.md"]);
});

test("dependentsOf returns every source that references a target", () => {
  const index = new ReferenceDependencyIndex();

  index.set(
    "/ws/src/foo.js",
    targetsReferencedBy(makeDocument(["// see documentation/api.md"]), contextFor("/ws")),
  );
  index.set(
    "/ws/main.tf",
    targetsReferencedBy(
      makeDocument(["// see documentation/api.md", "// see documentation/other.md"], "terraform"),
      contextFor("/ws"),
    ),
  );

  assert.deepEqual(index.dependentsOf("/ws/documentation/api.md"), [
    "/ws/src/foo.js",
    "/ws/main.tf",
  ]);

  assert.deepEqual(index.dependentsOf("/ws/documentation/other.md"), ["/ws/main.tf"]);

  assert.deepEqual(index.dependentsOf("/ws/documentation/unrelated.md"), []);
});

test("replacing a source's references removes stale reverse entries", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/a.md", "/ws/documentation/b.md"]));

  assert.deepEqual(index.dependentsOf("/ws/documentation/a.md"), ["/ws/src/foo.js"]);

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/c.md"]));

  assert.deepEqual(
    index.dependentsOf("/ws/documentation/a.md"),
    [],
    "old target a.md must no longer list foo.js",
  );
  assert.deepEqual(
    index.dependentsOf("/ws/documentation/b.md"),
    [],
    "old target b.md must no longer list foo.js",
  );
  assert.deepEqual(index.dependentsOf("/ws/documentation/c.md"), ["/ws/src/foo.js"]);

  assert.equal(index.sourceCount(), 1);
  assert.equal(index.targetCount(), 1);
});

test("removing a closed source cleans up every entry", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/a.md"]));
  index.set("/ws/src/bar.js", new Set(["/ws/documentation/a.md"]));

  index.remove("/ws/src/foo.js");

  assert.deepEqual(
    index.dependentsOf("/ws/documentation/a.md"),
    ["/ws/src/bar.js"],
    "bar.js must remain a dependent of a.md",
  );
  assert.equal(index.sourceCount(), 1);

  index.remove("/ws/src/bar.js");

  assert.deepEqual(
    index.dependentsOf("/ws/documentation/a.md"),
    [],
    "no dependents may remain after both sources close",
  );
  assert.equal(index.sourceCount(), 0);
  assert.equal(index.targetCount(), 0);
});

test("worktrees with the same relative path stay isolated", () => {
  const index = new ReferenceDependencyIndex();

  index.set(
    "/repo/worktrees/feature/src/foo.js",
    targetsReferencedBy(
      makeDocument(["// see documentation/api.md"]),
      contextFor("/repo/worktrees/feature"),
    ),
  );
  index.set(
    "/repo/src/foo.js",
    targetsReferencedBy(makeDocument(["// see documentation/api.md"]), contextFor("/repo")),
  );

  assert.deepEqual(index.dependentsOf("/repo/worktrees/feature/documentation/api.md"), [
    "/repo/worktrees/feature/src/foo.js",
  ]);

  assert.deepEqual(index.dependentsOf("/repo/documentation/api.md"), ["/repo/src/foo.js"]);
});

test("documentsToRefresh returns only the changed document and its dependents", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/api.md"]));
  index.set("/ws/src/bar.js", new Set(["/ws/documentation/other.md"]));
  index.set("/ws/main.tf", new Set(["/ws/documentation/api.md"]));

  const open = new Set([
    "/ws/src/foo.js",
    "/ws/src/bar.js",
    "/ws/main.tf",
    "/ws/documentation/api.md",
  ]);

  const toRefresh = documentsToRefresh(index, "/ws/documentation/api.md", open);

  assert.deepEqual(
    toRefresh.sort(),
    ["/ws/documentation/api.md", "/ws/main.tf", "/ws/src/foo.js"],
    "bar.js (which references other.md) must not be refreshed",
  );
});

test("documentsToRefresh skips dependents that are not open", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/api.md"]));
  index.set("/ws/src/closed.js", new Set(["/ws/documentation/api.md"]));

  const toRefresh = documentsToRefresh(
    index,
    "/ws/documentation/api.md",
    new Set(["/ws/src/foo.js"]),
  );

  assert.deepEqual(toRefresh, ["/ws/src/foo.js"]);
});

test("changing a target refreshes dependents and never unrelated documents", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/api.md"]));
  index.set("/ws/src/bar.js", new Set(["/ws/documentation/other.md"]));

  const open = new Set([
    "/ws/src/foo.js",
    "/ws/src/bar.js",
    "/ws/documentation/api.md",
    "/ws/documentation/other.md",
  ]);

  assert.deepEqual(documentsToRefresh(index, "/ws/documentation/other.md", open).sort(), [
    "/ws/documentation/other.md",
    "/ws/src/bar.js",
  ]);
});

test("isCurrent skips duplicate scans of an unchanged version", () => {
  const index = new ReferenceDependencyIndex();
  const version = "1700000000000:42";

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/a.md"]), version);

  assert.equal(
    index.isCurrent("/ws/src/foo.js", version),
    true,
    "same version must count as scanned",
  );
});

test("a changed version must be re-scanned and replaces the last targets", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/a.md"]), "v1");
  assert.equal(index.isCurrent("/ws/src/foo.js", "v1"), true);
  assert.deepEqual(index.targetsOf("/ws/src/foo.js"), ["/ws/documentation/a.md"]);

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/b.md"]), "v2");

  assert.equal(index.isCurrent("/ws/src/foo.js", "v1"), false);
  assert.equal(index.isCurrent("/ws/src/foo.js", "v2"), true);
  assert.deepEqual(index.targetsOf("/ws/src/foo.js"), ["/ws/documentation/b.md"]);
  assert.deepEqual(
    index.dependentsOf("/ws/documentation/a.md"),
    [],
    "old target must no longer list foo.js after version change",
  );
});

test("remove clears the recorded version", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/a.md"]), "v1");

  assert.equal(index.isCurrent("/ws/src/foo.js", "v1"), true);

  index.remove("/ws/src/foo.js");

  assert.equal(index.isCurrent("/ws/src/foo.js", "v1"), false);
  assert.deepEqual(index.targetsOf("/ws/src/foo.js"), []);
  assert.equal(index.sourceCount(), 0);
});

test("reset clears recorded versions", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/foo.js", new Set(["/ws/documentation/a.md"]), "v1");

  index.reset();

  assert.equal(index.isCurrent("/ws/src/foo.js", "v1"), false);
  assert.equal(index.sourceCount(), 0);
  assert.equal(index.targetCount(), 0);
});

test("a source with no targets records its version but no entries", () => {
  const index = new ReferenceDependencyIndex();

  index.set("/ws/src/quiet.js", new Set(), "v1");

  assert.equal(
    index.isCurrent("/ws/src/quiet.js", "v1"),
    true,
    "an empty scan must still be remembered so it is not re-scanned",
  );
  assert.deepEqual(index.targetsOf("/ws/src/quiet.js"), []);
  assert.equal(index.sourceCount(), 0);
  assert.equal(index.targetCount(), 0);

  index.remove("/ws/src/quiet.js");

  assert.equal(
    index.isCurrent("/ws/src/quiet.js", "v1"),
    false,
    "remove must clear the recorded version of an empty scan",
  );
});
