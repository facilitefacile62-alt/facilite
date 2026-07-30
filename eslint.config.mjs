import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Edge Functions Deno : runtime et globals (Deno.*) distincts du projet
    // Next.js, jamais concernés par le lint/build de l'app.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
