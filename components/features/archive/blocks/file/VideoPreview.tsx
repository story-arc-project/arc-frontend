"use client"

import { X } from "lucide-react"

interface VideoPreviewProps {
  name: string
  url: string
  mimeType: string
  onDelete?: () => void
}

export default function VideoPreview({ name, url, mimeType, onDelete }: VideoPreviewProps) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-black">
      <video
        controls
        preload="metadata"
        className="block max-h-96 w-full"
      >
        <source src={url} type={mimeType} />
        {name}
      </video>
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
    </div>
  )
}
