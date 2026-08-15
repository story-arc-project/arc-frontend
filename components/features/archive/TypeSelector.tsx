"use client"

import type React from "react"
import { createElement, useMemo, useState } from "react"
import { Search, Pencil } from "lucide-react"
import * as icons from "lucide-react"
import type { ExperienceTypeId } from "@/types/archive"
import {
  EXPERIENCE_TYPES,
  EXPERIENCE_TYPE_MAP,
  SELECTABLE_EXPERIENCE_TYPES,
  TYPE_CATEGORIES,
  isRetiredType,
} from "@/lib/constants/templates-v2"

interface TypeSelectorProps {
  selectedId: ExperienceTypeId | null
  onSelect: (typeId: ExperienceTypeId) => void
  disabled?: boolean
  onRequestChange?: () => boolean
}

type LucideIcon = React.ComponentType<{ size?: number; className?: string }>

function getIcon(name: string): LucideIcon {
  const Icon = (icons as unknown as Record<string, LucideIcon>)[name]
  return Icon ?? icons.FileText
}

export default function TypeSelector({ selectedId, onSelect, disabled, onRequestChange }: TypeSelectorProps) {
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState(false)

  /**
   * 그릴 유형 목록 — 기본은 확정본 선택지(FRT-300)지만, 은퇴 유형이 **이미 선택돼 있으면 그것만**
   * 남긴다. 그 기록을 편집하다 '변경'을 열었을 때 자기 유형이 사라지면 선택 상태를 보여줄 수도,
   * 변경을 물릴 수도 없다. 끝에 append 하지 않고 전체 배열을 filter 하는 이유는 카테고리 안
   * 원래 순서를 지키기 위해서다.
   */
  const availableTypes = useMemo(
    () =>
      selectedId !== null && isRetiredType(selectedId)
        ? EXPERIENCE_TYPES.filter(t => !isRetiredType(t.id) || t.id === selectedId)
        : SELECTABLE_EXPERIENCE_TYPES,
    [selectedId],
  )

  const filtered = search.trim()
    ? availableTypes.filter(t => t.label.includes(search.trim()))
    : availableTypes

  // Collapsed state: a type is chosen, not expanded, and not disabled-without-collapse
  const collapsed = selectedId !== null && !expanded
  const selectedInfo = selectedId ? EXPERIENCE_TYPE_MAP[selectedId] : null

  if (collapsed && selectedInfo) {
    return (
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h3 className="text-field-label text-text-primary mb-2">경험 유형</h3>
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip
              icon={createElement(getIcon(selectedInfo.icon), { size: 14 })}
              label={selectedInfo.label}
              selected
              disabled={disabled}
              onClick={() => {}}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => {
                  if (onRequestChange && !onRequestChange()) return
                  setExpanded(true)
                }}
                aria-label="유형 변경"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <Pencil size={12} />
                변경
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleSelect = (id: ExperienceTypeId) => {
    if (id !== selectedId && onRequestChange && !onRequestChange()) return
    onSelect(id)
    setExpanded(false)
    setSearch("")
  }

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div>
        <h3 className="text-field-label text-text-primary mb-2">경험 유형</h3>
        {!disabled && (
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="유형 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {search.trim() ? (
        <div className="flex flex-wrap gap-2">
          {filtered.map(t => {
            const Icon = getIcon(t.icon)
            return (
              <TypeChip
                key={t.id}
                icon={<Icon size={14} />}
                label={t.label}
                selected={selectedId === t.id}
                disabled={disabled}
                onClick={() => handleSelect(t.id)}
              />
            )
          })}
          {filtered.length === 0 && (
            <p className="text-body-sm text-text-tertiary">검색 결과가 없습니다</p>
          )}
        </div>
      ) : (
        TYPE_CATEGORIES.map(cat => {
          const types = availableTypes.filter(t => t.category === cat.key)
          return (
            <div key={cat.key}>
              <span className="text-caption text-text-tertiary mb-1.5 block">{cat.label}</span>
              <div className="flex flex-wrap gap-2">
                {types.map(t => {
                  const Icon = getIcon(t.icon)
                  return (
                    <TypeChip
                      key={t.id}
                      icon={<Icon size={14} />}
                      label={t.label}
                      selected={selectedId === t.id}
                      disabled={disabled}
                      onClick={() => handleSelect(t.id)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function TypeChip({
  icon,
  label,
  selected,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-sm transition-colors",
        selected
          ? "bg-brand text-text-on-brand"
          : "bg-surface border border-border text-text-secondary hover:border-brand hover:text-text-primary",
        disabled && !selected ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      aria-pressed={selected}
    >
      {icon}
      {label}
    </button>
  )
}
