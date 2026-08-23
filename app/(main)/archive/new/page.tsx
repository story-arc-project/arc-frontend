"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { createExperience, getExperiences } from "@/lib/api/experience-api"
import { toSavePayload } from "@/lib/utils/experience-mapper"
import { capture, markFirstRecordIfUnseen, useArchiveEntryAnalytics } from "@/lib/analytics"
import { useAuth } from "@/hooks/useAuth"
import { useBasePath } from "@/lib/utils/use-base-path"
import { safeReturnTo } from "@/lib/utils/archive-context"
import ExperienceFormV2, {
  type ExperienceFormV2Handle,
} from "@/components/features/archive/ExperienceFormV2"
import InputViewShell from "@/app/(main)/archive/_components/InputViewShell"
import type { ExperienceV2 } from "@/types/archive"

export default function ArchiveNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = useBasePath()
  // 첫 기록 마커를 사용자별로 스코프하기 위한 시드(원본 이메일은 저장·전송되지 않는다).
  const { user } = useAuth()
  const formRef = useRef<ExperienceFormV2Handle | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<{ id: string; label: string }[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  // FRT-82: 리스트가 실어보낸 returnTo(라이브러리·필터 컨텍스트, basePath 내장)를 복원한다.
  // 취소·이탈은 이 backTo 로 되돌아간다(아무것도 만들지 않았으므로 컨텍스트 복원이 안전).
  // 신뢰 불가 값이라 safeReturnTo 로 같은 출처 archive 경로만 통과시키고, 추가 디코딩하지 않는다.
  const backTo = safeReturnTo(searchParams.get("returnTo"), basePath, `${basePath}/archive`)

  // 입력 폼 진입(FRT-113). archive_type_selected·record_created 와 이어 붙이면
  // "진입 → 유형선택 → 저장" 구간별 이탈이 보인다. 여기가 유일한 새 기록 입력 진입점이다.
  // 재진입(뒤로가기 후 다시 시작)은 각각 1건으로 세는 게 의도 — 세션 dedup 을 두지 않는다.
  // ref 가드는 StrictMode 의 이중 마운트만 걸러 같은 진입이 2건으로 부풀지 않게 한다.
  const entryCapturedRef = useRef(false)
  useEffect(() => {
    if (entryCapturedRef.current) return
    entryCapturedRef.current = true
    capture("archive_entry_started", {})
  }, [])

  // 진입 23 → 저장 4(180일 실측). 사라진 83% 가 **이 화면 안에서** 사라져 퍼널로는
  // 어디서 멈췄는지 볼 수 없다 — 멈춘 자리·진행률·경과를 여기서 남긴다(FRT-107).
  const entryAnalytics = useArchiveEntryAnalytics({ mode: "new", active: true, saving })

  async function handleSave(exp: ExperienceV2) {
    setSaving(true)
    try {
      const payload = toSavePayload(exp)
      const savedId = await createExperience(payload)
      setError(null)
      // 저장 성공 — 미저장 플래그를 내려 beforeunload 경고 없이 목록으로 복귀한다.
      setHasUnsaved(false)
      // 여기서부터 이 진입은 이탈이 아니다(FRT-107). 진행 속성은 이탈 이벤트와 **같은
      // 이름·같은 시계**라, 끝낸 사람과 포기한 사람을 나란히 놓고 무엇이 달랐는지 물을 수 있다.
      const progress = entryAnalytics.progressProps()
      entryAnalytics.markSaved()
      // 기록 생성 완료(FRT-19). status 로 draft·complete 를 구분한다.
      capture("record_created", {
        experience_type: payload.type,
        status: exp.status,
        elapsed_seconds: progress.elapsed_seconds,
        sections_done: progress.sections_done,
        sections_total: progress.sections_total,
        qualitative_fields_filled: progress.qualitative_fields_filled,
      })
      // 최초 1회 판정: 서버 count===1 을 1차 근거로 하되, 전체 삭제 후 재생성 재발화를
      // 디바이스 마커로 막는다(markFirstRecordIfUnseen). 네비게이션을 막지 않도록 fire-and-forget.
      void getExperiences()
        .then(async (list) => {
          if (await markFirstRecordIfUnseen(list.count, user?.account.email ?? "")) {
            capture("first_record_created", { experience_type: payload.type })
          }
        })
        .catch(() => {})
      // 새 레코드는 방금 만든 것이므로 항상 전체 라이브러리로 복귀해 확실히 보이게 한다.
      // 수동 라이브러리 컨텍스트를 복원하면(lib=...) 새 레코드는 그 라이브러리 멤버가
      // 아니라 프리뷰를 닫는 순간 목록에서 사라진다(Codex P2). 복귀 시 ?id 로 미리보기만 도킹.
      router.push(`${basePath}/archive?id=${savedId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "경험을 저장하지 못했어요")
      setSaving(false)
    }
  }

  return (
    <InputViewShell
      formRef={formRef}
      hasUnsaved={hasUnsaved}
      backTo={backTo}
      saving={saving}
      sections={sections}
      progress={progress}
    >
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="max-w-[640px] mx-auto mt-4 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-body-sm"
        >
          {error}
        </div>
      )}
      <ExperienceFormV2
        ref={formRef}
        mode="new"
        hideInlineActions
        onSave={handleSave}
        onCancel={() => router.push(backTo)}
        onUnsavedChange={setHasUnsaved}
        onVisibleSectionsChange={setSections}
        onProgressChange={setProgress}
        onCompletionChange={entryAnalytics.handleCompletionChange}
      />
    </InputViewShell>
  )
}
