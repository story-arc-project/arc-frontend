"use client"

import { useState, useCallback } from "react"
import { Plus, GripVertical, Trash2, Copy, Pencil, X } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type {
  Block,
  BlockType,
  BlockValue,
  ChecklistBlockValue,
  RepeatableCellBlockValue,
  SingleSelectBlockValue,
} from "@/types/archive"
import { createBlock, cloneBlock, isUnrenderableBlock } from "@/lib/utils/block-utils"
import { canHideBlock } from "@/lib/utils/hidden-fields"
import BlockRenderer from "./BlockRenderer"
import BlockTypePicker from "./BlockTypePicker"
import BlockEditModal, { type BlockEditConfig } from "./BlockEditModal"

interface BlockListProps {
  blocks: Block[]
  readOnly?: boolean
  onChange: (blocks: Block[]) => void
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
  /**
   * 블록 편집(연필) 노출 여부. 미지정 시 allowAdd 를 따른다(기존 동작 유지).
   * 추가는 막되 편집은 허용하는 경우(레거시 loose 폴백)에 단독으로 켠다.
   */
  allowEdit?: boolean
  /**
   * 선택 필드 숨김 (FRT-190). 넘기면 `canHideBlock` 이 통과한 블록에만 × 가 붙는다.
   * `allowDelete`(사용자 섹션의 영구 삭제)와는 별개다 — 이쪽은 되돌릴 수 있는 숨김이다.
   */
  onHide?: (block: Block) => void
}

