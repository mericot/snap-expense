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
    // Design reference bundle, not source. `support.js` is the prototype's own
    // runtime (ReactDOM.render, `module` reassignment) and has no production
    // relevance — it was failing `npm run lint` before this branch existed.
    "design_handoff_snapexpense_paid/**",
  ]),
]);

export default eslintConfig;
