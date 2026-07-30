import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Codebase entièrement en français : les apostrophes (l', d', qu', j'...)
      // et guillemets droits sont omniprésents dans le texte JSX et ne posent
      // aucun risque de rendu (contrairement à `>` ou `}`, qui peuvent
      // réellement casser le parsing JSX si non échappés). Le comportement
      // par défaut de la règle forçait à remplacer des centaines
      // d'apostrophes légitimes par `&apos;`, au détriment de la lisibilité,
      // pour un gain de sécurité nul.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
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
