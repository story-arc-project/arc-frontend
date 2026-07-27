import { notFound } from "next/navigation";

import { isCoverLetterEnabled } from "@/lib/export/flags";

// 판정을 빌드타임에 굳히지 않고 요청마다 한다 — 프리렌더되면 notFound() 결과가 정적
// 페이지로 박혀 플래그를 켠 뒤에도 갱신이 필요하다.
export const dynamic = "force-dynamic";

/**
 * 자소서 라우트의 봉인 경계.
 *
 * 익스포트 페이지에서 카드를 숨기는 것만으로는 **주소를 아는 사람이 그대로 들어온다** —
 * 그러면 계약이 확정되지 않은 추정 엔드포인트(BAC-62 미착수)로 실제 요청이 나간다.
 * 플래그 봉인의 뜻은 "안 보인다"가 아니라 "닿지 않는다"이므로 게이트를 라우트에도 세운다.
 *
 * ⚠️ 화면은 404 페이지로 대체되지만 **상태코드까지 404 가 되지는 않는다** — 상위
 * `export/loading.tsx` 가 Suspense 경계를 만들어 응답이 200 으로 흐르기 시작한 뒤에 이
 * 판정이 스트리밍되기 때문이다(실측 확인). 기능 봉인에는 문제가 없고(폼·요청 모두 도달
 * 불가), 상태코드까지 맞추려면 `proxy.ts` 로 올려야 하는데 그러면 플래그가 두 곳에 산다.
 *
 * 재사용 컴포넌트는 계속 flag-agnostic 이다 — 게이트는 여기와 익스포트 페이지 두 호출부에만
 * 둔다(FRT-108 교훈: 컴포넌트 안에서 env 를 읽으면 Storybook 에서 영영 false 다).
 */
export default function CoverLetterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isCoverLetterEnabled()) notFound();
  return <>{children}</>;
}
