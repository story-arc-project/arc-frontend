"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CoverLetterGrounding } from "@/types/cover-letter";

interface CoverLetterGroundingNoticeProps {
  grounding: CoverLetterGrounding;
  /**
   * 본문에서 위치를 찾지 못해 하이라이트되지 않은 주장. 하이라이트가 보장이 아니므로
   * 여기서 **반드시 글로 보여준다** — 못 찾았다고 조용히 넘기면 근거 없는 문장을 그대로
   * 제출하게 되고, 그게 이 기능이 막으려던 실패다.
   */
  unmatchedClaims?: readonly string[];
  /**
   * 사용자가 본문을 고쳐 검증 결과가 낡았는지. 명세의 "수정 시 (하이라이트) 해제"에 대응한다.
   * 낡았을 때 경고를 **지우지는 않는다** — 고쳤다고 근거가 생겼다는 보장이 없다. 대신
   * "다시 만들면 재검증된다"고 알려 사용자가 상태를 오해하지 않게 한다.
   *
   * **통과 문항에도 적용된다** — 통과 표시를 남겨 두면 사용자가 새로 써넣은 문장까지
   * 검증된 것처럼 보이므로, 그때는 통과 문구 대신 "확인 안 됨"을 보여준다.
   */
  stale?: boolean;
}

/**
 * 문항 하나의 근거 검증 결과를 보여준다.
 *
 * 통과했으면 조용한 한 줄, 문제가 있으면 눈에 띄는 경고. `grounded=false` 인데
 * `unsupported_claims` 가 비어 있는 경우(명세: 파싱 실패 시에도 false)도 경고로 다룬다 —
 * "문제는 있는데 어디인지 모른다"가 "문제 없음"으로 보이면 안 된다.
 */
export function CoverLetterGroundingNotice({
  grounding,
  unmatchedClaims = [],
  stale = false,
}: CoverLetterGroundingNoticeProps) {
  const claims = grounding.unsupported_claims;
  const hasProblem = !grounding.grounded || claims.length > 0;

  // 고친 본문에는 이 검증이 해당하지 않는다. 통과 문구를 그대로 두면 **사용자가 방금 써넣은
  // 문장이 "기록에 근거한 내용"으로 보증된다** — 근거 검증이 막으려던 실패를 화면이 직접
  // 만드는 셈이다(codex P1). 경고(빨강)로 단정하지도 않는다: 고친 내용이 틀렸다는 근거도
  // 없기 때문이다. "확인 안 됨"이라는 제3의 상태로 둔다.
  if (stale && !hasProblem) {
    return (
      <p
        className="mt-2 flex items-start gap-1.5 text-caption text-text-secondary"
        role="status"
      >
        <AlertTriangle size={13} className="mt-px shrink-0 text-warning" aria-hidden="true" />
        <span>본문을 고친 뒤로는 근거를 확인하지 않았어요. 사실을 직접 확인해 주세요.</span>
      </p>
    );
  }

  if (!hasProblem) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-caption text-text-tertiary">
        <CheckCircle2 size={13} className="shrink-0 text-success" aria-hidden="true" />
        내 기록에 근거한 내용이에요
        {grounding.notes && <span className="sr-only">{grounding.notes}</span>}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="mt-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-body-sm font-medium text-error">
        <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
        {claims.length > 0
          ? `근거를 찾지 못한 문장이 ${claims.length}개 있어요`
          : "근거 검증을 마치지 못했어요"}
      </p>

      {claims.length > 0 ? (
        <>
          <ul className="mt-2 space-y-1">
            {claims.map((claim, i) => (
              <li
                key={`${i}-${claim}`}
                className="text-body-sm text-text-secondary before:mr-1.5 before:text-error before:content-['•']"
              >
                {claim}
                {unmatchedClaims.includes(claim) && (
                  <span className="ml-1 text-caption text-text-tertiary">
                    (본문에서 위치를 찾지 못했어요)
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-text-secondary">
            기록에 없는 내용일 수 있어요. 사실을 확인하고 고쳐서 제출하세요.
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-body-sm text-text-secondary">
          자동 검증이 실패해서 근거를 확인하지 못했어요. 제출 전에 직접 확인해 주세요.
        </p>
      )}

      {stale && (
        <p className="mt-2 text-caption text-text-tertiary">
          본문을 고친 뒤로는 다시 검증하지 않았어요. 다시 만들면 새로 확인해요.
        </p>
      )}

      {grounding.notes && (
        <p className="mt-2 text-caption text-text-tertiary">{grounding.notes}</p>
      )}
    </div>
  );
}
