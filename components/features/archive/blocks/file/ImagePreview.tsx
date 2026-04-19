"use client"

import { X } from "lucide-react"

interface ImagePreviewProps {
  name: string
  url: string
  onDelete?: () => void
}

export default function ImagePreview({ name, url, onDelete }: ImagePreviewProps) {
  return (
    <figure className="group relative inline-block max-w-full overflow-hidden rounded-md border border-border bg-surface-tertiary">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name || "첨부 이미지"}
        className="block max-h-80 w-auto max-w-full object-contain"
      />
      {name && (
        <figcaption className="border-t border-border bg-surface px-3 py-2 text-caption text-text-tertiary">
          {name}
        </figcaption>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="첨부 삭제"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </figure>
  )
}
