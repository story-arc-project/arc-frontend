"use client";

import { useId, useState } from "react";
import type { MissionDraft, MissionMutation } from "@/lib/missions/types";
import { validateEvidence } from "@/lib/missions/model";
import styles from "./missions.module.css";

export function MissionEvidenceForm({ draft, mutation, revision = false, onDraft, onSubmit }: {
  draft: MissionDraft; mutation: MissionMutation; revision?: boolean;
  onDraft: (draft: MissionDraft) => void; onSubmit: () => void;
}) {
  const id = useId();
  const [attempted, setAttempted] = useState(false);
  const errors = attempted ? validateEvidence(draft) : {};
  const locked = mutation.status === "pending" || mutation.status === "uncertain";
  return <form noValidate onSubmit={(event) => {
    event.preventDefault();
    if (mutation.status === "pending") return;
    if (mutation.status !== "uncertain") {
      setAttempted(true);
      if (Object.keys(validateEvidence(draft)).length) return;
    }
    onSubmit();
  }}>
    <label className={styles.fieldLabel} htmlFor={`${id}-url`}>공개 게시물 주소</label>
    <input className={styles.input} id={`${id}-url`} type="url" inputMode="url" autoComplete="url" value={draft.url} disabled={locked} required aria-invalid={Boolean(errors.url)} aria-describedby={`${id}-url-hint${errors.url ? ` ${id}-url-error` : ""}`} onChange={(event) => onDraft({ ...draft, url: event.target.value })} placeholder="https://" />
    <p className={styles.hint} id={`${id}-url-hint`}>누구나 열어 볼 수 있는 공개 주소를 입력해 주세요.</p>
    {errors.url && <p className={styles.error} id={`${id}-url-error`}>{errors.url}</p>}
    <label className={styles.fieldLabel} htmlFor={`${id}-note`}>함께 전할 내용 <span className={styles.hint}>(선택)</span></label>
    <textarea className={`${styles.input} ${styles.textarea}`} id={`${id}-note`} value={draft.note} disabled={locked} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? `${id}-note-error` : undefined} onChange={(event) => onDraft({ ...draft, note: event.target.value })} />
    {errors.note && <p className={styles.error} id={`${id}-note-error`}>{errors.note}</p>}
    <div aria-live="polite">{mutation.message && <p className={styles.feedback}>{mutation.message}</p>}{mutation.status === "uncertain" && <p className={styles.feedback}>결과를 확인하지 못했어요. 입력을 유지하고 같은 요청으로 다시 확인해 주세요.</p>}</div>
    <button className={`${styles.button} ${styles.formButton}`} type="submit" disabled={mutation.status === "pending"}>{mutation.status === "pending" ? "제출 중…" : mutation.status === "uncertain" ? "같은 요청으로 다시 확인" : revision ? "다시 검토 요청하기" : "검토 요청하기"}</button>
  </form>;
}
