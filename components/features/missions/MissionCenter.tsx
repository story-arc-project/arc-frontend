"use client";

import { useState, type ReactNode } from "react";
import { MISSIONS } from "@/lib/missions/catalog";
import { claimableTotal, getProgress } from "@/lib/missions/model";
import type { MissionId, MissionState, MissionStatus } from "@/lib/missions/types";
import styles from "./missions.module.css";

export const missionStatusLabels: Record<MissionStatus, string> = { available: "참여 가능", reviewing: "검토 중", needs_revision: "보완 필요", claimable: "수령 가능", claimed: "수령 완료", closed: "현재 모집 없음", unavailable: "상태 확인 불가" };
const groups = [
  { id: "ready", title: "지금 받을 수 있어요", label: "수령 가능", hint: "검토 중인 보상 제외" },
  { id: "browse", title: "참여할 미션을 찾아보세요", label: "둘러보기", hint: "미션별 고정 보상" },
  { id: "review", title: "검토 중·보완 필요", label: "검토·보완", hint: "아직 수령할 수 없어요" },
  { id: "done", title: "완료한 미션", label: "완료", hint: "확인된 수령 상태" },
];
const groupFor = (status: MissionStatus) => status === "claimable" ? "ready" : status === "claimed" ? "done" : status === "reviewing" || status === "needs_revision" ? "review" : "browse";

export function MissionCenter({ state, balance, onRetry, onOpen, onClaim, onBack, backLabel = "내 계정으로" }: {
  state: MissionState; balance: ReactNode; onRetry: () => void; onOpen: (id: MissionId) => void; onClaim: (id: MissionId) => void; onBack: () => void; backLabel?: string;
}) {
  const [focusedGroup, setFocusedGroup] = useState<{ id: MissionId; group: string } | null>(null);
  const loading = state.status === "idle" || state.status === "loading";
  const total = state.status === "success" && state.snapshot?.missions.length ? claimableTotal(state.snapshot) : null;
  const empty = state.status === "success" && !state.snapshot?.missions.length;
  const unavailable = state.status === "unavailable";
  const displayedSnapshot = state.status === "success" ? state.snapshot : null;
  const orderedMissions = [...(displayedSnapshot?.missions.map(progress => MISSIONS.find(mission => mission.id === progress.missionId)!).filter(Boolean) ?? []), ...MISSIONS.filter(mission => !displayedSnapshot?.missions.some(progress => progress.missionId === mission.id))];
  const groupId = (id: MissionId) => focusedGroup?.id === id ? focusedGroup.group : groupFor(getProgress(displayedSnapshot, id).status);
  return <section className={styles.page} aria-label="미션 센터">
    <button type="button" className={styles.back} onClick={onBack}>← {backLabel}</button>
    <header className={styles.intro}><h1>미션</h1><p>미션에 참여하고 크레딧을 받아보세요.</p></header>
    <div className={styles.summary}>
      <div className={styles.earn}><p className={styles.label}>받을 수 있는 보상</p><div className={`${styles.amount} ${total === null ? styles.summaryUnknown : ""}`}>{loading ? "확인 중…" : total === null ? "확인할 수 없어요" : <>{total}<small>크레딧</small></>}</div><p className={styles.hint}>{total === 0 ? "아직 받을 수 있는 보상이 없어요." : total === null ? "미션 상태가 확인되면 보상을 안내해 드려요." : "완료가 확인된 보상만 포함돼요."}</p></div>
      <div className={styles.balance}>{balance}<p className={styles.hint}>미션 보상은 수령한 뒤 잔액에 반영돼요.</p></div>
    </div>
    {state.refreshing && <p className={styles.feedback} role="status">미션 상태를 다시 확인하고 있어요.</p>}
    {(state.status === "error" || empty || unavailable) && <div className={styles.notice} role="status"><p>{unavailable ? "미션 참여를 준비하고 있어요. 현재는 참여하거나 보상을 받을 수 없어요." : empty ? "미션 구성을 확인하지 못했어요. 잠시 후 다시 확인해 주세요." : "미션을 불러오지 못했어요. 다시 시도해 주세요."}</p>{!unavailable && <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={onRetry}>다시 불러오기</button>}</div>}
    {loading ? <div role="status" aria-label="미션 불러오는 중">{Array.from({ length: 5 }, (_, i) => <div className={styles.loadingRow} key={i} aria-hidden="true"><div className={styles.skeleton} /><div className={styles.skeleton} style={{ width: "45%" }} /></div>)}</div> : <>
      <nav className={styles.anchors} aria-label="미션 상태로 이동">{groups.map(group => { const count = orderedMissions.filter(mission => groupId(mission.id) === group.id).length; return count ? <a href={`#mission-${group.id}`} key={group.id}>{group.label} {count}</a> : <span key={group.id}>{group.label} 0</span>; })}</nav>
      {groups.map(group => {
        const missions = orderedMissions.filter(mission => groupId(mission.id) === group.id);
        if (!missions.length) return null;
        return <section className={styles.section} id={`mission-${group.id}`} key={group.id} aria-labelledby={`heading-${group.id}`}><div className={styles.heading}><h2 id={`heading-${group.id}`}>{group.title}</h2><p>{group.hint}</p></div><div className={group.id === "ready" ? styles.readyGrid : styles.rows}>{missions.map(mission => {
          const progress = getProgress(displayedSnapshot, mission.id);
          const mutation = state.mutations[mission.id];
          const claimable = progress.status === "claimable";
          const retry = mutation?.status === "uncertain";
          const retrySubmit = retry && mutation.operation === "submit";
          const retryClaim = retry && mutation.operation === "claim";
          const claimAction = retryClaim || (claimable && !retrySubmit);
          return <article className={group.id === "ready" ? styles.rewardCard : styles.row} key={mission.id} onFocusCapture={() => setFocusedGroup({ id: mission.id, group: group.id })} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedGroup(null); }}>
            <span className={styles.number} aria-hidden="true">{mission.id.slice(1).padStart(2, "0")}</span>
            <div><h3>{mission.title}</h3><span className={`${styles.tag} ${claimable || progress.status === "claimed" ? styles.good : progress.status === "needs_revision" ? styles.warn : ""}`}>{missionStatusLabels[progress.status]}</span><p>{progress.reason || mission.description} · {mission.limit}</p></div>
            <strong className={styles.value}>{mission.reward}{mission.kind === "invite" ? " / 명" : " 크레딧"}</strong>
            <button type="button" className={`${styles.button} ${claimAction ? "" : styles.secondary}`} disabled={mutation?.status === "pending"} onClick={() => claimAction ? onClaim(mission.id) : onOpen(mission.id)}>{mutation?.status === "pending" ? "처리 중…" : retrySubmit ? "제출 결과 다시 확인" : claimAction ? retry ? "수령 결과 다시 확인" : "크레딧 받기" : progress.status === "needs_revision" ? "보완하기" : progress.status === "reviewing" ? "제출 내역" : progress.status === "claimed" ? "수령 내역" : "자세히 보기"}</button>
            <div className={styles.rowFeedback} aria-live="polite">{mutation?.message && <p>{mutation.message}</p>}{retry && <p>결과가 확인되지 않았어요. 같은 요청으로 다시 확인해 주세요.</p>}</div>
          </article>;
        })}</div></section>;
      })}
      <p className={styles.notice}>미션마다 참여 횟수가 정해져 있어요. 자세한 조건과 확인 방법은 각 미션에서 볼 수 있어요.</p>
    </>}
  </section>;
}
