"use client"

import { useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { createExperience } from "@/lib/api/experience-api"
import { toSavePayload } from "@/lib/utils/experience-mapper"
import { useBasePath } from "@/lib/utils/use-base-path"
import { withIdInReturnTo } from "@/lib/utils/archive-context"
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

  // FRT-82: 리스트가 실어보낸 returnTo(라이브러리·필터 컨텍스트, basePath 내장)를 복원한다.
  // 취소·이탈은 이 backTo(id 없음)로, 저장 성공은 방금 만든 레코드 id를 병합해 복귀한다.
  const returnTo = searchParams.get("returnTo")
  const decodedReturnTo = returnTo ? decodeURIComponent(returnTo) : null
  const backTo = decodedReturnTo ?? `${basePath}/archive`

  async function handleSave(exp: ExperienceV2) {
    setSaving(true)
    try {
      const savedId = await createExperience(toSavePayload(exp))
      setError(null)
      // 저장 성공 — 미저장 플래그를 내려 beforeunload 경고 없이 목록으로 복귀한다.
      setHasUnsaved(false)
      router.push(
        decodedReturnTo
          ? withIdInReturnTo(decodedReturnTo, savedId)
          : `${basePath}/archive?id=${savedId}`,
      )
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
      />
    </InputViewShell>
  )
}
