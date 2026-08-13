// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveReference, validateReference } from "../../src/references/resolver.js";

/**
 * @param {Record<string, string>} files absolute path -> content
 */
function makeContext(files) {
  return {
    resolveTargetPath(relativePath) {
      return `/repo/${relativePath}`;
    },
    fs: {
      exists(targetPath) {
        return Object.hasOwn(files, targetPath);
      },
      readText(targetPath) {
        return files[targetPath] ?? null;
      },
    },
  };
}

const DOCUMENTATION_REFERENCE = {
  type: "documentation",
  raw: "documentation/a.md#checkout-flow",
  file: "documentation/a.md",
  anchor: "checkout-flow",
  line: null,
  identifier: null,
};

test("valid documentation reference resolves", () => {
  const result = validateReference(
    DOCUMENTATION_REFERENCE,
    makeContext({
      "/repo/documentation/a.md": "## src/util/foo.js — checkout-flow\n",
    }),
  );

  assert.equal(result.status, "valid");
  assert.equal(result.targetPath, "/repo/documentation/a.md");
  assert.equal(result.message, null);
});

test("missing target file is reported", () => {
  const result = validateReference(DOCUMENTATION_REFERENCE, makeContext({}));

  assert.equal(result.status, "missing-file");
  assert.match(result.message, /not found/);
});

test("path escaping the root is rejected", () => {
  const context = {
    resolveTargetPath() {
      return null;
    },
    fs: {
      exists() {
        return false;
      },
      readText() {
        return null;
      },
    },
  };

  const result = validateReference(DOCUMENTATION_REFERENCE, context);

  assert.equal(result.status, "invalid-path");
});

test("missing anchor is reported", () => {
  const result = validateReference(
    DOCUMENTATION_REFERENCE,
    makeContext({
      "/repo/documentation/a.md": "## src/util/foo.js — other-anchor\n",
    }),
  );

  assert.equal(result.status, "missing-anchor");
  assert.match(result.message, /checkout-flow/);
});

test("plain markdown heading slugs are valid anchors", () => {
  const reference = {
    ...DOCUMENTATION_REFERENCE,
    anchor: "checkout-flow",
  };

  const result = validateReference(
    reference,
    makeContext({
      "/repo/documentation/a.md": "## Checkout Flow\n",
    }),
  );

  assert.equal(result.status, "valid");
});

test("line reference within range is valid", () => {
  const result = validateReference(
    {
      ...DOCUMENTATION_REFERENCE,
      anchor: null,
      line: 2,
    },
    makeContext({
      "/repo/documentation/a.md": "# title\n## src/util/foo.js — checkout-flow\n",
    }),
  );

  assert.equal(result.status, "valid");
  assert.equal(result.line, 2);
});

test("line reference out of range is reported", () => {
  const result = validateReference(
    {
      ...DOCUMENTATION_REFERENCE,
      anchor: null,
      line: 99,
    },
    makeContext({
      "/repo/documentation/a.md": "# title\n",
    }),
  );

  assert.equal(result.status, "invalid-line");
  assert.match(result.message, /99/);
});

test("CRLF target lines are counted correctly", () => {
  const result = validateReference(
    {
      ...DOCUMENTATION_REFERENCE,
      anchor: null,
      line: 3,
    },
    makeContext({
      "/repo/documentation/a.md": "a\r\nb\r\nc\r\n",
    }),
  );

  assert.equal(result.status, "valid");
});

test("unreadable target is treated as valid, not broken", () => {
  const result = validateReference(DOCUMENTATION_REFERENCE, {
    resolveTargetPath() {
      return "/repo/documentation/a.md";
    },
    fs: {
      exists() {
        return true;
      },
      readText() {
        return null;
      },
    },
  });

  assert.equal(result.status, "valid");
});

test("issue, ticket and API references are external", () => {
  for (const reference of [
    {
      type: "issue",
      raw: "#123",
      file: null,
      anchor: null,
      line: null,
      identifier: "123",
      url: null,
    },
    {
      type: "ticket",
      raw: "ENC-78305",
      file: null,
      anchor: null,
      line: null,
      identifier: "ENC-78305",
      url: "https://issues.example.com/browse/ENC-78305",
    },
    {
      type: "api",
      raw: "API:Foo",
      file: null,
      anchor: null,
      line: null,
      identifier: "Foo",
      url: null,
    },
  ]) {
    const result = validateReference(reference, makeContext({}));

    assert.equal(result.status, "external");
  }
});

test("ticket reference carries its resolved url", () => {
  const result = validateReference(
    {
      type: "ticket",
      raw: "ENC-78305",
      file: null,
      anchor: null,
      line: null,
      identifier: "ENC-78305",
      url: "https://issues.example.com/browse/ENC-78305",
    },
    makeContext({}),
  );

  assert.equal(result.status, "external");
  assert.equal(result.url, "https://issues.example.com/browse/ENC-78305");
});

test("resolveReference rejects paths with no file", () => {
  assert.equal(resolveReference({ file: null }, makeContext({})).kind, "external");
});

test("resolveReference rejects escaping paths", () => {
  const context = {
    resolveTargetPath() {
      return null;
    },
    fs: makeContext({}).fs,
  };

  assert.equal(resolveReference({ file: "../secrets.txt" }, context).kind, "invalid-path");
});
