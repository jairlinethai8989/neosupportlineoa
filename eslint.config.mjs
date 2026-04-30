import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".agent/**",
    "agent-skills/**",
    "scratch/**",
    "check_*.js",
    "scratch_*.js",
    "backfill_*.js",
    "delete_*.js",
    "tests/prepare-e2e.js",
  ]),
]);

export default eslintConfig;
