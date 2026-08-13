// @ts-check

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ReferenceDependencyIndex } from "../../src/diagnostics/referenceDependencyIndex.js";
import { getLanguageIdFromExtension } from "../../src/parsers/languageSupport.js";
import { documentFromText } from "../../src/references/document.js";
import { createDocumentScanner } from "../../src/scanning/documentScanning.js";
import { fileVersion } from "../../src/scanning/fileVersion.js";
import { PRIORITY, ScanScheduler } from "../../src/scanning/scanScheduler.js";

import { resolveInRoot } from "../../src/services/pathResolution.js";

/** @type {string} */
let root;

test.before(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "doc-scanning-")));
});

test.after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/**
 * @param {string} relativePath
 * @param {string} content
 */
function writeFixture(relativePath, content) {
  const fullPath = path.join(root, relativePath);

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");

  return fullPath;
}

/**
 * A document-like object with the fields the scanner orchestration reads
 * from a VS Code document.
 *
 * @param {string} fullPath
 * @param {string} languageId
 * @param {string} content
 */
function documentAt(fullPath, languageId, content) {
  return {
    uri: { fsPath: fullPath },
    version: 1,
    ...documentFromText(content, languageId),
  };
}

/**
 * Build the scanner orchestration against the fixture workspace, returning
 * the scanner and the dependency index so tests can observe what was
 * indexed.
 *
 * @param {{ open: string[], active?: string }} state
 */
function harness(state) {
  const dependencyIndex = new ReferenceDependencyIndex();
  const scanner = new ScanScheduler({ concurrency: 3 });

  /** @type {string[]} */
  const diagnosed = [];

  /** @type {string[]} */
  const refreshed = [];

  const openDocuments = new Map();

  for (const relativePath of state.open) {
    const fullPath = path.join(root, relativePath);
    const languageId = getLanguageIdFromExtension(relativePath) ?? "markdown";
    const content = fs.readFileSync(fullPath, "utf8");

    openDocuments.set(fullPath, documentAt(fullPath, languageId, content));
  }

  const documentScanner = createDocumentScanner({
    dependencyIndex,
    scanner,
    contextFor: (fsPath) => ({
      resolveTargetPath(relativePath) {
        return resolveInRoot(root, relativePath);
      },
    }),
    openDocumentByPath: (fsPath) => openDocuments.get(fsPath),
    readFile: async (fsPath) => fs.promises.readFile(fsPath, "utf8"),
    updateDiagnostics: (document) => diagnosed.push(document.uri.fsPath),
    refreshDependents: (fsPath) => refreshed.push(fsPath),
    openDocuments: () => [...openDocuments.values()],
    activeDocument: () =>
      state.active ? openDocuments.get(path.join(root, state.active)) : undefined,
  });

  return {
    documentScanner,
    dependencyIndex,
    scanner,
    diagnosed,
    refreshed,
  };
}

test("open documents publish diagnostics; disk-only scans never do", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");

  const { documentScanner, dependencyIndex, scanner, diagnosed } = harness({
    open: ["src/a.js"],
    active: "src/a.js",
  });

  documentScanner.queueOpenDocument(
    documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n"),
    0,
  );
  await scanner.idle();

  assert.deepEqual(diagnosed, [aPath], "only the open source must publish diagnostics");

  assert.deepEqual(
    dependencyIndex.targetsOf(bPath),
    [path.join(root, "src", "c.js")],
    "the disk-only target must still be indexed",
  );
});

test("disk-only scans never publish diagnostics for the closed target", async () => {
  const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");

  const { documentScanner, dependencyIndex, scanner, diagnosed } = harness({ open: [] });

  documentScanner.queueDocumentAtPath(bPath, 2);
  await scanner.idle();

  assert.deepEqual(diagnosed, [], "a closed document must not publish diagnostics");
  assert.equal(
    dependencyIndex.isCurrent(bPath, fileVersion(bPath)),
    true,
    "the closed target must still be indexed for later use",
  );
});

test("scanning a source refreshes the dependents of its own file", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  writeFixture("documentation/b.md", "## src/c.js — anchorC\n");

  const { documentScanner, scanner, refreshed } = harness({
    open: ["src/a.js"],
    active: "src/a.js",
  });

  documentScanner.queueOpenDocument(
    documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n"),
    0,
  );
  await scanner.idle();

  assert.deepEqual(
    refreshed,
    [aPath],
    "scanning a source must refresh the dependents of that source file",
  );
});

