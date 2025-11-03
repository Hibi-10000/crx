import { defineConfig } from "eslint/config";

import globals from "globals";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
  {
    ignores: [
      "node_modules",
      "src/crx3.pb.js",
    ],
  },
  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: false,
    quoteProps: "as-needed",
  }),
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.nodeBuiltin,
      },
      ecmaVersion: 2018,
    },
    extends: [
      eslint.configs.recommended,
    ],
    rules: {
      "@stylistic/spaced-comment": 0,
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "prefer-arrow-callback": "error",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
    },
  },
]);
