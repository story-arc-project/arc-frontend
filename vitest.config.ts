import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// 유닛 테스트 러너(FRT-44). 순수 로직(매퍼·API client·방어 파싱·util)을
// 브라우저·dev서버 없이 밀리초 단위로 돌린다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // tsconfig 의 "@/*" → 프로젝트 루트 매핑을 Vitest 에 그대로 연동한다.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // describe/it/expect/vi 는 각 파일에서 명시 import → ESLint no-undef 회피.
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    // 유닛 테스트는 *.test.ts(x) 만. e2e 의 *.spec.ts(Playwright)는 제외한다.
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**", "storybook-static/**"],
  },
})
