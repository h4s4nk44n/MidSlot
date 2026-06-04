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
  ]),
  // MEDI-97: introduce a green lint gate over the existing codebase.
  // The rules below flag pre-existing patterns under the strict Next 16 /
  // React 19 ruleset (legacy `any`, setState-during-hydration effects,
  // unescaped JSX entities, etc.). They are downgraded from error to warning
  // so CI can lint the frontend without a risky bulk component rewrite — the
  // warnings stay visible and can be burned down incrementally. The backend
  // treats `no-explicit-any` the same way.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
]);

export default eslintConfig;
