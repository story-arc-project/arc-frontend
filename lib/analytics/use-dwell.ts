"use client";

// FRT-107: "이 화면을 얼마나 봤는가".
//
// 값의 뜻은 **처음 화면을 벗어나기까지 실제로 보인 시간**이다. 탭이 숨겨지는 순간 시계를
// 멈추고 그대로 발화하므로, 배경에 열어둔 채 잊어버린 탭이 "3시간 정독"으로 집계되지 않는다.
// 돌아와서 더 본 시간은 세지 않는다 — 모바일에서는 hidden 이 사실상 마지막 신호라, 그때
// 보내지 않으면 아무것도 남지 않는 쪽이 더 흔하다. 정확도보다 유실을 막는 쪽을 택했다.
import { useExitSignal } from "./exit-signal";

const ALWAYS = (): boolean => true;

export interface DwellOptions {
  // 잴 준비가 됐는가. 결과를 아직 불러오는 중이라면 false 로 두어 로딩 시간이 체류에 섞이지
  // 않게 한다("빈 화면을 본 시간"은 체류가 아니다).
  active: boolean;
  // 화면을 떠날 때 1회. 초 단위 반올림 — 0 초는 "열자마자 나갔다"는 유효한 사실이다.
  onLeave: (seconds: number) => void;
}

export function useDwell({ active, onLeave }: DwellOptions): void {
  useExitSignal({
    active,
    onHidden: true,
    shouldFire: ALWAYS,
    onFire: onLeave,
  });
}
