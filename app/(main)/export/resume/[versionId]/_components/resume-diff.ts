import type { ResumeVersion } from "@/types/resume";

/**
 * FRT-114 — 초안(AI 생성분) 대비 **사용자가 손댄 섹션**을 가려낸다.
 *
 * 정의서는 문장 단위 승인/기각(`resume_sentence_approved` 등)으로 수정률을 재려 했지만
 * 21차 회의에서 그 UX 자체가 폐기됐다. 지금 화면에 있는 건 섹션 아코디언 자유 편집뿐이라,
 * "얼마나 고쳐 쓰는가"는 **어떤 섹션이 초안과 달라졌는가**로만 잴 수 있다.
 */

/**
 * 사용자가 편집기에서 실제로 고칠 수 있는 섹션만, **화면(ResumeEditorPanel) 아코디언
 * 순서 그대로** 나열한다. 순서가 곧 반환 순서라 다운스트림이 다시 정렬하지 않아도
 * "위쪽 섹션부터 고치는가"를 볼 수 있다.
 *
 * `meta`·`연계성`·`파싱경고`·`version_id` 는 편집기에 입력칸이 없다 — 여기 넣으면
 * 서버 응답 차이만으로 "사용자가 고쳤다"가 되어 수정률이 부풀려진다.
 *
 * 슬러그는 ascii 로 고정한다. PostHog 속성값에 한글 키를 그대로 실으면 대시보드
 * 필터·URL 인코딩에서 다루기 나쁘고, 화면 라벨이 바뀔 때마다 지표가 갈라진다.
 */
const EDITABLE_SECTIONS: ReadonlyArray<readonly [keyof ResumeVersion, string]> = [
  ["인적사항", "personal_info"],
  ["자기소개_요약", "summary"],
  ["학력", "education"],
  ["경력", "career"],
  ["프로젝트", "project"],
  ["대외활동", "activity"],
  ["동아리_학회", "club"],
  ["수상", "award"],
  ["자격증", "certification"],
  ["어학", "language"],
  ["기술및역량", "skills"],
];

/**
 * 초안과 현재 편집본을 섹션 단위로 비교해 달라진 섹션 슬러그를 돌려준다.
 *
 * 비교는 페이지의 `dirty` 판정과 같은 방식(JSON 직렬화)을 쓴다 — 편집기들이 기존 객체를
 * spread 로 복제해 키 순서가 보존되므로 안전하고, 무엇보다 `dirty` 와 판정이 갈리면
 * "고쳤다는데 고친 섹션이 없다"는 모순된 이벤트가 나간다.
 *
 * 어느 한쪽이 없으면(로드 전) 빈 배열이다. 부재를 "전부 수정"으로 읽으면 화면을 열기만
 * 해도 전 섹션 수정으로 집계된다.
 */
export function changedResumeSections(
  initial: ResumeVersion | null,
  current: ResumeVersion | null,
): string[] {
  if (!initial || !current) return [];

  const changed: string[] = [];
  for (const [key, slug] of EDITABLE_SECTIONS) {
    if (JSON.stringify(initial[key]) !== JSON.stringify(current[key])) {
      changed.push(slug);
    }
  }
  return changed;
}
