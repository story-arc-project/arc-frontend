"use client";

import { useState } from "react";
import type { MissionDefinition, MissionDraft, MissionMutation, MissionProgress } from "@/lib/missions/types";
import { safeMissionUrl } from "@/lib/missions/model";
import { MissionEvidenceForm } from "./MissionEvidenceForm";
import { missionStatusLabels } from "./MissionCenter";
import styles from "./missions.module.css";

export function MissionDetail({ mission, progress, draft, mutation, onDraft, onSubmit, onClaim, onBack }: {
  mission: MissionDefinition; progress: MissionProgress; draft: MissionDraft; mutation: MissionMutation;
  onDraft: (draft: MissionDraft) => void; onSubmit: () => void; onClaim: () => void; onBack: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const actionUrl = safeMissionUrl(progress.actionUrl);
  const invitationUrl = safeMissionUrl(progress.invitation?.url);
  const unresolved = mutation.status === "uncertain" || mutation.status === "pending";
  const unresolvedSubmit = unresolved && mutation.operation === "submit";
  const unresolvedClaim = unresolved && mutation.operation === "claim";
  const canSubmit = !unresolvedClaim && mission.kind === "evidence" && (unresolvedSubmit || progress.status === "available" || progress.status === "needs_revision");
  const canClaim = !unresolvedSubmit && (unresolvedClaim || progress.status === "claimable");
  return <section className={styles.page} aria-label="미션 상세">
    <button type="button" className={styles.back} onClick={onBack}>← 미션 목록으로</button>
    <header className={styles.intro}><h1>{mission.title}</h1><p>{mission.description}</p><div className={styles.statusLine}><span className={`${styles.tag} ${progress.status === "claimed" || progress.status === "claimable" ? styles.good : progress.status === "needs_revision" ? styles.warn : ""}`}>{missionStatusLabels[progress.status]}</span></div></header>
    <div className={styles.detailGrid}>
      <article className={styles.board} aria-label="미션 참여">
        <h2>{canSubmit ? "사용 경험을 들려주세요" : "참여 안내"}</h2>
        {mission.id === "M2" && <p>좋았던 점도, 아쉬웠던 점도 괜찮아요. 실제 사용 경험과 구체적인 의견을 들려주세요.</p>}
        {progress.status === "needs_revision" && <div className={styles.correction}><strong>제출 내용을 보완해 주세요</strong>{progress.reason || "제출한 내용을 확인하고 다시 검토를 요청해 주세요."}</div>}
        {canSubmit && <MissionEvidenceForm draft={draft} mutation={mutation} revision={progress.status === "needs_revision"} onDraft={onDraft} onSubmit={onSubmit} />}
        {!unresolvedSubmit && progress.status === "reviewing" && <><p className={styles.notice}>제출한 내용을 확인하고 있어요. 완료 확인 후 보상을 받을 수 있어요.</p>{progress.submission && <div className={styles.invitation}><h3>제출 내역</h3><p>{progress.submission.url}</p><p>{progress.submission.note}</p></div>}</>}
        {canClaim && <><p className={styles.notice}>{unresolvedClaim ? "이전에 요청한 보상의 수령 결과를 확인해 주세요." : "미션 완료가 확인됐어요. 보상을 수령해 주세요."}</p><button className={styles.button} type="button" onClick={onClaim} disabled={mutation.status === "pending"}>{mutation.status === "pending" ? "수령 중…" : mutation.status === "uncertain" ? "수령 결과 다시 확인" : "크레딧 받기"}</button>{mutation.status === "uncertain" && <p className={styles.feedback}>결과가 확인되지 않았어요. 같은 요청으로 다시 확인해 주세요.</p>}</>}
        {!unresolved && progress.status === "claimed" && <p className={styles.notice}>이 회차의 보상을 수령했어요.</p>}
        {!unresolved && progress.status === "closed" && <p className={styles.notice}>{progress.reason || "현재 모집이 없어요. 새로운 참여 기회가 열리면 확인할 수 있어요."}</p>}
        {!unresolved && progress.status === "unavailable" && <p className={styles.notice}>현재 참여 가능 여부를 확인할 수 없어요. 참여와 보상 수령은 상태가 확인된 뒤 이용할 수 있어요.</p>}
        {!unresolved && progress.status === "available" && mission.kind !== "evidence" && <>
          {mission.kind === "invite" ? <><p>초대한 친구가 가입하고 3일 활동하며 기록 2건을 남기면 완료 여부를 확인해요.</p>{invitationUrl && progress.invitation ? <div className={styles.invitation}><h3>내 초대 주소</h3><code>{invitationUrl}</code><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={async () => { try { await navigator.clipboard.writeText(invitationUrl); setCopyStatus("초대 주소를 복사했어요."); } catch { setCopyStatus("복사하지 못했어요. 위 주소를 직접 복사해 주세요."); } }}>초대 주소 복사</button><p className={styles.feedback}>조건 달성 {progress.invitation.qualifiedCount}명 · 확인 중 {progress.invitation.pendingCount}명</p><p aria-live="polite" className={styles.feedback}>{copyStatus}</p></div> : <p className={styles.notice}>초대 주소를 아직 확인할 수 없어요.</p>}</> : actionUrl ? <><p className={styles.notice}>참여 후 완료 여부를 확인해요. 링크를 여는 것만으로 완료되지는 않아요.</p><a className={styles.button} href={actionUrl} target="_blank" rel="noopener noreferrer">{mission.kind === "automatic" ? "설정·활동 확인하기" : "참여 페이지 열기"}<span className={styles.hint}>(새 창)</span></a></> : <p className={styles.notice}>참여 경로가 아직 준비되지 않았어요. 현재는 이 화면에서 참여할 수 없어요.</p>}
        </>}
        {!canSubmit && <div aria-live="polite">{mutation.message && <p className={styles.feedback}>{mutation.message}</p>}</div>}
      </article>
      <aside className={styles.spec}><h2>참여 전에 확인해 주세요</h2><dl><dt>미션 보상</dt><dd><strong>{mission.reward} 크레딧{mission.kind === "invite" ? " / 명" : ""}</strong></dd><dt>참여 제한</dt><dd>{mission.limit} · 첫 완료 포함</dd><dt>완료 확인</dt><dd>{mission.verification}</dd><dt>보상 받는 시점</dt><dd>완료가 확인되면 직접 수령</dd><dt>인정되는 활동</dt><dd>{mission.retroactive ? "기존 활동도 인정돼요." : "미션 도입 이후 완료한 활동"}</dd></dl><p>보상은 완료가 확인된 뒤 받을 수 있어요. 전송에 실패해도 이 화면의 입력은 유지돼요.</p></aside>
    </div>
  </section>;
}