test("referenced targets are pre-scanned and their own targets indexed", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");
  const cPath = writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");

  const { documentScanner, dependencyIndex, scanner } = harness({
    open: ["src/a.js"],
    active: "src/a.js",
  });

  const aDoc = documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n");

  documentScanner.queueOpenDocument(aDoc, 0);
  await scanner.idle();

  assert.deepEqual(
    dependencyIndex.targetsOf(aPath),
    [bPath],
    "the source must be indexed with its target",
  );

  assert.deepEqual(
    dependencyIndex.targetsOf(bPath),
    [cPath],
    "the referenced target must have been pre-scanned and indexed",
  );

  assert.equal(
    dependencyIndex.isCurrent(bPath, fileVersion(bPath)),
    true,
    "the pre-scanned target must carry its file version",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(bPath),
    [aPath],
    "b.md must record the scanned source that references it",
  );
});

test("queueDocumentAtPath indexes a target that is not open", async () => {
  writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");
  const cPath = writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");

  const { documentScanner, dependencyIndex, scanner } = harness({ open: [] });

  documentScanner.queueDocumentAtPath(bPath, 2);
  await scanner.idle();

  assert.deepEqual(
    dependencyIndex.targetsOf(bPath),
    [cPath],
    "the on-disk target must be parsed and indexed",
  );

  assert.equal(
    dependencyIndex.isCurrent(bPath, fileVersion(bPath)),
    true,
    "the on-disk target must carry its file version",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(cPath),
    [bPath],
    "b.md is a dependent of c.js (its heading references it)",
  );

  assert.equal(
    dependencyIndex.isCurrent(cPath, fileVersion(cPath)),
    false,
    "c.js must not be scanned: only the queued target is indexed",
  );
});

test("the same document version is never scanned twice", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");
  writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");

  let bReads = 0;

  const dependencyIndex = new ReferenceDependencyIndex();
  const scanner = new ScanScheduler({ concurrency: 3 });

  const aDoc = documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n");

  const documentScanner = createDocumentScanner({
    dependencyIndex,
    scanner,
    contextFor: (fsPath) => ({
      resolveTargetPath(relativePath) {
        return resolveInRoot(root, relativePath);
      },
    }),
    openDocumentByPath: (fsPath) => (fsPath === aPath ? aDoc : undefined),
    readFile: async (fsPath) => {
      if (fsPath === bPath) {
        bReads++;
      }

      return fs.promises.readFile(fsPath, "utf8");
    },
    updateDiagnostics: () => {},
    refreshDependents: () => {},
    openDocuments: () => [aDoc],
    activeDocument: () => aDoc,
  });

  documentScanner.queueOpenDocument(aDoc, 0);
  await scanner.idle();

  assert.equal(dependencyIndex.isCurrent(aPath, 1), true);

  const targetsAfterFirstScan = dependencyIndex.targetsOf(aPath);

  documentScanner.queueOpenDocument(aDoc, 0);
  documentScanner.queueOpenDocument(aDoc, 1);
  documentScanner.queueOpenDocument(aDoc, 2);

  await scanner.idle();

  assert.deepEqual(dependencyIndex.targetsOf(aPath), targetsAfterFirstScan);
  assert.equal(bReads, 1, "b.md must only be read once across the duplicate enqueues");
});

test("queueAllOpenDocuments scans active first and every other open document", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");
  const cPath = writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");
  const dPath = writeFixture("src/d.js", "// see documentation/missing.md\n");

  const { documentScanner, dependencyIndex, scanner } = harness({
    open: ["src/d.js", "src/a.js", "src/c.js"],
    active: "src/a.js",
  });

  documentScanner.queueAllOpenDocuments();
  await scanner.idle();

  assert.deepEqual(dependencyIndex.targetsOf(aPath), [bPath]);
  assert.deepEqual(dependencyIndex.targetsOf(cPath), [bPath]);
  assert.deepEqual(
    dependencyIndex.targetsOf(bPath),
    [cPath],
    "b.md must be pre-scanned from whichever open source referenced it",
  );
  assert.deepEqual(dependencyIndex.targetsOf(dPath), [
    path.join(root, "documentation", "missing.md"),
  ]);
});

test("renaming a source file re-indexes the new path so dependencies are preserved", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const aRenamedPath = writeFixture("src/a-renamed.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/a.js — anchorA\n");

  const { documentScanner, dependencyIndex, scanner } = harness({ open: [] });

  documentScanner.queueDocumentAtPath(aPath, PRIORITY.OPEN);
  await scanner.idle();

  assert.deepEqual(
    dependencyIndex.dependentsOf(bPath),
    [aPath],
    "the source must be a tracked dependent of its referenced target",
  );

  // Mirror the onDidRenameFiles handler: drop the old path, re-scan the
  // renamed file, and re-scan the documents that referenced the old path.
  const oldDependents = dependencyIndex.dependentsOf(aPath);

  dependencyIndex.remove(aPath);

  documentScanner.queueDocumentAtPath(aRenamedPath, PRIORITY.OPEN);

  for (const dependentPath of oldDependents) {
    documentScanner.queueDocumentAtPath(dependentPath, PRIORITY.OPEN);
  }

  await scanner.idle();

  assert.equal(
    dependencyIndex.isCurrent(aRenamedPath, fileVersion(aRenamedPath)),
    true,
    "the renamed source must be scanned at its new path",
  );

  assert.deepEqual(
    dependencyIndex.targetsOf(aRenamedPath),
    [bPath],
    "the renamed source must keep its original dependencies",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(bPath),
    [aRenamedPath],
    "the renamed source must remain a dependent of its target",
  );

  assert.equal(
    dependencyIndex.isCurrent(aPath, fileVersion(aPath)),
    false,
    "the old path must no longer be indexed",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(aPath),
    [],
    "nothing may depend on the old source path",
  );
});

