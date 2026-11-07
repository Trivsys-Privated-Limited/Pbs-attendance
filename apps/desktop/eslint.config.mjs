import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { baseConfig } from "../../eslint.config.base.mjs";

const config = [
  ...baseConfig,
  {
    files: ["src/main/**/*.ts", "src/preload/**/*.ts", "electron.vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
];

export default config;
