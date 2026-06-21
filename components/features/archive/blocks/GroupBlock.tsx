"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Block } from "@/types/archive"
import { isBlockEmpty } from "@/lib/utils/block-utils"
import BlockList from "./BlockList"

interface GroupBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (updated: Block) => void
}

export default function GroupBlock({ block, readOnly, onChange }: GroupBlockProps) {
  // collapse is local state only — toggling does NOT call onChange (avoids dirty flag)
  const [collapsed, setCollapsed] = useState(block.collapsed ?? false)

  const children = block.children ?? []
  // FIX 5: in readOnly mode, hide empty children
  const visibleChildren = readOnly ? children.filter(c => !isBlockEmpty(c)) : children

  return (
    <section className="border border-border rounded-lg">
      <div className={`flex items-center gap-2 px-4 py-3 bg-surface-secondary rounded-t-lg ${collapsed ? "rounded-b-lg" : ""}`}>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "그룹 펼치기" : "그룹 접기"}
          className="text-text-tertiary transition-colors hover:text-text-secondary shrink-0"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>

        <div className="flex-1 min-w-0">
          {readOnly ? (
            <h3 className="text-title text-text-primary">{block.label}</h3>
          ) : (
            <input
              type="text"
              aria-label="그룹 이름"
              value={block.label}
              onChange={e => onChange({ ...block, label: e.target.value })}
              onBlur={e => { if (e.target.value.trim() === '') onChange({ ...block, label: '새 그룹' }) }}
              className="w-full bg-transparent text-title font-medium text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand rounded px-0"
              placeholder="그룹 이름"
            />
          )}
        </div>

        {visibleChildren.length > 0 && (
          <span className="text-caption text-text-tertiary shrink-0">
            {visibleChildren.length}개 항목
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 py-4">
          <BlockList
            blocks={visibleChildren}
            readOnly={readOnly}
            onChange={updated => onChange({ ...block, children: updated })}
            allowAdd={!readOnly}
            allowReorder={!readOnly}
            allowDelete={!readOnly}
          />
        </div>
      )}
    </section>
  )
}
