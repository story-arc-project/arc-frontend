"use client"

import { useState } from "react"
import { Pencil, Trash2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import BlockList from "./blocks/BlockList"
import type { ExperienceV2 } from "@/types/archive"
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2"

interface ExperienceDetailV2Props {
  experience: ExperienceV2
  onEdit: () => void
  onDelete: (id: string) => void
  onDuplicate: (exp: ExperienceV2) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
}

export default function ExperienceDetailV2({
  experience,
  onEdit,
  onDelete,
  onDuplicate,
}: ExperienceDetailV2Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const typeInfo = EXPERIENCE_TYPE_MAP[experience.typeId]

  const allExtBlocks = experience.extensionBlocks
  const hasExtension = allExtBlocks.some(b => {
    const v = b.value
    if (v.type === "text" || v.type === "textarea") return v.text.trim() !== ""
    if (v.type === "tags") return v.tags.length > 0
    if (v.type === "repeatable-cell") return v.rows.length > 0
    return false
  })

  const noop = () => {}

  return (
    <div className="max-w-[640px] mx-auto px-5 py-6 md:px-12 md:py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="brand">{typeInfo?.label ?? "경험"}</Badge>
            <Badge variant={experience.status === "complete" ? "success" : "warning"}>
              {experience.status === "complete" ? "완료" : "작성 중"}
            </Badge>
          </div>
          <h2 className="text-heading-3 text-text-primary">{experience.title || "(제목 없음)"}</h2>
          {experience.summary && (
            <p className="text-body text-text-secondary">{experience.summary}</p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="수정">
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDuplicate(experience)} aria-label="복제">
            <Copy size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="삭제"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Tags */}
      {experience.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {experience.tags.map(tag => (
            <span
              key={tag}
              className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Core fields */}
      <div className="flex flex-col gap-5 mb-6">
        <h3 className="text-title text-text-primary">기본 정보</h3>
        <BlockList blocks={experience.coreBlocks} readOnly onChange={noop} />
      </div>

      {/* Extension fields */}
      {hasExtension && (
        <div className="flex flex-col gap-5 mb-6">
          <h3 className="text-title text-text-primary">상세 정보</h3>
          <BlockList blocks={allExtBlocks} readOnly onChange={noop} />
        </div>
      )}

      {/* Custom fields */}
      {experience.customBlocks.length > 0 && (
        <div className="flex flex-col gap-5 mb-6">
          <h3 className="text-title text-text-primary">추가 블록</h3>
          <BlockList blocks={experience.customBlocks} readOnly onChange={noop} />
        </div>
      )}

      {/* Meta */}
      <p className="text-caption text-text-disabled mt-6">
        마지막 수정: {formatDate(experience.updatedAt)}
      </p>

      {/* Delete confirmation */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        ariaLabel="경험 삭제 확인"
      >
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-heading-3 text-text-primary">경험을 삭제할까요?</h3>
            <p className="text-body-sm text-text-tertiary mt-1">
              삭제된 경험은 복구할 수 없어요.
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowDeleteConfirm(false)
                onDelete(experience.id)
              }}
            >
              삭제
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
