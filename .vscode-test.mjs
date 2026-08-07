// @ts-check

import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
    files: "test/e2e/**/*.test.js",
    enableModuleResolver: "node",
    mocha: {
        ui: "tdd",
        timeout: 20000
    }
});
