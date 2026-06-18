"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Block } from "@/types/archive"
import BlockList from "./blocks/BlockList"

interface FormSectionProps {
  label: string
  blocks: Block[]
  variant?: "collapsible" | "card"
  description?: string
  optional?: boolean
  sectionId?: string
  showOptionalBadge?: boolean
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
  variant = "collapsible",
  description,
  optional,
  sectionId,
  showOptionalBadge,
  defaultCollapsed = false,
  readOnly,
  allowAdd,
  allowReorder,
  allowDelete,
  onChange,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (variant === "card") {
    return (
      <section
        data-section-id={sectionId}
        className="scroll-mt-20 border border-border rounded-lg px-5 py-5"
      >
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-title text-text-primary">{label}</h3>
            {optional && (
              <span className="text-caption text-text-tertiary border border-border rounded-full px-2 py-0.5">
                선택
              </span>
            )}
          </div>
          {description && (
            <p className="text-caption text-text-tertiary mt-1">{description}</p>
          )}
        </div>
        <BlockList
          blocks={blocks}
          readOnly={readOnly}
          onChange={onChange}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
          showOptionalBadge={showOptionalBadge}
        />
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
