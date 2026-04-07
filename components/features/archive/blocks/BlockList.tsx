"use client"

import { useState, useCallback } from "react"
import { Plus, GripVertical, Trash2, Copy, Pencil } from "lucide-react"
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
import type { Block, BlockType, BlockValue } from "@/types/archive"
import { createBlock, cloneBlock } from "@/lib/block-utils"
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
}

export default function BlockList({
  blocks,
  readOnly,
  onChange,
  allowAdd = false,
  allowReorder = false,
  allowDelete = false,
}: BlockListProps) {
  const [showPicker, setShowPicker] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingType, setPendingType] = useState<BlockType | null>(null)
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

  function handlePickType(type: BlockType) {
    setPendingType(type)
    setEditingBlock(null)
    setModalOpen(true)
  }

  function handleEditBlock(block: Block) {
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
            updated.value = { ...b.value, options: config.options } as unknown as BlockValue
          }
          if (b.type === "repeatable-cell" && config.columns) {
            updated.value = { ...b.value, columns: config.columns } as unknown as BlockValue
          }
          if (b.type === "table" && config.tableColumns) {
            const val = b.value as { type: "table"; columns: string[]; rows: string[][] }
            const oldColCount = val.columns.length
            const newCols = config.tableColumns
            updated.value = {
              ...val,
              columns: newCols,
              rows: val.rows.map(row => {
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
  function getEditConfig(block: Block): BlockEditConfig {
    const config: BlockEditConfig = { label: block.label, placeholder: block.placeholder }
    if (block.type === "single-select" || block.type === "checklist") {
      const val = block.value as { options?: string[] }
      config.options = val.options ?? block.options ?? []
    }
    if (block.type === "repeatable-cell") {
      const val = block.value as { columns?: { key: string; label: string; blockType: string }[] }
      config.columns = (val.columns ?? []) as BlockEditConfig["columns"]
    }
    if (block.type === "table") {
      const val = block.value as { columns?: string[] }
      config.tableColumns = val.columns ?? []
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
      allowEdit={allowAdd}
      onChange={handleBlockChange}
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
  onChange,
  onDelete,
  onDuplicate,
  onEdit,
}: {
  block: Block
  allowReorder: boolean
  allowDelete: boolean
  allowEdit: boolean
  onChange: (blockId: string, value: BlockValue) => void
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group flex gap-2">
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
      <div className="flex-1 min-w-0">
        <BlockRenderer block={block} onChange={onChange} />
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
