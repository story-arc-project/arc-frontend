"use client"

import { useEffect, useRef, useState } from "react"
import { Paperclip } from "lucide-react"

import { capture } from "@/lib/analytics"
import { getFileUrl, MAX_FILE_SIZE_BYTES } from "@/lib/api/files-api"
import { useFileUpload } from "@/hooks/useFileUpload"
import type { FileCellValue } from "@/types/archive"

import GenericFileCard from "./GenericFileCard"

interface FileCellInputProps {
  value: FileCellValue | undefined
  readOnly?: boolean
  ariaLabel?: string
  onChange: (value: FileCellValue) => void
}

/** 빈 파일 셀. `createEmptyRow` 가 채우는 `''` 과 같은 뜻이지만 타입이 맞는 형태다. */
const EMPTY_FILE_CELL: FileCellValue = { type: "file", fileId: "", fileName: "" }

/**
 * 반복 기록 표의 `file` 컬럼 셀 (FRT-213).
 *
 * 블록 층위 `FileBlock` 과 달리 **파일 한 개만** 받는다 — mime 별 미리보기 5종·설명·증빙 유형은
 * 표의 한 칸에 들어갈 분량이 아니다. 설명이 필요하면 템플릿이 별도 텍스트 컬럼을 두면 된다.
 * 업로드 배선(presign→PUT→confirm)은 `useFileUpload` 를 그대로 재사용한다.
 */
export default function FileCellInput({ value, readOnly, ariaLabel, onChange }: FileCellInputProps) {
  const val = value ?? EMPTY_FILE_CELL
  const { state, progress, error, start, reset } = useFileUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fetched, setFetched] = useState<{ id: string; url: string } | null>(null)

  // 언마운트 뒤 완료된 업로드가 사라진 셀에 onChange 를 때리지 않게 한다(FileBlock 과 같은 이유).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // presigned URL 은 만료되므로 값에 저장하지 않고 표시 시점에 받아온다.
  useEffect(() => {
    const id = val.fileId
    if (!id) return
    let cancelled = false
    getFileUrl(id)
      .then(info => {
        if (!cancelled) setFetched({ id, url: info.url })
      })
      .catch(() => {
        // 다운로드 링크만 못 붙는다 — 파일명·크기는 셀 값에 있으므로 카드 자체는 그대로 보인다.
        if (!cancelled) setFetched(null)
      })
    return () => {
      cancelled = true
    }
  }, [val.fileId])

  const resolvedUrl = fetched && fetched.id === val.fileId ? fetched.url : undefined
  const hasUploaded = Boolean(val.fileId)

  async function handleSelect(file: File) {
    const uploaded = await start(file)
    if (!uploaded) return
    if (!mountedRef.current) return
    // 업로드가 확정된 시점에만 첨부로 센다(FRT-113). 파일명·용량은 싣지 않는다(PII).
    capture("archive_attachment_added", { attachment_type: "file" })
    onChange({
      type: "file",
      fileId: uploaded.id,
      fileName: uploaded.originalName || file.name,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    })
    setFetched(uploaded.url && uploaded.id ? { id: uploaded.id, url: uploaded.url } : null)
  }

  function handleDelete() {
    // 원격 삭제는 하지 않는다 — 폼을 취소했을 때 원본이 먼저 사라지면 복구할 수 없다.
    onChange(EMPTY_FILE_CELL)
    setFetched(null)
    reset()
  }

  if (readOnly) {
    if (!hasUploaded) return <span className="text-body-sm text-text-disabled">—</span>
    return <GenericFileCard name={val.fileName} size={val.size} url={resolvedUrl} />
  }

  if (hasUploaded) {
    return (
      <GenericFileCard
        name={val.fileName}
        size={val.size}
        url={resolvedUrl}
        onDelete={handleDelete}
      />
    )
  }

  const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={ariaLabel}
        onChange={e => {
          const file = e.target.files?.[0]
          // 같은 파일을 다시 고를 수 있게 값을 비운다(브라우저는 동일 경로에 change 를 안 쏜다).
          e.target.value = ""
          if (file) void handleSelect(file)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === "uploading"}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-3 text-body-sm text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Paperclip size={14} />
        {state === "uploading" ? `업로드 중 ${progress}%` : `파일 선택 (최대 ${maxMb}MB)`}
      </button>
      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}
    </div>
  )
}
