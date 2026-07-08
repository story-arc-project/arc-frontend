"use client"

import { useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

import { updateExperience } from "@/lib/api/experience-api"
import { toExperienceV2, toSavePayload } from "@/lib/utils/experience-mapper"
import { useBasePath } from "@/lib/utils/use-base-path"
import { useExperience } from "@/hooks/useExperience"
import { safeReturnTo } from "@/lib/utils/archive-context"
import ExperienceFormV2, {
  type ExperienceFormV2Handle,
} from "@/components/features/archive/ExperienceFormV2"
import InputViewShell from "@/app/(main)/archive/_components/InputViewShell"
import type { ExperienceV2 } from "@/types/archive"

export default function ArchiveEditPage() {
  const router = useRouter()
  const basePath = useBasePath()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { experience, error } = useExperience(id)
  const formRef = useRef<ExperienceFormV2Handle | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sections, setSections] = useState<{ id: string; label: string }[]>([])

  // FRT-82: 리스트 페이지가 실어보낸 returnTo(라이브러리·필터 컨텍스트 포함, basePath 내장)를
  // 그대로 backTo 로 되돌린다. 없으면(딥링크·북마크 진입) 해당 레코드 상세로 폴백.
  // returnTo 에는 이미 basePath 가 박혀 있으므로 다시 붙이지 않는다. 신뢰 불가 값이라
  // safeReturnTo 로 같은 출처 archive 경로만 통과시키고, searchParams.get 이 이미 1회
  // 디코딩했으므로 추가 디코딩하지 않는다(내부 쿼리 %26 보존 → 필터 온전 복원).
  const backTo = safeReturnTo(searchParams.get("returnTo"), `${basePath}/archive?id=${id}`)

  const experienceV2 = useMemo(
    () => (experience ? toExperienceV2(experience) : null),
    [experience],
  )

  async function handleSave(exp: ExperienceV2) {
    setSaving(true)
    try {
      const payload = toSavePayload(exp)
      await updateExperience(id, {
        content: payload.content,
        importance: payload.importance,
      })
      setSaveError(null)
      setHasUnsaved(false)
      router.push(backTo)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "경험을 저장하지 못했어요")
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-[calc(100dvh-var(--gnb-h))] text-text-tertiary">
        <p className="text-body">경험을 불러오지 못했어요</p>
        <Link
          href={`${basePath}/archive`}
          className="text-brand text-body-sm hover:text-brand-dark transition-colors"
        >
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  // useExperience 의 isLoading 은 마운트 후 비동기로 켜지므로(초기값 false), 첫 동기
  // 렌더의 에러 화면 플래시를 피하려 "데이터도 에러도 없으면 로딩"으로 판정한다.
  if (!experienceV2) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-var(--gnb-h))] text-text-tertiary">
        <p className="text-body">불러오는 중…</p>
      </div>
    )
  }

  return (
    <InputViewShell
      formRef={formRef}
      hasUnsaved={hasUnsaved}
      backTo={backTo}
      saving={saving}
      sections={sections}
    >
      {saveError && (
        <div
          role="alert"
          aria-live="polite"
          className="max-w-[640px] mx-auto mt-4 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-body-sm"
        >
          {saveError}
        </div>
      )}
      <ExperienceFormV2
        // 편집 대상이 바뀌면 폼을 새 레코드로 재시드(switching edit between cards).
        key={id}
        ref={formRef}
        mode="edit"
        initialExperience={experienceV2}
        hideInlineActions
        onSave={handleSave}
        onCancel={() => router.push(backTo)}
        onUnsavedChange={setHasUnsaved}
        onVisibleSectionsChange={setSections}
      />
    </InputViewShell>
  )
}
