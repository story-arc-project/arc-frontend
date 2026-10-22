"use client";

// FRT-107: 경험 입력 폼의 이탈·진행 계측.
//
// 실측이 이 훅의 이유다 — 180일간 archive_entry_started 23건 → record_created 4건.
// 83% 가 사라졌는데 **한 화면 안에서** 사라져서, 퍼널은 "저장까지 못 갔다"까지만 알고
// 어디서 멈췄는지는 모른다. 그 자리를 남기는 것이 여기서 하는 전부다.
//
// 신규 작성과 수정을 한 이벤트에 싣되 mode 로 가른다 — 수정 중 이탈은 이미 저장된 기록이
// 있어서 뜻이 다르지만, 같은 폼·같은 자리라 나란히 봐야 "이 화면이 어렵다"를 읽을 수 있다.
import { useCallback, useEffect, useMemo } from "react";

import type { FormCompletionSnapshot } from "@/lib/utils/form-cards";

import { capture } from "./client";
import type { ArchiveEntryMode } from "./events";
import { useFlowExit } from "./use-flow-exit";

const EMPTY_SNAPSHOT: FormCompletionSnapshot = {
  sectionIds: [],
  completedSectionIds: [],
  qualitativeFieldsFilled: [],
};

/** record_created 에 실어 이탈자와 같은 축으로 비교하는 진행 속성. */
export interface ArchiveEntryProgressProps {
  elapsed_seconds: number;
  sections_done: number;
  sections_total: number;
  qualitative_fields_filled: string[];
}

export interface ArchiveEntryAnalyticsOptions {
  mode: ArchiveEntryMode;
  /**
   * 폼이 실제로 떠 있는가. 수정 화면은 기록을 불러오는 동안 폼이 없으므로, 그 시간을
   * 이탈로 세지 않으려면 로드가 끝난 뒤에 켜야 한다.
   */
  active: boolean;
  /**
   * 지금 다루고 있는 기록의 정체(수정 화면의 레코드 id). 라우트 파라미터만 바뀌고
   * 페이지 컴포넌트는 재사용되는 전환(FRT-238)에서, 이 값이 바뀌면 앞 기록의 진행 자취를
   * 물려주지 않는다. 없으면(신규 작성) 한 화면이 곧 한 세션이다.
   */
  sessionKey?: string;
  /**
   * 저장 요청이 서버에 나가 있는가. 이 동안 화면을 떠나면 이탈을 **쏘지 않는다** — 응답이
   * 돌아와 record_created 가 찍히면 한 시도가 "포기"와 "완료" 둘로 남기 때문이다. 응답이
   * 실패로 끝나 다시 편집하게 되면(saving=false) 그 뒤의 이탈은 다시 센다.
   * 자소서 편집(exit_draft)이 같은 자리에서 같은 판단을 한다.
   */
  saving?: boolean;
}

export interface ArchiveEntryAnalytics {
  /** ExperienceFormV2 의 onCompletionChange 에 그대로 연결한다. */
  handleCompletionChange: (snapshot: FormCompletionSnapshot) => void;
  /** 저장이 확정된 순간 호출 — 이 뒤로는 이탈로 세지 않는다. */
  markSaved: () => void;
  /** 저장 요청 직전 진행률을 고정한다. elapsed_seconds는 응답 완료 시 다시 읽을 수 있다. */
  progressProps: () => ArchiveEntryProgressProps;
}

export function useArchiveEntryAnalytics({
  mode,
  active,
  sessionKey,
  saving = false,
}: ArchiveEntryAnalyticsOptions): ArchiveEntryAnalytics {
  // 발화는 언마운트 이후라 클로저의 saving 은 옛 값이다 — 커밋마다 ref 로 맞춘다.
  // (언마운트 발화는 한 틱 미뤄지므로 effect 동기화가 늦지 않는다.)
  // 기록마다 상태를 분리해 자식의 새 스냅샷이 이전 기록의 이탈을 오염시키지 않는다.
  const session = useMemo(() => ({
    saving,
    snapshot: EMPTY_SNAPSHOT,
    emittedSections: new Set<string>(),
    baselined: mode === "new",
  // mode는 기록 진입 시 기준선에만 쓰고 saving은 아래 커밋에서 갱신한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sessionKey]);
  useEffect(() => {
    session.saving = saving;
  }, [saving, session]);

  const { markCompleted, elapsedSeconds } = useFlowExit({
    active,
    sessionKey,
    onExit: (elapsed) => {
      // 저장이 도는 중이면 이 시도의 결말은 응답이 정한다 — 여기서 한 번 더 정하지 않는다.
      if (session.saving) return;
      const snapshot = session.snapshot;
      const done = snapshot.completedSectionIds;
      capture(
        "archive_entry_abandoned",
        {
          mode,
          // 폼 순서상 마지막으로 완료한 섹션 = "어디까지 갔나". 하나도 없으면 null 이고,
          // 그건 "시작도 못 했다"는 유효한 답이라 부재로 뭉개지 않는다.
          last_section: done.length > 0 ? done[done.length - 1] : null,
          sections_done: done.length,
          sections_total: snapshot.sectionIds.length,
          elapsed_seconds: elapsed,
          qualitative_fields_filled: snapshot.qualitativeFieldsFilled,
        },
        // 화면이 사라지는 순간이라 배치 큐에 담으면 그대로 사라진다.
        { atUnload: true },
      );
    },
  });

  const handleCompletionChange = useCallback(
    (snapshot: FormCompletionSnapshot) => {
      session.snapshot = snapshot;

      // 기준선은 폼이 자리를 잡은 첫 스냅샷이다 — 수정 모드는 템플릿이 실린 뒤에야 섹션이
      // 다 모이므로(확장 섹션은 마운트 이후 effect 에서 채워진다) 빈 스냅샷으로 잡으면
      // 뒤늦게 도착한 완료분이 그대로 오탐이 된다. 폼이 dirty 기준선을 잡는 시점과 같다.
      if (!session.baselined) {
        if (snapshot.sectionIds.length === 0) return;
        session.baselined = true;
        for (const id of snapshot.completedSectionIds) {
          session.emittedSections.add(id);
        }
        return;
      }

      const emitted = session.emittedSections;
      for (const id of snapshot.completedSectionIds) {
        if (emitted.has(id)) continue;
        emitted.add(id);
        capture("archive_section_completed", {
          section_key: id,
          // sections_done 이 "몇 개 했나"라면 이쪽은 "폼의 어디를 하고 있나"다.
          // 둘이 벌어지면 사용자가 순서를 건너뛰며 채운다는 뜻이라 서로 못 대신한다.
          section_index: snapshot.sectionIds.indexOf(id),
          sections_done: snapshot.completedSectionIds.length,
          sections_total: snapshot.sectionIds.length,
        });
      }
    },
    [session],
  );

  const progressProps = useCallback((): ArchiveEntryProgressProps => {
    const snapshot = session.snapshot;
    return {
      elapsed_seconds: elapsedSeconds(),
      sections_done: snapshot.completedSectionIds.length,
      sections_total: snapshot.sectionIds.length,
      qualitative_fields_filled: snapshot.qualitativeFieldsFilled,
    };
  }, [elapsedSeconds, session]);

  return { handleCompletionChange, markSaved: markCompleted, progressProps };
}
