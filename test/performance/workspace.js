// @ts-check

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Sizes used for the performance workload. Large is deliberately big enough
 * that naive whole-workspace scanning would be visible.
 */
export const WORKSPACE_SIZES = {
  small: { sourceFiles: 10, docFiles: 10 },
  medium: { sourceFiles: 100, docFiles: 100 },
  large: { sourceFiles: 1000, docFiles: 1000 },
};

export const REFERENCES_PER_FILE = 5;

/**
 * Deterministic pseudo-random generator so every run uses identical content.
 */
function makeRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * @param {string} sourcePath
 * @returns {string}
 */
function sourceContent(sourcePath) {
  const base = path.basename(sourcePath, ".js");
  const lines = [
    "/**",
    " * Module for the performance workload.",
    ` * @see src/${base}.js`,
    " */",
    "export function run() {",
    "    return 42;",
    "}",
  ];

  return lines.join("\n");
}

/**
 * A source file carrying five anchor references to its documentation file.
 * The anchors match headings in the corresponding markdown file.
 *
 * @param {string} sourcePath
 * @param {string} docPath
 * @returns {string}
 */
function referencingSourceContent(sourcePath, docPath) {
  const base = path.basename(sourcePath, ".js");
  const docName = path.basename(docPath);
  const lines = [
    "/**",
    " * Documentation for this module.",
    ` * → documentation/${docName}#${base}`,
    ` * → documentation/${docName}#section-one`,
    ` * → documentation/${docName}#section-two`,
    ` * → documentation/${docName}#section-three`,
    ` * → documentation/${docName}#section-four`,
    " *",
    " * @see documentation/overview.md",
    " */",
    "export function run() {",
    "    return 42;",
    "}",
  ];

  return lines.join("\n");
}

/**
 * @param {string} docPath
 * @returns {string}
 */
function documentationContent(docPath) {
  const base = path.basename(docPath, ".md");
  const lines = [
    `# ${base}`,
    "",
    `## src/${base}.js — ${base}`,
    "",
    "## Section One",
    "",
    "Content under section one.",
    "",
    "## Section Two",
    "",
    "Content under section two.",
    "",
    "## Section Three",
    "",
    "Content under section three.",
    "",
    "## Section Four",
    "",
    "Content under section four.",
  ];

  return lines.join("\n");
}

/**
 * @param {string} docPath
 * @param {string} sourcePath
 * @returns {string}
 */
function overviewDocumentationContent(docPath, sourcePath) {
  const base = path.basename(sourcePath, ".js");

  return [
    "# Overview",
    "",
    `## src/${base}.js — ${base}`,
    "",
    "A shared overview that many source files reference.",
  ].join("\n");
}

/**
 * Generate a synthetic workspace and return its layout.
 *
 * @param {string} key One of the {@link WORKSPACE_SIZES} keys.
 * @returns {{
 *   root: string,
 *   sourceFiles: string[],
 *   docFiles: string[],
 *   overviewFile: string
 * }}
 */
export function createWorkspace(key) {
  const sizes = WORKSPACE_SIZES[key];

  if (!sizes) {
    throw new Error(`Unknown workspace size: ${key}`);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), `cdl-perf-${key}-`));

  const srcDir = path.join(root, "src");
  const docDir = path.join(root, "documentation");

  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(docDir, { recursive: true });

  const random = makeRandom(1234);
  const sourceFiles = [];
  const docFiles = [];

  for (let i = 0; i < sizes.sourceFiles; i++) {
    const shuffle = Math.floor(random() * sizes.docFiles);
    const sourcePath = path.join(srcDir, `mod-${i}.js`);
    const docPath = path.join(docDir, `doc-${shuffle}.md`);

    fs.writeFileSync(sourcePath, referencingSourceContent(sourcePath, docPath), "utf8");

    sourceFiles.push(sourcePath);
  }

  for (let i = 0; i < sizes.docFiles; i++) {
    const docPath = path.join(docDir, `doc-${i}.md`);
    const sourcePath = path.join(srcDir, `mod-${i}.js`);

    fs.writeFileSync(docPath, documentationContent(docPath), "utf8");

    docFiles.push(docPath);
  }

  const overviewFile = path.join(docDir, "overview.md");

  fs.writeFileSync(
    overviewFile,
    overviewDocumentationContent(overviewFile, sourceFiles[0]),
    "utf8",
  );

  assertReferencedDocsExist(root, sourceFiles);

  return { root, sourceFiles, docFiles, overviewFile };
}

/**
 * Every source reference must point at a documentation file that actually
 * exists, so the harness measures real reference resolution rather than
 * misspellings. Throws if a generated reference has drifted from the
 * fixture layout.
 *
 * @param {string} root
 * @param {string[]} sourceFiles
 */
function assertReferencedDocsExist(root, sourceFiles) {
  const referencePattern = /→ documentation\/([^\s#]+\.md)#[A-Za-z0-9_-]+/g;

  for (const sourcePath of sourceFiles) {
    const content = fs.readFileSync(sourcePath, "utf8");

    for (const match of content.matchAll(referencePattern)) {
      const docPath = path.join(root, "documentation", match[1]);

      assert.ok(
        fs.existsSync(docPath),
        `generated reference in ${sourcePath} points at ` + `missing documentation/${match[1]}`,
      );
    }
  }
}

/**
 * @param {string} root
 */
export function removeWorkspace(root) {
  fs.rmSync(root, { recursive: true, force: true });
}
