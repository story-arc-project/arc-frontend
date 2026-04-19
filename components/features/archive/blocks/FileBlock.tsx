"use client"

import { useEffect, useState } from "react"
import { Paperclip, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { deleteFile, getFileUrl, MAX_FILE_SIZE_BYTES } from "@/lib/api/files-api"
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

export default function FileBlock({ block, readOnly, onChange }: FileBlockProps) {
  const val = block.value as FileBlockValue
  const { state, progress, error, start, cancel, reset } = useFileUpload()
  const [fetched, setFetched] = useState<{ id: string; url: string } | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)

  const resolvedUrl =
    val.url ?? (fetched && fetched.id === val.fileId ? fetched.url : undefined)

  useEffect(() => {
    if (!val.fileId || val.url) return
    let cancelled = false
    getFileUrl(val.fileId)
      .then((info) => {
        if (!cancelled && val.fileId) {
          setFetched({ id: val.fileId, url: info.url })
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
  }, [val.fileId, val.url])

  function update(field: keyof Omit<FileBlockValue, "type">, v: string) {
    onChange({ ...val, [field]: v })
  }

  async function handleSelect(file: File) {
    const uploaded = await start(file)
    if (!uploaded) return
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

  async function handleDelete() {
    const prev = val
    onChange({
      type: "file",
      fileName: "",
      description: val.description,
      evidenceType: val.evidenceType,
    })
    setFetched(null)
    setUrlError(null)
    reset()
    if (prev.fileId) {
      try {
        await deleteFile(prev.fileId)
      } catch {
        // 파일 원본 삭제 실패는 서버 정리 정책에 맡기고 UI는 이미 초기화됨
      }
    }
  }

  const hasUploaded = Boolean(val.fileId)
  const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))

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
      <legend className="text-label text-text-primary mb-1">{block.label}</legend>

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
          <span className="text-body-sm text-text-tertiary">
            파일 선택… (최대 {maxMb}MB)
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
        <Input
          placeholder="증빙 유형 (성적표/상장 등)"
          value={val.evidenceType}
          onChange={(e) => update("evidenceType", e.target.value)}
        />
      </div>
    </fieldset>
  )
}
