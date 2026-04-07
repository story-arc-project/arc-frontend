"use client"

import { useState, useCallback } from "react"
import { Plus, GripVertical, Trash2, Copy } from "lucide-react"
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleBlockChange = useCallback(
    (blockId: string, value: BlockValue) => {
      onChange(blocks.map(b => (b.id === blockId ? { ...b, value } : b)))
    },
    [blocks, onChange]
  )

  function handleAddBlock(type: BlockType) {
    const label = prompt("블록 이름을 입력하세요") ?? "새 블록"
    if (!label.trim()) return
    onChange([...blocks, createBlock(type, label.trim())])
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
      onChange={handleBlockChange}
      onDelete={() => handleDeleteBlock(block.id)}
      onDuplicate={() => handleDuplicateBlock(block.id)}
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
              onSelect={handleAddBlock}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SortableBlockItem({
  block,
  allowReorder,
  allowDelete,
  onChange,
  onDelete,
  onDuplicate,
}: {
  block: Block
  allowReorder: boolean
  allowDelete: boolean
  onChange: (blockId: string, value: BlockValue) => void
  onDelete: () => void
  onDuplicate: () => void
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
