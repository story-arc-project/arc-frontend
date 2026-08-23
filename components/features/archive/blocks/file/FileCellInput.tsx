"use client"

import { useEffect, useRef, useState } from "react"
import { Paperclip, X } from "lucide-react"

import { capture } from "@/lib/analytics"
import { getFileUrl, MAX_FILE_SIZE_BYTES } from "@/lib/api/files-api"
import { useFileUpload } from "@/hooks/useFileUpload"
import type { FileCellValue } from "@/types/archive"

import GenericFileCard from "./GenericFileCard"

interface FileCellInputProps {
  value: FileCellValue | undefined
  readOnly?: boolean
  ariaLabel?: string
  /**
   * 업로드가 진행 중인지 상위에 알린다 (`FileBlock.onBusyChange` 와 같은 계약).
   *
   * 업로드 중에는 셀 값(`fileId`)이 아직 비어 있어 "아무것도 안 고른 칸"과 구분되지 않는다.
   * 그때 이 셀을 없애는 조작(결과물 삭제 등)이 통과하면 컴포넌트가 언마운트되며 요청이
   * abort 되고, 늦게 온 결과도 `mountedRef` 가드에서 버려져 **고른 파일이 조용히 사라진다**.
   * 값으로는 알 수 없는 상태이므로 신호로 흘려 그 순간에만 막게 한다.
   */
  onBusyChange?: (busy: boolean) => void
  onChange: (value: FileCellValue) => void
}

/** 빈 파일 셀. `createEmptyRow` 가 채우는 `''` 과 같은 뜻이지만 타입이 맞는 형태다. */
const EMPTY_FILE_CELL: FileCellValue = { type: "file", fileId: "", fileName: "" }

/** 만료 얼마 전에 링크를 다시 받을지. 내려받는 동안 만료되지 않을 만큼은 남겨둔다. */
const URL_REFRESH_MARGIN_MS = 60_000
/** 이미 만료가 임박한 링크로 재조회가 몰아치지 않게 두는 최소 간격. */
const URL_REFRESH_MIN_MS = 30_000
/**
 * 만료 시각을 못 받았을 때 쓰는 기본 주기.
 *
 * 이쪽이 **주경로**다 — 실계약(`pickUrl` 주석)상 `GET /files/{id}/download` 의 `data` 는
 * presigned URL 문자열 그 자체라 만료 시각이 딸려오지 않는다. 만료 시각이 있을 때만
 * 갱신하면 프로덕션에서는 한 번도 갱신되지 않고, 오래 열어둔 화면의 다운로드가 죽는다.
 * 서버 TTL 을 모르므로 흔한 최소값(5~15분)보다 짧게 잡는다.
 */
const URL_REFRESH_FALLBACK_MS = 5 * 60_000

/** 다음 재조회까지 남은 시간. 서버가 만료 시각을 주면 그에 맞추고, 아니면 기본 주기를 쓴다. */
function refreshDelayMs(expiresAt: string | undefined): number {
  if (!expiresAt) return URL_REFRESH_FALLBACK_MS
  const at = Date.parse(expiresAt)
  if (Number.isNaN(at)) return URL_REFRESH_FALLBACK_MS
  return Math.max(at - Date.now() - URL_REFRESH_MARGIN_MS, URL_REFRESH_MIN_MS)
}

/**
 * 반복 기록 표의 `file` 컬럼 셀 (FRT-213).
 *
 * 블록 층위 `FileBlock` 과 달리 **파일 한 개만** 받는다 — mime 별 미리보기 5종·설명·증빙 유형은
 * 표의 한 칸에 들어갈 분량이 아니다. 설명이 필요하면 템플릿이 별도 텍스트 컬럼을 두면 된다.
 * 업로드 배선(presign→PUT→confirm)은 `useFileUpload` 를 그대로 재사용한다.
 */
