"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import type { Block } from "@/types/archive"
import BlockList from "./blocks/BlockList"

interface FormSectionProps {
  label: string
  blocks: Block[]
  variant?: "collapsible" | "card"
  description?: string
  optional?: boolean
  sectionId?: string
  defaultCollapsed?: boolean
  readOnly?: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
  /** 블록 편집(연필) 노출 여부. 미지정 시 allowAdd 를 따른다. 추가는 막되 편집만 허용할 때 단독으로 켠다. */
  allowEdit?: boolean
  /** 제목 인라인 편집(사용자 섹션, FRT-78). onLabelChange 와 함께 사용. */
  editableLabel?: boolean
  onLabelChange?: (label: string) => void
  /** 섹션 자체 삭제(사용자 섹션). 지정 시 헤더에 삭제 버튼 노출. */
  onDelete?: () => void
  /** 섹션 카드 위/아래 이동(사용자 섹션 정렬, FRT-78). 경계에서는 undefined 로 비활성. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  /**
   * 이 카드에서 숨겨진 선택 필드 (FRT-190). 카드 하단 '숨긴 항목 N개' 토글로 되살린다.
   * 숨김 필터는 `computeFormCards` 가 아니라 이 렌더 층에서만 적용한다 — 카드 모델에서 빼면
   * 마지막 필드를 숨긴 순간 `blocks.length === 0` 으로 카드가 통째로 사라져 되살리기 경로까지
   * 같이 증발한다.
   */
  hiddenBlocks?: Block[]
  onHide?: (block: Block) => void
  onUnhide?: (block: Block) => void
  onChange: (blocks: Block[]) => void
}

export default function FormSection({
  label,
  blocks,
  variant = "collapsible",
  description,
  optional,
  sectionId,
  defaultCollapsed = false,
  readOnly,
  allowAdd,
  allowReorder,
  allowDelete,
  allowEdit,
  editableLabel,
  onLabelChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  hiddenBlocks,
  onHide,
  onUnhide,
  onChange,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [hiddenOpen, setHiddenOpen] = useState(false)

  if (variant === "card") {
    return (
      <section
        data-section-id={sectionId}
        className="scroll-mt-20 border border-border rounded-lg px-5 py-5"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {editableLabel && onLabelChange ? (
                <input
                  type="text"
                  aria-label="섹션 이름"
                  value={label}
                  onChange={e => onLabelChange(e.target.value)}
                  onBlur={e => { if (e.target.value.trim() === "") onLabelChange("새 블록") }}
                  placeholder="섹션 이름"
                  className="w-full bg-transparent text-title font-medium text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand rounded px-0"
                />
              ) : (
                <h3 className="text-title text-text-primary">{label}</h3>
              )}
              {optional && (
                <span className="text-caption text-text-tertiary border border-border rounded-full px-2 py-0.5 shrink-0">
                  선택
                </span>
              )}
            </div>
            {description && (
              <p className="text-body-sm text-text-tertiary mt-1">{description}</p>
            )}
          </div>
          {(onMoveUp || onMoveDown || onDelete) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {(onMoveUp || onMoveDown) && (
                <>
                  <button
                    type="button"
                    onClick={onMoveUp}
                    disabled={!onMoveUp}
                    aria-label="섹션 위로 이동"
                    className="text-text-tertiary hover:text-text-secondary disabled:opacity-30 disabled:hover:text-text-tertiary transition-colors p-1 rounded"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={onMoveDown}
                    disabled={!onMoveDown}
                    aria-label="섹션 아래로 이동"
                    className="text-text-tertiary hover:text-text-secondary disabled:opacity-30 disabled:hover:text-text-tertiary transition-colors p-1 rounded"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={`${label || "섹션"} 삭제`}
                  className="text-text-tertiary hover:text-error transition-colors p-1 rounded"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        <BlockList
          blocks={blocks}
          readOnly={readOnly}
          onChange={onChange}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
          allowEdit={allowEdit}
          onHide={readOnly ? undefined : onHide}
        />
        {!readOnly && hiddenBlocks && hiddenBlocks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setHiddenOpen(o => !o)}
              aria-expanded={hiddenOpen}
              className="flex items-center gap-1.5 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${hiddenOpen ? "" : "-rotate-90"}`}
              />
              숨긴 항목 {hiddenBlocks.length}개
            </button>
            {hiddenOpen && (
              <ul className="mt-2 flex flex-col gap-1">
                {hiddenBlocks.map(b => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-body-sm text-text-tertiary truncate">{b.label}</span>
                    <button
                      type="button"
                      onClick={() => onUnhide?.(b)}
                      aria-label={`${b.label} 다시 보기`}
                      className="text-body-sm text-text-secondary hover:text-brand transition-colors shrink-0"
                    >
                      다시 보기
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between w-full px-5 py-3 bg-surface-secondary hover:bg-surface-tertiary transition-colors text-left"
        aria-expanded={!collapsed}
      >
        <span className="text-title text-text-primary">{label}</span>
        <ChevronDown
          size={18}
          className={`text-text-tertiary transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      {!collapsed && (
        <div className="px-5 py-5">
          {description && (
            <p className="text-body-sm text-text-tertiary mb-4">{description}</p>
          )}
          <BlockList
            blocks={blocks}
            readOnly={readOnly}
            onChange={onChange}
            allowAdd={allowAdd}
            allowReorder={allowReorder}
            allowDelete={allowDelete}
            allowEdit={allowEdit}
          />
        </div>
      )}
    </section>
  )
}
