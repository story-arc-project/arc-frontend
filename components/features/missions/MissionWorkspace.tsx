"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { getMission } from "@/lib/missions/catalog";
import { getProgress } from "@/lib/missions/model";
import { useMissions } from "@/lib/missions/use-missions";
import type { MissionId } from "@/lib/missions/types";
import { useMissionSession } from "./MissionSession";
import { MissionCenter } from "./MissionCenter";
import { MissionDetail } from "./MissionDetail";

export function MissionWorkspace({ onBack, backLabel, balance, initialMissionId, onNavigate }: {
  onBack: () => void; backLabel?: string; balance: ReactNode; initialMissionId?: MissionId;
  onNavigate?: (id?: MissionId) => void;
}) {
  const store = useMissionSession();
  const state = useMissions(store);
  const [localMission, setLocalMission] = useState<MissionId>();
  const selected = onNavigate ? initialMissionId : localMission;
  const container = useRef<HTMLDivElement>(null);
  const lastMission = useRef<MissionId | undefined>(undefined);
  useEffect(() => {
    if (lastMission.current === selected) return;
    lastMission.current = selected;
    const frame = requestAnimationFrame(() => {
      const heading = container.current?.querySelector<HTMLElement>("h1");
      if (heading) { heading.tabIndex = -1; heading.focus(); }
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  const open = (id?: MissionId) => onNavigate ? onNavigate(id) : setLocalMission(id);
  return <div ref={container}>
    {selected ? <>
      {state.status !== "success" && <div role="status" className="mb-4 rounded-xl border border-border p-4">
        <p>{state.status === "loading" || state.status === "idle" ? "미션 정보를 확인하고 있어요." : "미션 정보를 확인할 수 없어요. 작성한 내용은 보관되어 있어요."}</p>
        {(state.status === "error" || state.status === "unavailable") && <button type="button" className="mt-2 min-h-11 underline" onClick={() => { void store.load(); }}>미션 정보 다시 확인</button>}
      </div>}
      <MissionDetail
      mission={getMission(selected)} progress={getProgress(state.status === "success" ? state.snapshot : null, selected)}
      draft={state.drafts[selected] ?? getProgress(state.snapshot, selected).submission ?? { url: "", note: "" }}
      mutation={state.mutations[selected] ?? { status: "idle" }}
      onDraft={draft => store.setDraft(selected, draft)} onSubmit={() => { void store.submit(selected); }}
      onClaim={() => { void store.claim(selected); }} onBack={() => open()}
    /></> : <MissionCenter state={state} balance={balance} onRetry={() => { void store.load(); }} onOpen={id => open(id)}
      onClaim={id => { void store.claim(id); }} onBack={onBack} backLabel={backLabel} />}
  </div>;
}