export default function BlockList({
  blocks,
  readOnly,
  onChange,
  allowAdd = false,
  allowReorder = false,
  allowDelete = false,
  allowEdit,
  onHide,
}: BlockListProps) {
  const editEnabled = allowEdit ?? allowAdd
  const [showPicker, setShowPicker] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingType, setPendingType] = useState<Exclude<BlockType, 'group'> | null>(null)
  const [editingBlock, setEditingBlock] = useState<Block | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleBlockChange = useCallback(
    (blockId: string, value: BlockValue) => {
      onChange(blocks.map(b => (b.id === blockId ? { ...b, value } : b)))
    },
    [blocks, onChange]
  )

  function handlePickType(type: Exclude<BlockType, 'group'>) {
    setPendingType(type)
    setEditingBlock(null)
    setModalOpen(true)
  }

  function handleEditBlock(block: Block) {
    if (block.type === 'group') return
    setEditingBlock(block)
    setPendingType(block.type)
    setModalOpen(true)
  }

  function handleModalConfirm(config: BlockEditConfig) {
    if (editingBlock) {
      // Update existing block
      onChange(
        blocks.map(b => {
          if (b.id !== editingBlock.id) return b
          const updated = { ...b, label: config.label }
          if (config.placeholder !== undefined) {
            updated.placeholder = config.placeholder
          }
          // Update value-level options/columns for relevant types
          if ((b.type === "single-select" || b.type === "checklist") && config.options) {
            // 모달에서 지운 옵션을 가리키던 선택값도 함께 거둔다(FRT-158 리뷰 지적). 인라인 편집기
            // (ChecklistBlock.removeOption / SingleSelectBlock.removeOption)가 이미 지키는 규칙인데
            // 모달 경로만 빠져 있었다 — 남으면 상세뷰는 지운 라벨을 칩으로 계속 그리고
            // (readOnly 렌더는 checked 만 본다) `isBlockEmpty` 도 checked 만 보므로
            // 편집기에선 빈 블록이 저장·진행도에선 "채워짐"으로 굳는다.
            //
            // 대조 기준은 '제출된 목록 전체'가 아니라 **모달이 열어 보여준 목록에서 사라진 것**이다.
            // 옵션에 애초에 없던 값(프리셋 개편으로 orphan 된 선택 — MoodTagBlock 이 일부러 보존한다)
            // 까지 걸러내면 라벨만 고친 편집에서 사용자의 옛 답이 조용히 증발한다.
            const nextOptions = config.options
            const shown = (b.value as { options?: string[] }).options ?? b.options ?? []
            const removed = shown.filter(o => !nextOptions.includes(o))
            if (b.type === "checklist") {
              const val = b.value as ChecklistBlockValue
              updated.value = {
                ...val,
                options: nextOptions,
                checked: (val.checked ?? []).filter(c => !removed.includes(c)),
              }
            } else {
              const val = b.value as SingleSelectBlockValue
              updated.value = {
                ...val,
                options: nextOptions,
                selected: removed.includes(val.selected) ? "" : val.selected,
              }
            }
          }
          if (b.type === "repeatable-cell" && config.columns) {
            // 지운 열의 셀도 함께 쳐낸다 — 인라인 `RepeatableCellBlock.removeColumn` 이 이미
            // 지키는 규칙인데 모달 경로만 빠져 있었다(위 옵션 삭제와 같은 형태의 누락).
            // 남겨 두면 `rowHasContent` 가 그 값을 계속 세므로, 열을 전부 지운 블록이
            // `isBlockEmpty` 에선 "내용 있음"으로 굳어 상세뷰에 빈 껍데기로 남는다.
            //
            // 행 자체는 지우지 않는다 — `extraFields`·`artifacts`·`roleTags` 는 열이 아니라
            // **행에 붙은 사용자 값**이라, 열을 지웠다는 이유로 함께 버리면 안 된다.
            const val = b.value as RepeatableCellBlockValue
            const keptKeys = new Set(config.columns.map(c => c.key))
            updated.value = {
              ...val,
              columns: config.columns,
              rows: (Array.isArray(val.rows) ? val.rows : []).map(r => {
                // 저장된 행에 `cells` 가 없거나 객체가 아닐 수 있다(FRT-200).
                const cells = r.cells && typeof r.cells === "object" ? r.cells : {}
                return {
                  ...r,
                  cells: Object.fromEntries(
                    Object.entries(cells).filter(([k]) => keptKeys.has(k))
                  ),
                }
              }),
            } as BlockValue
          }
          if (b.type === "table" && config.tableColumns) {
            const val = b.value as { type: "table"; columns: string[]; rows: string[][] }
            const newCols = config.tableColumns
            updated.value = {
              ...val,
              columns: newCols,
              // 열이 하나도 안 남으면 행도 함께 거둔다. 칸이 없어진 행은 이미 `[]` 라 담을
              // 값이 없는데, `isBlockEmpty` 는 표를 **`rows.length` 로만** 판정하므로 껍데기
              // 행이 남으면 빈 표가 상세뷰에 계속 그려지고 열을 다시 만들 때 빈 행이 되살아난다.
              rows:
                newCols.length === 0
                  ? []
                  : val.rows.map(row => {
                      const newRow = [...row]
                      // Extend or trim rows to match new column count
                      while (newRow.length < newCols.length) newRow.push("")
                      return newRow.slice(0, newCols.length)
                    }),
            } as BlockValue
          }
          return updated
        })
      )
    } else if (pendingType) {
      // Create new block
      const newBlock = createBlock(pendingType, config.label, {
        placeholder: config.placeholder,
        options: config.options,
        columns: config.columns,
      })
      // For table, set initial columns
      if (pendingType === "table" && config.tableColumns && config.tableColumns.length > 0) {
        const val = newBlock.value as { type: "table"; columns: string[]; rows: string[][] }
        newBlock.value = { ...val, columns: config.tableColumns } as BlockValue
      }
      onChange([...blocks, newBlock])
    }
    setModalOpen(false)
    setPendingType(null)
    setEditingBlock(null)
  }

  function handleModalClose() {
    setModalOpen(false)
    setPendingType(null)
    setEditingBlock(null)
  }

  function handleDeleteBlock(blockId: string) {
    onChange(blocks.filter(b => b.id !== blockId))
  }

  function handleDuplicateBlock(blockId: string) {
    const idx = blocks.findIndex(b => b.id === blockId)
    if (idx === -1) return
    const clone = cloneBlock(blocks[idx])
    const next = [...blocks]
    next.splice(idx + 1, 0, clone)
    onChange(next)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = blocks.findIndex(b => b.id === active.id)
    const newIdx = blocks.findIndex(b => b.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = [...blocks]
    const [moved] = next.splice(oldIdx, 1)
    next.splice(newIdx, 0, moved)
    onChange(next)
  }

  // Build initial config for modal from existing block
  /**
   * ⚠️ **저장분에서 온 값이라 타입이 약속한 모양대로 오지 않는다.** 모달은 받은 목록을 곧장
   * `.join()`·`.map()` 하므로, 여기서 거르지 않으면 손상값 하나가 **렌더 도중 throw** 해
   * 화면을 통째로 에러 화면으로 바꾼다 — 이 PR 이 막으려는 바로 그 고장이다.
   * `??` 는 `{}` 같은 객체를 통과시키므로 "있음"이 아니라 **"배열인가"** 를 물어야 한다.
   */
  function getEditConfig(block: Block): BlockEditConfig {
    const config: BlockEditConfig = { label: block.label, placeholder: block.placeholder }
    const val = (block.value ?? {}) as unknown as Record<string, unknown>
    // ⚠️ **배열이면 걸러 쓰고, 배열이 아닐 때만 폴백한다** — `normalizeBlockValue` 의
    // `optionsOf` 와 같은 규칙이다. 통째로 물리면 원소 하나가 깨졌다는 이유로 사용자가
    // 만든 선택지 전체가 템플릿 기본값으로 되돌아가고, 확인 한 번에 그대로 저장된다.
    const stringList = (x: unknown, fallback?: unknown): string[] => {
      const src = Array.isArray(x) ? x : Array.isArray(fallback) ? fallback : []
      return src.filter((i): i is string => typeof i === "string")
    }
    if (block.type === "single-select" || block.type === "checklist") {
      config.options = stringList(val.options, block.options)
    }
    if (block.type === "repeatable-cell") {
      // 원소까지 검사하지는 않는다 — 아는 타입의 열은 `normalizeBlock` 이 이미 보정하고,
      // 모르는 값을 담은 블록은 위에서 연필 자체가 안 붙는다. 증명되지 않은 가드는 안 넣는다.
      config.columns = (Array.isArray(val.columns) ? val.columns : []) as BlockEditConfig["columns"]
    }
    if (block.type === "table") {
      config.tableColumns = stringList(val.columns)
    }
    return config
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-5">
        {blocks.map(block => (
          <BlockRenderer key={block.id} block={block} readOnly onChange={handleBlockChange} />
        ))}
      </div>
    )
  }

  const content = blocks.map(block => (
    <SortableBlockItem
      key={block.id}
      block={block}
      allowReorder={allowReorder}
      allowDelete={allowDelete}
      // ⚠️ 입력 칸을 잠그는 것만으로는 부족하다 — 이 연필은 그 칸 **바깥**에 있어서
      // 그대로 두면 모르는 값 위에 설정 모달이 열리고, 확인 한 번이 보존해 둔 값을 덮는다.
      allowEdit={editEnabled && !isUnrenderableBlock(block)}
      // 블록 **안**의 인라인 옵션 편집도 같은 문을 쓴다(FRT-322) — 커스텀 블록만 열리고,
      // 템플릿이 소유한 확정본 선택지는 고칠 수 없다. 연필과 같은 술어라 두 편집 경로가
      // 한쪽만 열린 채 남지 않는다.
      allowOptionEdit={editEnabled && !isUnrenderableBlock(block)}
      onChange={handleBlockChange}
      onHide={onHide && canHideBlock(block) ? () => onHide(block) : undefined}
      onDelete={() => handleDeleteBlock(block.id)}
      onDuplicate={() => handleDuplicateBlock(block.id)}
      onEdit={() => handleEditBlock(block)}
    />
  ))

  return (
    <div className="flex flex-col gap-4">
      {allowReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      ) : (
        content
      )}

      {allowAdd && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-2 text-body-sm text-text-secondary hover:text-text-primary transition-colors py-2"
          >
            <Plus size={16} />
            블록 추가
          </button>
          {showPicker && (
            <BlockTypePicker
              onSelect={handlePickType}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      )}

      <BlockEditModal
        open={modalOpen}
        blockType={pendingType}
        initialConfig={editingBlock ? getEditConfig(editingBlock) : undefined}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />
    </div>
  )
}

