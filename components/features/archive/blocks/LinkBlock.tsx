"use client"

import { ExternalLink, Link as LinkIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import type { Block, LinkBlockValue } from "@/types/archive"

interface LinkBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: LinkBlockValue) => void
}

const SAFE_SCHEMES = ["http:", "https:", "mailto:"]

function getSafeHref(url: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return SAFE_SCHEMES.includes(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export default function LinkBlock({ block, readOnly, onChange }: LinkBlockProps) {
  const val = block.value as LinkBlockValue

  function update(field: keyof Omit<LinkBlockValue, "type">, v: string) {
    onChange({ ...val, [field]: v })
  }

  if (readOnly) {
    const safeHref = getSafeHref(val.url)
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.url ? (
          <div className="mt-1 flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-tertiary text-text-secondary">
              <LinkIcon size={16} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body text-text-primary">
                {val.title || getDomain(val.url)}
              </span>
              <span className="truncate text-caption text-text-tertiary">
                {getDomain(val.url)}
              </span>
              {val.description && (
                <span className="mt-1 text-body-sm text-text-secondary">{val.description}</span>
              )}
              {val.linkType && (
                <span className="mt-1 self-start rounded-full bg-surface-tertiary px-2 py-0.5 text-caption text-text-secondary">
                  {val.linkType}
                </span>
              )}
            </div>
            {safeHref && (
              <a
                href={safeHref}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="링크 열기"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-tertiary"
              >
                <ExternalLink size={14} />
              </a>
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
      <Input
        placeholder="https://..."
        value={val.url}
        onChange={e => update("url", e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="제목 (선택)"
          value={val.title}
          onChange={e => update("title", e.target.value)}
        />
        <Input
          placeholder="유형 (데모/문서/기사 등)"
          value={val.linkType}
          onChange={e => update("linkType", e.target.value)}
        />
      </div>
      <Input
        placeholder="설명 (선택)"
        value={val.description}
        onChange={e => update("description", e.target.value)}
      />
    </fieldset>
  )
}
