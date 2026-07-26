"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { isAdminPath } from "@/lib/monitoring/admin-path";

/**
 * admin 영역에 들어오면 Session Replay 녹화를 멈춘다. **다시 켜지 않는다.**
 *
 * admin 은 고객 이메일·이름을 URL(`?q=`)에 싣는데, Replay 는 rrweb 스냅샷에 현재 주소를 그대로
 * 기록하고 **그 녹화 첨부는 이벤트 프로세서를 타지 않아** URL 스크러빙으로 못 지운다(Codex P1).
 *
 * ## 왜 admin 을 나가도 재개하지 않는가 (의도된 절충)
 *
 * 재개하면 모니터링 공백은 없어지지만 **PII 누출 경로가 되살아난다**: Replay 의 history 리스너는
 * 이동 대상 URL 을 **동기적으로** 기록하는데 이 effect 는 그 뒤에 돈다. 그래서 재개된 세션이
 * 뒤로가기 등으로 `admin/customers?q=고객이메일` 로 돌아오면, 우리가 stop() 하는 시점엔 이미
 * 그 주소가 녹화에 들어가 있고 stop() 이 그 첨부를 flush 해 전송한다(Codex P1). React 생명주기
 * 안에서는 이 순서를 이길 수 없다.
 *
 * 재개하지 않으면 세션의 첫 admin 진입 이후로 녹화가 꺼진 채 유지되어 그 경로가 닫힌다. 첫
 * 진입 자체는 `?q=` 를 달고 올 수 없다(주소로 바로 들어온 경우는 부팅 시점에
 * `instrumentation-client.ts` 가 표본율 0 으로 막고, 앱 안의 admin 링크는 `/admin` 뿐이다).
 *
 * 대가는 **그 세션의 admin 밖 Replay 커버리지 상실**이다(다음 전체 새로고침에 정상 복구). 내부
 * 운영자 소수의 디버깅 자료를 잃는 쪽이, 고객 이메일을 외부 모니터링으로 보내는 것보다 낫다고
 * 판단했다. 근본 해법은 검색어를 URL 에 싣지 않는 것이며 별도 판단이 필요하다.
 */
export function SessionReplayGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAdminPath(pathname)) return;
    const replay = Sentry.getReplay();
    if (!replay) return;
    // 실패해도 화면에 영향이 없어야 하므로 조용히 흘린다.
    void Promise.resolve(replay.stop()).catch(() => {});
  }, [pathname]);

  return null;
}
