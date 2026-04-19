"use client"

import type { ReactNode } from "react"
import { Download, File as FileIcon, X } from "lucide-react"

import { formatBytes } from "./formatBytes"

interface GenericFileCardProps {
  name: string
  size?: number
  url?: string
  icon?: ReactNode
  badge?: string
  onDelete?: () => void
  downloadLabel?: string
}

const SAFE_DOWNLOAD_SCHEMES = ["http:", "https:", "blob:", "data:"]

function getSafeDownloadHref(url?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.href)
    return SAFE_DOWNLOAD_SCHEMES.includes(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

export default function GenericFileCard({
  name,
  size,
  url,
  icon,
  badge,
  onDelete,
  downloadLabel = "다운로드",
}: GenericFileCardProps) {
  const sizeLabel = formatBytes(size)
  const safeHref = getSafeDownloadHref(url)

  return (
    <div className="group relative flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-tertiary text-text-secondary">
        {icon ?? <FileIcon size={18} />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-body text-text-primary">{name || "파일"}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-surface-tertiary px-2 py-0.5 text-caption text-text-secondary">
              {badge}
            </span>
          )}
        </div>
        {sizeLabel && <span className="text-caption text-text-tertiary">{sizeLabel}</span>}
      </div>
      {safeHref && (
        <a
          href={safeHref}
          target="_blank"
          rel="noreferrer noopener"
          download={name || undefined}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-sm px-3 text-body-sm text-text-secondary hover:bg-surface-tertiary"
        >
          <Download size={14} />
          <span>{downloadLabel}</span>
        </a>
      )}
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
  )
}
