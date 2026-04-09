"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Block, BlockValue } from "@/types/archive"
import BlockList from "./blocks/BlockList"

interface FormSectionProps {
  label: string
  blocks: Block[]
  defaultCollapsed?: boolean
  readOnly?: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
  onChange: (blocks: Block[]) => void
}

export default function FormSection({
  label,
  blocks,
  defaultCollapsed = false,
  readOnly,
  allowAdd,
  allowReorder,
  allowDelete,
  onChange,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

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
          <BlockList
            blocks={blocks}
            readOnly={readOnly}
            onChange={onChange}
            allowAdd={allowAdd}
            allowReorder={allowReorder}
            allowDelete={allowDelete}
          />
        </div>
      )}
    </section>
  )
}
