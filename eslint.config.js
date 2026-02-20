import { defineConfig } from "eslint/config";

import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
  {
    ignores: [
      "dist",
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
    arrowParens: true,
  }),
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.nodeBuiltin,
      },
      ecmaVersion: 2022,
      sourceType: "module",
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
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylistic,
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": false }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreVoidOperator: true }],
      "@typescript-eslint/no-meaningless-void-operator": "off",
    },
  },
]);