function SortableBlockItem({
  block,
  allowReorder,
  allowDelete,
  allowEdit,
  allowOptionEdit,
  onChange,
  onHide,
  onDelete,
  onDuplicate,
  onEdit,
}: {
  block: Block
  allowReorder: boolean
  allowDelete: boolean
  allowEdit: boolean
  allowOptionEdit: boolean
  onChange: (blockId: string, value: BlockValue) => void
  onHide?: () => void
  onDelete: () => void
  onDuplicate: () => void
  onEdit: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  // 첨부 업로드가 도는 동안에는 × 를 감춘다 — 그때 숨기면 블록이 언마운트되며 업로드가 abort 돼
  // 사용자가 방금 고른 파일이 사라진다. 값만 보는 `canHideBlock` 은 이 상태를 알 수 없다(FRT-190).
  const [uploading, setUploading] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative flex gap-2">
      {allowReorder && (
        <button
          type="button"
          className="mt-1 text-text-tertiary cursor-grab active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
          aria-label="드래그하여 순서 변경"
        >
          <GripVertical size={16} />
        </button>
      )}
      {/*
        숨김 × 는 **레이아웃 흐름 밖**에 둔다(`absolute`) — 흐름 안에 칸을 만들면 그만큼
        입력칸이 좁아진다. 숨길 수 있는 블록에만 만들면 그 블록만 좁아져 오른쪽 끝이 어긋나고,
        모든 블록에 예약하면 어긋남은 사라지지만 **필수 필드까지 같이 좁아져 폼 전체가 전보다
        좁아진다**. 어느 쪽도 "이전 폭 그대로"가 아니다.

        자리는 **블록 안 우상단**(라벨 행의 오른쪽 끝)이다. 기준 박스가 블록 내용이라
        `right-0` 이 곧 입력칸의 오른쪽 끝이고, 카드 여백(`px-5`)까지 밀려나 테두리에
        몰려 보이지 않는다. 이 자리는 `N개 항목`(RepeatableCellBlock·OutcomeList) 을
        라벨 옆으로 옮겨서 비워 둔 것이다 — 되돌리면 그 둘과 겹친다.
      */}
      <div className="relative flex-1 min-w-0">
        <BlockRenderer
          block={block}
          onChange={onChange}
          hideSlot={!!onHide}
          onBusyChange={setUploading}
          allowOptionEdit={allowOptionEdit}
        />
        {onHide && !uploading && (
          <button
            type="button"
            onClick={onHide}
            className="absolute right-0 top-0 text-text-tertiary hover:text-text-secondary transition-colors p-1 rounded"
            aria-label={`${block.label} 숨기기`}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {allowDelete && (
        <div className="flex flex-col gap-1 mt-1 transition-opacity shrink-0">
          {allowEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-text-tertiary hover:text-text-secondary transition-colors p-1 rounded"
              aria-label="블록 편집"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            className="text-text-tertiary hover:text-text-secondary transition-colors p-1 rounded"
            aria-label="블록 복제"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-text-tertiary hover:text-error transition-colors p-1 rounded"
            aria-label="블록 삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
