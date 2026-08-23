"use client"

import type React from "react"
import { createElement, useMemo, useState } from "react"
import { Pencil } from "lucide-react"
import * as icons from "lucide-react"
import type { ExperienceTypeId } from "@/types/archive"
import {
  ALL_EXPERIENCE_TYPES,
  EXPERIENCE_TYPES,
  EXPERIENCE_TYPE_MAP,
  RETIRED_TYPE_IDS,
  TYPE_CATEGORIES,
  canonicalTypeId,
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
  const [expanded, setExpanded] = useState(false)

  /**
   * 선택 상태를 견줄 id — 저장된 값이 **흡수된 유형**(FRT-291 `team-project`)이면 그 자리를 대신하는
   * 현행 유형으로 접어서 본다. 접지 않으면 목록의 어느 칩도 눌린 상태가 되지 않아, 편집 화면에서
   * 자기 유형이 사라진 것처럼 보인다.
   */
  const currentId = selectedId !== null ? canonicalTypeId(selectedId) : null

  /**
   * 그릴 유형 목록 — 기본은 새로 고를 수 있는 유형(`EXPERIENCE_TYPES`)이지만, **폐기된 유형이 이미
   * 선택돼 있으면 그 하나만** 되살린다(FRT-300). 그 기록을 편집하다 '변경'을 열었을 때 자기 유형이
   * 목록에 없으면 선택 상태를 보여줄 수도, 변경을 물릴 수도 없다.
   *
   * 되살리는 것이 폐기형뿐인 이유: 흡수형은 위에서 이미 현행 유형으로 접혔고, 라벨까지 같아서
   * (둘 다 '프로젝트') 되살리면 **같은 이름의 칩이 두 장** 뜬다.
   *
   * FRT-302 로 유형 검색바가 사라지면서 이 목록을 그리는 경로는 아래 카테고리 그룹 **하나뿐**이 됐다.
   * 검색 시절에는 목록을 읽는 곳이 둘이라 한쪽만 은퇴 유형을 걸러도 다른 쪽으로 새어 나갈 수 있었다 —
   * 그 위험은 이제 구조적으로 없다. 두 번째 렌더 경로를 다시 만들지 말 것.
   */
  const availableTypes = useMemo(
    () =>
      currentId !== null && RETIRED_TYPE_IDS.includes(currentId)
        ? ALL_EXPERIENCE_TYPES.filter(t => !RETIRED_TYPE_IDS.includes(t.id) || t.id === currentId)
        : EXPERIENCE_TYPES,
    [currentId],
  )

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
  }

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div>
        <h3 className="text-field-label text-text-primary mb-2">경험 유형</h3>
      </div>

      {TYPE_CATEGORIES.map(cat => {
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
                    selected={currentId === t.id}
                    disabled={disabled}
                    onClick={() => handleSelect(t.id)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
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
