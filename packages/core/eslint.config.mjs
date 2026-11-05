import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // ADR 0001 §4.3: the core runs in the browser too. Node.js modules are only allowed in tests.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/testing/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["node:*", "fs", "path"], message: "packages/core must not depend on Node.js (ADR 0001 §4.3)." }] }],
    },
  },
);
