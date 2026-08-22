"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

import { updateExperience } from "@/lib/api/experience-api"
import { capture, useArchiveEntryAnalytics } from "@/lib/analytics"
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
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  // FRT-82: 리스트 페이지가 실어보낸 returnTo(라이브러리·필터 컨텍스트 포함, basePath 내장)를
  // 그대로 backTo 로 되돌린다. 없으면(딥링크·북마크 진입) 해당 레코드 상세로 폴백.
  // returnTo 에는 이미 basePath 가 박혀 있으므로 다시 붙이지 않는다. 신뢰 불가 값이라
  // safeReturnTo 로 같은 출처 archive 경로만 통과시키고, searchParams.get 이 이미 1회
  // 디코딩했으므로 추가 디코딩하지 않는다(내부 쿼리 %26 보존 → 필터 온전 복원).
  const backTo = safeReturnTo(
    searchParams.get("returnTo"),
    basePath,
    `${basePath}/archive?id=${id}`,
  )

  const experienceV2 = useMemo(
    () => (experience ? toExperienceV2(experience) : null),
    [experience],
  )

  // 지금 라우트가 가리키는 그 기록을 실제로 들고 있는가. useExperience 는 새 id 의 응답이
  // 올 때까지 **앞 기록을 그대로 돌려주므로**(초기화하지 않는다), 이 확인 없이는 A→B 전환
  // 중에 A 의 데이터가 B 의 것으로 계측된다.
  const loadedId = experienceV2?.id === id ? id : null

  // FRT-107: 기록을 불러오는 동안은 폼이 없다 — 그 시간을 이탈로 세면 로딩이 곧 포기가 된다.
  const entryAnalytics = useArchiveEntryAnalytics({
    mode: "edit",
    active: !!loadedId,
    // 기록마다 한 세션. 페이지가 재사용돼도 앞 기록의 시계·완료 자취를 물려받지 않는다.
    sessionKey: loadedId ?? undefined,
    saving,
  })

  // 임시저장을 다시 열어 이어쓰기 시작한 시점(FRT-107). **draft 일 때만** 센다 —
  // 완성된 기록의 수정까지 섞으면 "재방문 의도가 있는 이탈이 회수됐는가"라는 질문이
  // 평범한 편집에 묻힌다. 문서(id)당 1회: 폼 재시드(key={id})와 같은 축으로 묶는다.
  const resumeCapturedRef = useRef<string | null>(null)
  useEffect(() => {
    // 아직 이 id 의 기록이 아니면(전환 중 앞 기록) 판단하지 않는다 — 앞 기록이 draft 라는
    // 이유로 지금 id 를 발화 완료로 찍으면, 정작 이 기록의 이어쓰기가 영영 안 잡힌다.
    if (!loadedId || !experienceV2 || experienceV2.status !== "draft") return
    if (resumeCapturedRef.current === loadedId) return
    resumeCapturedRef.current = loadedId
    capture("archive_entry_resumed", { experience_type: experienceV2.typeId })
  }, [experienceV2, loadedId])

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
      // 여기서부터 이 수정은 이탈이 아니다(FRT-107).
      entryAnalytics.markSaved()
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
      progress={progress}
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
        onProgressChange={setProgress}
        onCompletionChange={entryAnalytics.handleCompletionChange}
      />
    </InputViewShell>
  )
}
