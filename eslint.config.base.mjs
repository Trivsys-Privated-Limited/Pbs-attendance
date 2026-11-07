// Shared ESLint flat-config building blocks for all workspaces.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** Base TypeScript rules shared by every package and app. */
export const baseConfig = tseslint.config(
  {
    ignores: ["**/dist/**", "**/out/**", "**/.next/**", "**/node_modules/**", "**/release/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      eqeqeq: ["error", "always"],
    },
  },
  prettier,
);

export default baseConfig;
