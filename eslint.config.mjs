import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // "console.log 커밋 금지"(CLAUDE.md Hard Constraint)를 문서가 아닌 lint 게이트로 강제.
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // 의도적 예외: NEXT_PUBLIC_API_DEBUG 로 게이트된 API 디버그 로거.
    files: ["lib/api/client.ts", "lib/api/server.ts"],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Storybook build output.
    "storybook-static/**",
    // Generated MSW service worker (network mock for Storybook).
    "public/mockServiceWorker.js",
  ]),
]);

export default eslintConfig;
