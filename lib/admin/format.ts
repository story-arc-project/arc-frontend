// FRT-17: admin 화면 공용 날짜 표기. 목록(CustomerListView)과 상세(CustomerDetailPanels)가
// **같은 함수**를 쓴다 — 포맷 사본을 두면 한쪽만 고쳐져 같은 가입일이 화면마다 달리 보인다.

/**
 * ISO 문자열을 한국 기준 날짜로 표기한다. 값이 없으면 "—", 파싱 불가면 원문 그대로.
 *
 * ⚠️ 타임존을 Asia/Seoul 로 **고정**한다. 안 하면 서버(UTC)와 관리자 브라우저(KST)가 자정 근처
 * 시각을 서로 다른 날짜로 렌더해 하이드레이션 불일치가 나고, 화면의 날짜가 눈앞에서 바뀐다
 * (FRT-16 Codex P2). 운영 기준시는 한국 시간이다.
 */
export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
