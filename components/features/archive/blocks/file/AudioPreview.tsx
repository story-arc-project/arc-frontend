"use client"

import { Music, X } from "lucide-react"

import { formatBytes } from "./formatBytes"

interface AudioPreviewProps {
  name: string
  url: string
  mimeType: string
  size?: number
  onDelete?: () => void
}

export default function AudioPreview({ name, url, mimeType, size, onDelete }: AudioPreviewProps) {
  const sizeLabel = formatBytes(size)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-tertiary text-text-secondary">
          <Music size={18} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body text-text-primary">{name || "오디오"}</span>
          {sizeLabel && <span className="text-caption text-text-tertiary">{sizeLabel}</span>}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="첨부 삭제"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <audio controls preload="metadata" className="w-full">
        <source src={url} type={mimeType} />
        {name}
      </audio>
    </div>
  )
}
