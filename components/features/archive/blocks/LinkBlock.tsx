"use client"

import { useRef } from "react"
import { ExternalLink, Link as LinkIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { capture } from "@/lib/analytics"
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

  // URL 첨부 계측(FRT-113). URL 입력은 keystroke 단위라 "확정" 시점을 blur 로 잡되,
  // 세 가지 위양성을 막는다:
  //  - urlEditedRef: 사용자가 실제로 타이핑했는가. 기존 링크를 focus 만 했다 나가는 경우를 거른다
  //    (편집 모드에서 값이 나중에 주입돼도 타이핑 없이는 발화하지 않는다).
  //  - knownUrlRef: "이미 첨부로 아는 URL". 첫 타이핑 직전 값(편집 전 원본)으로 기준선을 세워,
  //    고쳤다가 원래대로 되돌린 경우를 거른다. 이후엔 마지막으로 발화한 URL 을 담는다.
  //  - 비교는 원문이 아니라 getSafeHref 의 정규화 결과로 한다 — `https://a.dev` 와
  //    `https://a.dev/` 는 같은 첨부다.
  const urlEditedRef = useRef(false)
  const knownUrlRef = useRef<string | null>(null)

  function handleUrlBlur() {
    if (!urlEditedRef.current) return
    // 안전한 스킴의 유효 URL 만 첨부로 인정한다(입력 중 끊긴 문자열·javascript: 제외).
    const safeUrl = getSafeHref(val.url)
    if (!safeUrl) return
    if (knownUrlRef.current === safeUrl) return
    knownUrlRef.current = safeUrl
    // URL 원문은 싣지 않는다(PII·식별 위험) — 첨부 "여부"만 본다.
    capture("archive_attachment_added", { attachment_type: "url" })
  }

  function update(field: keyof Omit<LinkBlockValue, "type">, v: string) {
    if (field === "url" && !urlEditedRef.current) {
      urlEditedRef.current = true
      // 편집을 시작한 순간의 값이 "이미 있던 첨부"다. 빈 값·무효값이면 기준선이 없다(null).
      knownUrlRef.current = getSafeHref(val.url)
    }
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
        hint={block.guide}
        hintPosition="top"
        value={val.url}
        onChange={e => update("url", e.target.value)}
        onBlur={handleUrlBlur}
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
