// @ts-check
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // scripts/** holds one-off Node/CommonJS dev-infra helpers (e.g.
    // apps/worker/scripts/dev-redis.cjs) — not application source, and
    // written as plain CommonJS on purpose (no build step for them), so
    // they don't fit the TS/ESM rules the rest of the codebase is linted
    // against.
    ignores: ["dist/**", "node_modules/**", "scripts/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
