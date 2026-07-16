"use client"

import { useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { createExperience, getExperiences } from "@/lib/api/experience-api"
import { toSavePayload } from "@/lib/utils/experience-mapper"
import { capture } from "@/lib/analytics"
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

  async function handleSave(exp: ExperienceV2) {
    setSaving(true)
    try {
      const payload = toSavePayload(exp)
      const savedId = await createExperience(payload)
      setError(null)
      // 저장 성공 — 미저장 플래그를 내려 beforeunload 경고 없이 목록으로 복귀한다.
      setHasUnsaved(false)
      // 기록 생성 완료(FRT-19). status 로 draft·complete 를 구분한다.
      capture("record_created", { experience_type: payload.type, status: exp.status })
      // 최초 1회 판정: 방금 만든 것을 포함해 목록이 정확히 1건이면 첫 기록.
      // 프론트에 카운터가 없어 서버 count 로 판정한다(localStorage 는 크로스기기 불안정).
      // 네비게이션을 막지 않도록 fire-and-forget — 실패해도 기록 저장 흐름엔 영향 없다.
      void getExperiences()
        .then((list) => {
          if (list.count === 1) {
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
      />
    </InputViewShell>
  )
}
