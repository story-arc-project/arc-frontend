/**
 * 분석 제목 표시 폴백 (FRT-123).
 *
 * 계약(§2·§4)상 서버가 생성 시점에 title 을 확정 저장하지만, 아직 계약을 이행하지
 * 않은 백엔드나 백필 이전 데이터에서는 빈 문자열이 올 수 있다. 그 경우 빈 칸 대신
 * 최소한의 표시를 보장한다. 프론트가 목록 index 로 이름을 만들지 않는다(계약 §4).
 */
export function getDisplayTitle(title: string): string {
  return title.trim() || "제목 없음";
}
