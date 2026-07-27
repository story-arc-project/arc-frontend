import type { CoverLetterResult } from "@/types/cover-letter";

/**
 * **근거 검증이 가리키는 본문**(= 서버가 처음 만들어 준 본문)을 이 기기에 붙잡아 둔다.
 *
 * 왜 필요한가: `grounding` 은 생성 시점 본문에 대한 판정인데, 출력 계약에 "어느 본문을
 * 검증했는지"가 없다. 그래서 저장이 성공해 서버 본문이 편집본으로 바뀌면 다음 진입 때
 * `서버 본문 === 화면 본문` 이 되어 **사용자가 써넣은 문장이 "검증됨"으로 세탁된다.**
 * 화면 안 비교(useState)로는 새로고침을 넘기지 못하므로 기준선만 따로 남긴다.
 *
 * 기준선은 **생성물 단위로 불변**이다 — 다시 만들면 새 id 가 생기므로 지울 일이 없고,
 * 재검증 시점을 정의하는 건 서버 계약(BAC-62)의 몫이다. 계약에 검증 대상 표기가 생기면
 * 이 모듈은 사라져야 한다.
 */

const STORAGE_PREFIX = "arc:cover-letter-verified:";

function key(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

/** 검증 기준선이 되는 문항별 본문. 인덱스는 명세상 입력 순서로 보존된다. */
function bodiesOf(result: CoverLetterResult): string[] {
  return result.answers.map((a) => a.cover_letter);
}

export function readBaseline(id: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // 한 원소라도 문자열이 아니면 기준선을 신뢰할 수 없다 — 없는 것으로 본다(비교를
    // 건너뛰어 화면 안 비교로 떨어질 뿐, 통과로 뭉개지 않는다).
    if (!parsed.every((v) => typeof v === "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

/**
 * 기준선이 아직 없을 때만 쓴다. **이미 있으면 덮지 않는다** — 덮으면 편집본이 새 기준선이
 * 되어 세탁을 막으려던 장치가 세탁을 돕는다.
 */
export function writeBaselineIfAbsent(id: string, result: CoverLetterResult): void {
  if (typeof window === "undefined") return;
  if (readBaseline(id) !== null) return;
  try {
    window.localStorage.setItem(key(id), JSON.stringify(bodiesOf(result)));
  } catch {
    // 용량 초과·프라이빗 모드 — 기준선 없이도 화면 안 비교는 동작한다.
  }
}

/**
 * 서버 본문에 기준선을 덧씌운 결과를 만든다. 편집 여부 판정(`original`)에 쓰는 값이라
 * 본문만 갈아 끼우고 나머지(검증 결과·가이드)는 서버 값을 그대로 둔다.
 *
 * 기준선이 없거나 문항 수가 어긋나면 서버 본문을 그대로 돌려준다 — 어긋난 기준선으로
 * 억지 비교를 하면 고치지도 않은 문항이 "고쳤다"고 표시된다.
 */
export function applyBaseline(
  result: CoverLetterResult,
  baseline: string[] | null,
): CoverLetterResult {
  if (!baseline || baseline.length !== result.answers.length) return result;
  return {
    ...result,
    answers: result.answers.map((a, i) => ({ ...a, cover_letter: baseline[i] })),
  };
}
