// @ts-check

import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "test/e2e/**/*.test.js",
  workspaceFolder: "test/fixtures/workspace",
  enableModuleResolver: "node",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
