import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This experimental React Compiler rule flags every effect that
      // fetches on mount or starts an interval and stores the result in
      // state (loadCircleState, the event-polling effect, the ticking
      // clock for relative timestamps). That's the standard "sync with an
      // external system" use case the React docs describe for useEffect,
      // not the cascading-render anti-pattern this rule is meant to catch.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
