import type { Preview } from "@storybook/nextjs";
import { initialize, mswLoader } from "msw-storybook-addon";

import "../app/globals.css";
import { defaultHandlers } from "../lib/mocks/handlers";

// 백엔드 API origin. client.ts와 동일하게 NEXT_PUBLIC_API_URL을 기준으로 한다.
const API_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
).origin;

initialize({
  // 백엔드 origin으로 나가는 "미처리" 요청만 에러로 표면화한다.
  // 경로 allowlist는 새 라우트(/libraries, /presets, /files, /export …)가 늘 때마다
  // 누락 위험이 있어, origin 기준으로 일괄 차단해 재사용 토대의 안전망을 보장한다.
  // (블랭킷 'error'는 Storybook 자체 same-origin 에셋 로딩까지 깨므로 origin으로 한정한다.)
  onUnhandledRequest: (req, print) => {
    if (new URL(req.url).origin === API_ORIGIN) {
      print.error();
    }
  },
});

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    msw: { handlers: defaultHandlers },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
