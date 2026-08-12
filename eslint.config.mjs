import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next. Patterns are `**/`-prefixed
  // rather than root-relative: this repo routinely checks out worktrees as real
  // subdirectories (`.claude/worktrees/*`), each with its own `.next` build
  // output and its own copy of the design handoff bundle, and a root-relative
  // glob doesn't reach into those — a lint run from the repo root would then
  // walk straight into a worktree's build artifacts.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    // Design reference bundle, not source. `support.js` is the prototype's own
    // runtime (ReactDOM.render, `module` reassignment) and has no production
    // relevance — it was failing `npm run lint` before this branch existed.
    "**/design_handoff_snapexpense_paid/**",
  ]),
]);

export default eslintConfig;
