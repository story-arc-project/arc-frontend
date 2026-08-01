"use client";

/**
 * FRT-147 — 영문 레쥬메는 지금 읽기·내보내기까지만 연다.
 *
 * 영문 응답은 국문과 다른 키 한 벌로 오고, 화면에 띄우려고 경계에서 국문 키로 옮긴다.
 * 그 매핑은 **단방향**이라 영문 전용 값(publications·relevant_coursework·location 등)이
 * 되돌아갈 자리가 없다 — 이 상태로 저장을 열면 저장할 때마다 그 값들이 사라진다(FRT-148 과
 * 같은 데이터 소실). 역매핑 계약이 서기 전까지 편집을 열지 않는 편이 안전하다.
 *
 * 내보내기(PDF·Word)는 그대로 되므로 "크레딧을 쓰고 아무것도 못 받는" 상태는 해소된다.
 */
export function EnglishReadOnlyNotice() {
  return (
    <div className="no-print rounded-md border border-border bg-surface px-4 py-3">
      <p className="text-body-sm font-medium text-text-primary">
        영문 레쥬메는 아직 편집할 수 없어요
      </p>
      <p className="mt-1 text-caption text-text-secondary">
        지금은 내용 확인과 PDF · Word 내보내기까지 가능해요. 편집이 필요하면 한국어로 다시
        만들어 주세요.
      </p>
    </div>
  );
}
