"use client"

import { useEffect, useRef, useState } from "react"
import { Paperclip, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { capture } from "@/lib/analytics"
import { getFileUrl, MAX_FILE_SIZE_BYTES } from "@/lib/api/files-api"
import { useFileUpload } from "@/hooks/useFileUpload"
import type { Block, FileBlockValue } from "@/types/archive"

import AudioPreview from "./file/AudioPreview"
import GenericFileCard from "./file/GenericFileCard"
import ImagePreview from "./file/ImagePreview"
import PdfCard from "./file/PdfCard"
import VideoPreview from "./file/VideoPreview"

interface FileBlockProps {
  block: Block
  readOnly?: boolean
  /**
   * 업로드가 진행 중인지 상위에 알린다(FRT-190).
   *
   * 업로드 중에는 블록 값이 아직 비어 있어 숨김 × 가 그대로 보이는데, 그때 숨기면 이 컴포넌트가
   * 언마운트되며 요청이 abort 되고 늦게 온 결과도 버려져 **고른 파일이 조용히 사라진다**.
   * 업로드 상태는 값이 아니라 여기 훅에만 있으므로, 순수 판정(`canHideBlock`)이 아니라
   * 이 신호로 그 순간에만 × 를 감춘다.
   */
  onBusyChange?: (busy: boolean) => void
  onChange: (value: FileBlockValue) => void
}

function pickPreview({
  val,
  resolvedUrl,
  onDelete,
}: {
  val: FileBlockValue
  resolvedUrl?: string
  onDelete?: () => void
}) {
  const url = resolvedUrl ?? val.url
  const mime = val.mimeType ?? ""
  const name = val.fileName

  if (!url) {
    return (
      <GenericFileCard
        name={name}
        size={val.size}
        onDelete={onDelete}
      />
    )
  }

  if (mime.startsWith("image/")) {
    return <ImagePreview name={name} url={url} onDelete={onDelete} />
  }
  if (mime.startsWith("video/")) {
    return <VideoPreview name={name} url={url} mimeType={mime} onDelete={onDelete} />
  }
  if (mime.startsWith("audio/")) {
    return (
      <AudioPreview
        name={name}
        url={url}
        mimeType={mime}
        size={val.size}
        onDelete={onDelete}
      />
    )
  }
  if (mime === "application/pdf") {
    return <PdfCard name={name} size={val.size} url={url} onDelete={onDelete} />
  }
  return (
    <GenericFileCard
      name={name}
      size={val.size}
      url={url}
      onDelete={onDelete}
    />
  )
}

export default function FileBlock({ block, readOnly, onBusyChange, onChange }: FileBlockProps) {
  const val = block.value as FileBlockValue
  const { state, progress, error, start, cancel, reset } = useFileUpload()
  const [fetched, setFetched] = useState<{ id: string; url: string } | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  // 업로드가 끝나기 전에 이 블록이 사라졌는지 판정한다(아래 handleSelect 참고).
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // 업로드가 끝나거나 이 블록이 사라지면 반드시 false 로 돌려놓는다 — 안 그러면 상위가
  // '업로드 중'으로 굳은 채 남아 숨김 버튼이 영영 돌아오지 않는다.
  const busy = state === "uploading"
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  const resolvedUrl =
    fetched && fetched.id === val.fileId ? fetched.url : val.url

  useEffect(() => {
    const id = val.fileId
    if (!id) return
    let cancelled = false
    getFileUrl(id)
      .then((info) => {
        if (!cancelled) {
          setFetched({ id, url: info.url })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "파일 정보를 불러오지 못했어요."
        setUrlError(message)
      })
    return () => {
      cancelled = true
    }
  }, [val.fileId])

  function update(field: keyof Omit<FileBlockValue, "type">, v: string) {
    onChange({ ...val, [field]: v })
  }

  async function handleSelect(file: File) {
    const uploaded = await start(file)
    if (!uploaded) return
    // useFileUpload 는 언마운트 뒤 완료된 업로드도 결과를 그대로 돌려준다. 이미 사라진 블록의
    // 업로드는 onChange 가 폼에 닿지 않아 첨부로 남지 않으므로, 계측도 하지 않는다(유령 첨부 방지).
    if (!mountedRef.current) return
    // 업로드가 확정된 시점에만 첨부로 센다(FRT-113) — 실패·취소는 첨부가 아니다.
    // 파일명·용량은 싣지 않는다(PII). 블록마다 발화하므로 이벤트 수 = 첨부 건수다.
    capture("archive_attachment_added", { attachment_type: "file" })
    onChange({
      ...val,
      fileName: uploaded.originalName || file.name,
      fileId: uploaded.id,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
      url: uploaded.url,
    })
    setFetched(uploaded.url && uploaded.id ? { id: uploaded.id, url: uploaded.url } : null)
    setUrlError(null)
  }

  function handleDelete() {
    // 원격 삭제는 부모 저장 성공 후 서버의 고아 파일 정리 정책에 맡긴다.
    // 여기서 즉시 deleteFile 을 호출하면 사용자가 폼을 취소했을 때 원본이 먼저 사라져 복구할 수 없다.
    onChange({
      type: "file",
      fileName: "",
      description: val.description,
      evidenceType: val.evidenceType,
    })
    setFetched(null)
    setUrlError(null)
    reset()
  }

  const hasUploaded = Boolean(val.fileId)
  const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))
  // 템플릿이 옵션을 정한 뒤에도 그 전에 자유 입력으로 저장된 값(레거시 데이터)이 있을 수 있다 —
  // 목록에 없다고 빼면 드롭다운이 비어 보여 값이 사라진 것처럼 보인다. 현재 값을 목록에 얹어 보존한다.
  const evidenceOptions =
    block.options?.length
      ? val.evidenceType && !block.options.includes(val.evidenceType)
        ? [...block.options, val.evidenceType]
        : block.options
      : undefined

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {hasUploaded ? (
          <div className="mt-1 flex flex-col gap-2">
            {pickPreview({ val, resolvedUrl })}
            {val.description && (
              <span className="text-body-sm text-text-secondary">{val.description}</span>
            )}
            {val.evidenceType && (
              <span className="self-start rounded-full bg-surface-tertiary px-2 py-0.5 text-caption text-text-secondary">
                {val.evidenceType}
              </span>
            )}
          </div>
        ) : val.fileName ? (
          <div className="flex items-center gap-2">
            <Paperclip size={14} className="text-text-tertiary" />
            <span className="text-body text-text-primary">{val.fileName}</span>
            {val.evidenceType && (
              <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-caption text-text-secondary">
                {val.evidenceType}
              </span>
            )}
          </div>
        ) : (
          <p className="text-body text-text-disabled">—</p>
        )}
      </div>
    )
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-field-label text-text-primary mb-1">{block.label}</legend>
      {block.guide && <p className="text-caption text-text-tertiary -mt-2">{block.guide}</p>}

      {state === "uploading" ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-body-sm text-text-secondary">업로드 중… {progress}%</span>
            <button
              type="button"
              onClick={cancel}
              aria-label="업로드 취소"
              className="flex h-8 w-8 items-center justify-center rounded-sm text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
            <div
              className="h-full bg-brand transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : hasUploaded ? (
        pickPreview({ val, resolvedUrl, onDelete: handleDelete })
      ) : (
        <label className="flex h-12 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 transition-colors hover:border-brand">
          <Paperclip size={16} className="text-text-tertiary" />
          <span className="truncate text-body-sm text-text-tertiary">
            {val.fileName
              ? `${val.fileName} · 교체하려면 클릭`
              : `파일 선택… (최대 ${maxMb}MB)`}
          </span>
          <input
            type="file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleSelect(file)
              e.target.value = ""
            }}
          />
        </label>
      )}

      {state === "error" && error && (
        <p className="text-body-sm text-error">{error}</p>
      )}
      {urlError && !error && (
        <p className="text-body-sm text-error">{urlError}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="설명 (선택)"
          value={val.description}
          onChange={(e) => update("description", e.target.value)}
        />
        {/* 템플릿이 증빙 유형 선택지를 정한 유형은 드롭다운으로 좁힌다(FRT-179).
            선택지가 없으면 무엇이 증빙인지 유형마다 달라 자유 입력을 유지한다. */}
        {evidenceOptions ? (
          <select
            aria-label="증빙 유형"
            value={val.evidenceType}
            onChange={(e) => update("evidenceType", e.target.value)}
            className={[
              "h-12 w-full rounded-md border border-border bg-surface px-4",
              "text-body text-text-primary",
              "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
              "transition-colors",
            ].join(" ")}
          >
            <option value="">증빙 유형 선택</option>
            {evidenceOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <Input
            placeholder="증빙 유형 (성적표/상장 등)"
            value={val.evidenceType}
            onChange={(e) => update("evidenceType", e.target.value)}
          />
        )}
      </div>
    </fieldset>
  )
}
