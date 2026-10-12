"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { captureFunnel, newFunnelId, sanitizeFunnelEntry } from "@/lib/analytics/funnel";
import type { MissionStore } from "@/lib/missions/store";
import { getMission } from "@/lib/missions/catalog";
import { getProgress } from "@/lib/missions/model";
import { useMissions } from "@/lib/missions/use-missions";
import type { MissionId } from "@/lib/missions/types";
import { useMissionSession } from "./MissionSession";
import { MissionCenter } from "./MissionCenter";
import { MissionDetail } from "./MissionDetail";

// Store lifetime follows account/session lifetime, including list/detail navigation.
const flows = new WeakMap<MissionStore, { id: string; started: Set<string>; handoffId?: string; claimView: () => boolean }>();
// A trusted handoff can be consumed by one account session only. Weak references
// retain no account/store data after disposal; consumed IDs stay invalid for reuse.
const handoffOwners = new Map<string, WeakRef<MissionStore>>();
function missionFlow(store: MissionStore, handoffId?: string) {
  let flow = flows.get(store);
  if (!flow || (handoffId && flow.handoffId !== handoffId)) {
    const owner = handoffId ? handoffOwners.get(handoffId) : undefined;
    const inherit = handoffId && (!owner || owner.deref() === store);
    if (inherit) handoffOwners.set(handoffId, new WeakRef(store));
    let viewed = false;
    flow = { id: inherit ? handoffId : newFunnelId(), handoffId, started: new Set(), claimView: () => {
      if (viewed) return false;
      viewed = true;
      return true;
    } };
    flows.set(store, flow);
  }
  return flow;
}

export function MissionWorkspace({ onBack, backLabel, balance, initialMissionId, onNavigate, analyticsEnabled = false, entryPath = "direct", flowId }: {
  onBack: () => void; backLabel?: string; balance: ReactNode; initialMissionId?: MissionId;
  onNavigate?: (id?: MissionId) => void;
  analyticsEnabled?: boolean; entryPath?: string;
  /** Trusted in-memory fake-door handoff only; never read from URL/query data. */
  flowId?: string;
}) {
  const store = useMissionSession();
  const state = useMissions(store);
  const flow = missionFlow(store, flowId);
  const entry = sanitizeFunnelEntry(entryPath);
  const context = { flow_id: flow.id, entry_path: entry };
  // One initial terminal workspace result per session, including direct detail entry.
  useEffect(() => {
    if (!analyticsEnabled || state.status === "idle" || state.status === "loading" || !flow.claimView()) return;
    captureFunnel("mission_page_viewed", { flow_id: flow.id, entry_path: entry,
      availability: state.status === "success" ? state.snapshot?.missions.length ? "available" : "unavailable" : state.status });
  }, [analyticsEnabled, entry, flow, state.status, state.snapshot]);
  const start = (id: MissionId) => {
    const mission = getMission(id);
    const cycleId = getProgress(store.getSnapshot().snapshot, id).cycleId;
    const participation = JSON.stringify([id, cycleId ?? null]);
    if (!analyticsEnabled || mission.kind === "automatic" || mission.retroactive || flow.started.has(participation)) return;
    flow.started.add(participation);
    captureFunnel("mission_started", { ...context, mission_id: id, participation_type: mission.kind });
  };
  const submit = (id: MissionId) => {
    const current = store.getSnapshot();
    if (analyticsEnabled && current.mutations[id]?.status !== "pending") captureFunnel("mission_submit_clicked", {
      ...context, mission_id: id, is_retry: current.mutations[id]?.status === "uncertain" && current.mutations[id]?.operation === "submit",
    });
    void store.submit(id);
  };
  const claim = (id: MissionId) => {
    const current = store.getSnapshot();
    if (analyticsEnabled && current.mutations[id]?.status !== "pending") captureFunnel("mission_claim_clicked", {
      ...context, mission_id: id, is_retry: current.mutations[id]?.status === "uncertain" && current.mutations[id]?.operation === "claim",
    });
    void store.claim(id);
  };
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
      onDraft={draft => {
        const previous = store.getSnapshot().drafts[selected] ?? getProgress(state.snapshot, selected).submission ?? { url: "", note: "" };
        if ((draft.url !== previous.url || draft.note !== previous.note) && (draft.url.trim() || draft.note.trim())) start(selected);
        store.setDraft(selected, draft);
      }} onSubmit={() => submit(selected)}
      onParticipate={() => start(selected)}
      onReferralShared={() => {
        if (!analyticsEnabled) return;
        start(selected);
        captureFunnel("referral_code_shared", { ...context, mission_id: selected, share_channel: "clipboard" });
      }}
      onClaim={() => claim(selected)} onBack={() => open()}
    /></> : <MissionCenter state={state} balance={balance} onRetry={() => { void store.load(); }} onOpen={id => open(id)}
      onClaim={claim} onBack={onBack} backLabel={backLabel} />}
  </div>;
}
