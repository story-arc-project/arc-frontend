/**
 * 필수 입력 표시 (FRT-190) — 라벨 바로 옆 주황 점.
 *
 * 표시하는 쪽을 **선택이 아니라 필수로 뒤집었다**. 템플릿의 필수는 유형당 3~6개인데 전체 블록은
 * 13~27개라, '선택' 뱃지는 다수에 붙는 셈이었다. 게다가 그 뱃지는 `absolute` 오버레이라 블록
 * 우상단의 다른 요소(반복 기록의 `N개 항목`)와 겹쳤다 — 인라인 점은 레이아웃에 참여하므로 겹치지
 * 않는다. 색은 새 토큰 없이 `--color-brand`(#fb8408) 를 쓴다.
 *
 * 별표(*) 대신 점인 이유: 별표는 error 색으로 그리던 폼 압박의 전형 기호고, ARC 는 "안정감을 주는
 * 톤(경쟁·압박 지양)"을 원칙으로 둔다. 반복 기록의 컬럼 라벨도 같은 마커를 쓴다 — 한 화면에
 * 필수 표시가 두 종류로 남으면 그 불일치가 표시 자체보다 더 눈에 띈다.
 */
export function RequiredDot() {
  return (
    <span className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand align-middle">
      <span className="sr-only">필수</span>
    </span>
  )
}