export default function FileCellInput({
  value,
  readOnly,
  ariaLabel,
  onBusyChange,
  onChange,
}: FileCellInputProps) {
  const val = value ?? EMPTY_FILE_CELL
  const { state, progress, error, start, cancel, reset } = useFileUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fetched, setFetched] = useState<{ id: string; url: string } | null>(null)
  const [urlFailed, setUrlFailed] = useState(false)
  // 링크 조회 재시도용 — 값(fileId)이 그대로라 이 값이 바뀌어야 effect 가 다시 돈다.
  const [urlAttempt, setUrlAttempt] = useState(0)

  // 업로드는 네트워크라 그 사이 부모가 다시 그려진다. 시작 시점의 콜백은 그때의 행 전체를
  // 붙잡고 있어서, 그걸로 커밋하면 그동안 고친 다른 칸이 통째로 되감긴다 — 항상 최신 것을 쓴다.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // 언마운트되면 반드시 busy 를 내려 준다 — 안 그러면 상위가 '업로드 중'으로 굳은 채 남아
  // 삭제 버튼이 영영 돌아오지 않는다(FileBlock 과 같은 처방).
  const busy = state === "uploading"
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

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
    let timer: ReturnType<typeof setTimeout> | undefined
    getFileUrl(id)
      .then(info => {
        if (cancelled) return
        setFetched({ id, url: info.url })
        setUrlFailed(false)
        // 입력 폼은 오래 열어두는 화면이라 한 번 받고 말면 카드의 다운로드가 조용히 죽는다
        // (조회 자체는 성공했으니 실패 안내도 안 뜬다). 만료 전에 스스로 다시 받는다.
        timer = setTimeout(() => setUrlAttempt(n => n + 1), refreshDelayMs(info.expiresAt))
      })
      .catch(() => {
        // 파일명·크기는 셀 값에 있어 카드는 그대로 보이지만 다운로드 수단이 사라진다.
        // 조용히 삼키면 화면을 다시 열기 전엔 손쓸 방법이 없으므로 알리고 재시도를 연다.
        if (cancelled) return
        setFetched(null)
        setUrlFailed(true)
      })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [val.fileId, urlAttempt])

  const resolvedUrl = fetched && fetched.id === val.fileId ? fetched.url : undefined
  const hasUploaded = Boolean(val.fileId)

  async function handleSelect(file: File) {
    const uploaded = await start(file)
    if (!uploaded) return
    if (!mountedRef.current) return
    // 업로드가 확정된 시점에만 첨부로 센다(FRT-113). 파일명·용량은 싣지 않는다(PII).
    capture("archive_attachment_added", { attachment_type: "file" })
    onChangeRef.current({
      type: "file",
      fileId: uploaded.id,
      fileName: uploaded.originalName || file.name,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    })
    setFetched(uploaded.url && uploaded.id ? { id: uploaded.id, url: uploaded.url } : null)
    setUrlFailed(false)
  }

  function handleDelete() {
    // 원격 삭제는 하지 않는다 — 폼을 취소했을 때 원본이 먼저 사라지면 복구할 수 없다.
    onChange(EMPTY_FILE_CELL)
    setFetched(null)
    setUrlFailed(false)
    reset()
  }

  const urlFailNotice = urlFailed ? (
    <p className="text-caption text-error">
      다운로드 링크를 못 받았어요.{" "}
      <button
        type="button"
        onClick={() => setUrlAttempt(n => n + 1)}
        aria-label="다운로드 링크 다시 시도"
        className="underline"
      >
        다시 시도
      </button>
    </p>
  ) : null

  if (readOnly) {
    if (!hasUploaded) return <span className="text-body-sm text-text-disabled">—</span>
    return (
      <div className="flex flex-col gap-1">
        <GenericFileCard name={val.fileName} size={val.size} url={resolvedUrl} />
        {urlFailNotice}
      </div>
    )
  }

  if (hasUploaded) {
    return (
      <div className="flex flex-col gap-1">
        <GenericFileCard
          name={val.fileName}
          size={val.size}
          url={resolvedUrl}
          onDelete={handleDelete}
        />
        {urlFailNotice}
      </div>
    )
  }

  const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))
  const buttonLabel = state === "uploading" ? `업로드 중 ${progress}%` : `파일 선택 (최대 ${maxMb}MB)`

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
      {/*
        접근성 이름은 보이는 버튼에 붙인다 — 숨긴 input 은 접근성 트리에 없어서
        파일 컬럼이 여러 개면 전부 '파일 선택'으로만 읽히고 어느 칸인지 알 수 없다.
      */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state === "uploading"}
          aria-label={ariaLabel ? `${ariaLabel} ${buttonLabel}` : undefined}
          className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-3 text-body-sm text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Paperclip size={14} />
          {buttonLabel}
        </button>
        {/*
          업로드가 멈추면 위 버튼이 잠긴 채 손쓸 방법이 없다(XHR 에 타임아웃도 없다).
          블록 층위 `FileBlock` 과 같은 취소를 셀에도 둔다.
        */}
        {state === "uploading" && (
          <button
            type="button"
            onClick={cancel}
            aria-label="업로드 취소"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}
    </div>
  )
}
