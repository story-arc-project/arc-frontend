"use client"

import { useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

import { updateExperience } from "@/lib/api/experience-api"
import { toExperienceV2, toSavePayload } from "@/lib/utils/experience-mapper"
import { useBasePath } from "@/lib/utils/use-base-path"
import { useExperience } from "@/hooks/useExperience"
import { usePresets } from "@/hooks/usePresets"
import ExperienceFormV2, {
  type ExperienceFormV2Handle,
} from "@/components/features/archive/ExperienceFormV2"
import InputViewShell from "@/app/(main)/archive/_components/InputViewShell"
import type { ExperienceV2 } from "@/types/archive"

export default function ArchiveEditPage() {
  const router = useRouter()
  const basePath = useBasePath()
  const { id } = useParams<{ id: string }>()
  const presetsHook = usePresets()
  const { experience, isLoading, error } = useExperience(id)
  const formRef = useRef<ExperienceFormV2Handle | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const backTo = `${basePath}/archive?id=${id}`

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-var(--gnb-h))] text-text-tertiary">
        <p className="text-body">불러오는 중…</p>
      </div>
    )
  }

  if (error || !experienceV2) {
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

  return (
    <InputViewShell
      formRef={formRef}
      hasUnsaved={hasUnsaved}
      backTo={backTo}
      saving={saving}
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
        presetsHook={presetsHook}
        onSave={handleSave}
        onCancel={() => router.push(backTo)}
        onUnsavedChange={setHasUnsaved}
      />
    </InputViewShell>
  )
}
