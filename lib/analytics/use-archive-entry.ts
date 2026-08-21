"use client";

// FRT-107: 경험 입력 폼의 이탈·진행 계측.
//
// 실측이 이 훅의 이유다 — 180일간 archive_entry_started 23건 → record_created 4건.
// 83% 가 사라졌는데 **한 화면 안에서** 사라져서, 퍼널은 "저장까지 못 갔다"까지만 알고
// 어디서 멈췄는지는 모른다. 그 자리를 남기는 것이 여기서 하는 전부다.
//
// 신규 작성과 수정을 한 이벤트에 싣되 mode 로 가른다 — 수정 중 이탈은 이미 저장된 기록이
// 있어서 뜻이 다르지만, 같은 폼·같은 자리라 나란히 봐야 "이 화면이 어렵다"를 읽을 수 있다.
import { useCallback, useRef } from "react";

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
}

export interface ArchiveEntryAnalytics {
  /** ExperienceFormV2 의 onCompletionChange 에 그대로 연결한다. */
  handleCompletionChange: (snapshot: FormCompletionSnapshot) => void;
  /** 저장이 확정된 순간 호출 — 이 뒤로는 이탈로 세지 않는다. */
  markSaved: () => void;
  /** record_created 에 실을 진행 속성. markSaved 와 같은 시점에 읽어야 한다. */
  progressProps: () => ArchiveEntryProgressProps;
}

export function useArchiveEntryAnalytics({
  mode,
  active,
}: ArchiveEntryAnalyticsOptions): ArchiveEntryAnalytics {
  // 발화는 언마운트 이후다 — state 로 들면 옛 진행률이 굳어 "아무것도 안 채우고 나갔다"가 된다.
  const snapshotRef = useRef<FormCompletionSnapshot>(EMPTY_SNAPSHOT);
  // 한 번 완료로 관측한 섹션은 다시 세지 않는다. 값을 지웠다 다시 채우면 카드가 미완료로
  // 돌아갔다 오는데, 그때마다 쏘면 "섹션을 몇 번 완료했나"가 타이핑 횟수에 가까워진다.
  const emittedSectionsRef = useRef<Set<string>>(new Set());

  const { markCompleted, elapsedSeconds } = useFlowExit({
    active,
    onExit: (elapsed) => {
      const snapshot = snapshotRef.current;
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

  const handleCompletionChange = useCallback((snapshot: FormCompletionSnapshot) => {
    snapshotRef.current = snapshot;
    const emitted = emittedSectionsRef.current;
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
  }, []);

  const progressProps = useCallback((): ArchiveEntryProgressProps => {
    const snapshot = snapshotRef.current;
    return {
      elapsed_seconds: elapsedSeconds(),
      sections_done: snapshot.completedSectionIds.length,
      sections_total: snapshot.sectionIds.length,
      qualitative_fields_filled: snapshot.qualitativeFieldsFilled,
    };
  }, [elapsedSeconds]);

  return { handleCompletionChange, markSaved: markCompleted, progressProps };
}