test("renaming a referenced target re-scans dependents so they discover the new path", async () => {
  const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
  const bPath = writeFixture("documentation/b.md", "## src/a.js — anchorA\n");
  const cPath = writeFixture("documentation/c.md", "## src/a.js — anchorA\n");

  const { documentScanner, dependencyIndex, scanner } = harness({ open: [] });

  documentScanner.queueDocumentAtPath(aPath, PRIORITY.OPEN);
  await scanner.idle();

  assert.deepEqual(
    dependencyIndex.dependentsOf(bPath),
    [aPath],
    "a.js must depend on the old target path before the rename",
  );

  // Mirror the onDidRenameFiles handler after the user moves b.md to c.md
  // and updates a.js to reference the new name. The rewrite changes the
  // file's byte length so the fileVersion token changes independently of
  // filesystem mtime granularity.
  writeFixture("src/a.js", "// renamed target\n// see documentation/c.md#anchorA\n");

  const oldDependents = dependencyIndex.dependentsOf(bPath);

  dependencyIndex.remove(bPath);

  documentScanner.queueDocumentAtPath(cPath, PRIORITY.OPEN);

  for (const dependentPath of oldDependents) {
    documentScanner.queueDocumentAtPath(dependentPath, PRIORITY.OPEN);
  }

  await scanner.idle();

  assert.deepEqual(
    dependencyIndex.targetsOf(aPath),
    [cPath],
    "the dependent must be re-scanned and discover the renamed target",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(cPath),
    [aPath],
    "future changes to the renamed target must refresh the dependent",
  );

  assert.deepEqual(
    dependencyIndex.targetsOf(cPath),
    [aPath],
    "the renamed target must itself be re-scanned at its new path",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(bPath),
    [],
    "the old target path must no longer track dependents",
  );
});

test("a slow disk scan cannot overwrite the state written by a newer scan of the same path", async () => {
  const aPath = writeFixture("race/a.js", "// see race/old.md#anchorA\n");
  const oldTargetPath = writeFixture("race/old.md", "# old\n");
  const newTargetPath = writeFixture("race/new.md", "# new\n");

  const staleText = fs.readFileSync(aPath, "utf8");

  const dependencyIndex = new ReferenceDependencyIndex();
  const scanner = new ScanScheduler({ concurrency: 3 });

  let reads = 0;
  let concurrentReads = 0;
  let maxConcurrentReads = 0;
  let release;

  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const documentScanner = createDocumentScanner({
    dependencyIndex,
    scanner,
    contextFor: () => ({
      resolveTargetPath(relativePath) {
        return resolveInRoot(root, relativePath);
      },
    }),
    openDocumentByPath: () => undefined,
    readFile: async (fsPath) => {
      reads++;
      concurrentReads++;
      maxConcurrentReads = Math.max(maxConcurrentReads, concurrentReads);

      try {
        // The first read is slow and observes the pre-change bytes,
        // which is exactly the situation in which a stale job could
        // publish its result last.
        if (reads === 1) {
          await gate;
          return staleText;
        }

        return await fs.promises.readFile(fsPath, "utf8");
      } finally {
        concurrentReads--;
      }
    },
    updateDiagnostics: () => {},
    refreshDependents: () => {},
    openDocuments: () => [],
    activeDocument: () => undefined,
  });

  documentScanner.queueDocumentAtPath(aPath, PRIORITY.TARGET);

  // Wait for the first job to reach its (blocked) read.
  while (reads === 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  // The file changes on disk and a fresh scan is queued while the older
  // job is still in flight.
  writeFixture("race/a.js", "// updated\n// see race/new.md#anchorA\n");

  documentScanner.queueDocumentAtPath(aPath, PRIORITY.ACTIVE);

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(maxConcurrentReads, 1, "two scans of the same path must never run concurrently");

  release();

  await scanner.idle();

  assert.deepEqual(
    dependencyIndex.targetsOf(aPath),
    [newTargetPath],
    "the newest scan must win; the stale job may not overwrite it",
  );

  assert.deepEqual(
    dependencyIndex.dependentsOf(oldTargetPath),
    [],
    "the stale target must not survive in the dependency index",
  );

  assert.equal(
    dependencyIndex.isCurrent(aPath, fileVersion(aPath)),
    true,
    "the index must be marked current at the on-disk version",
  );
});
