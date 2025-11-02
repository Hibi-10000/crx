import { defineConfig } from "eslint/config";

import globals from "globals";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
  {
    ignores: [
      "node_modules",
      "src/crx3.pb.js",
      "test",
    ],
  },
  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: false,
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
    },
  },
]);
