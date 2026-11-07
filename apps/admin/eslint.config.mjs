import nextVitals from "eslint-config-next/core-web-vitals";
import { baseConfig } from "../../eslint.config.base.mjs";

const config = [{ ignores: [".next/**", "next-env.d.ts"] }, ...nextVitals, ...baseConfig];

export default config;
