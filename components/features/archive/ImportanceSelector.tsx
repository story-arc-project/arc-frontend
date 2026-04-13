"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, RotateCcw } from "lucide-react"
import {
  IMPORTANCE_LABELS,
  IMPORTANCE_LEVELS,
  type ImportanceLevel,
} from "@/types/archive"

interface ImportanceSelectorProps {
  value: ImportanceLevel | undefined
  onChange?: (value: ImportanceLevel | undefined) => void
  size?: "sm" | "md"
  readOnly?: boolean
  className?: string
}

const LEVEL_DOT_CLASS: Record<ImportanceLevel, string> = {
  5: "bg-error",
  4: "bg-brand",
  3: "bg-warning",
  2: "bg-info",
  1: "bg-text-tertiary",
}

function Dot({
  level,
  size = "sm",
}: {
  level: ImportanceLevel | undefined
  size?: "sm" | "md"
}) {
  const dim = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2"
  if (level === undefined) {
    return (
      <span
        className={`${dim} rounded-full border border-border shrink-0`}
        aria-hidden
      />
    )
  }
  return (
    <span
      className={`${dim} rounded-full shrink-0 ${LEVEL_DOT_CLASS[level]}`}
      aria-hidden
    />
  )
}

export default function ImportanceSelector({
  value,
  onChange,
  size = "md",
  readOnly = false,
  className = "",
}: ImportanceSelectorProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const label = value !== undefined ? IMPORTANCE_LABELS[value] : "미설정"
  const isInteractive = !readOnly && typeof onChange === "function"

  const sizeClass =
    size === "md"
      ? "gap-1.5 px-2.5 py-1 text-body-sm"
      : "gap-1 px-2 py-0.5 text-caption"

  // Position menu when opened
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 176
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - menuWidth - 8),
    })
  }, [open])

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    if (
      !menuRef.current?.contains(target) &&
      !triggerRef.current?.contains(target)
    ) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [open, handleOutsideClick])

  // Close on scroll / ESC
  useEffect(() => {
    if (!open) return
    const handleScroll = () => setOpen(false)
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("keydown", handleKey)
    }
  }, [open])

  function handleSelect(level: ImportanceLevel | undefined) {
    if (!isInteractive) return
    onChange?.(level)
    setOpen(false)
  }

  const triggerBase = [
    "inline-flex items-center rounded-full border border-border bg-surface transition-colors",
    sizeClass,
    value === undefined ? "text-text-tertiary" : "text-text-primary",
    isInteractive
      ? "hover:border-border-strong cursor-pointer"
      : "cursor-default",
    className,
  ].join(" ")

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="경험 중요도 선택"
          className="fixed w-44 bg-surface border border-border rounded-lg shadow-md py-1 z-50"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={e => e.stopPropagation()}
        >
          {IMPORTANCE_LEVELS.map(level => {
            const selected = value === level
            return (
              <button
                key={level}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={e => {
                  e.stopPropagation()
                  handleSelect(level)
                }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 text-body-sm transition-colors",
                  selected
                    ? "bg-surface-brand/40 text-text-primary"
                    : "text-text-primary hover:bg-surface-secondary",
                ].join(" ")}
              >
                <Dot level={level} size="md" />
                <span>{IMPORTANCE_LABELS[level]}</span>
                {selected && (
                  <span className="ml-auto text-caption text-brand">✓</span>
                )}
              </button>
            )
          })}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="option"
            aria-selected={value === undefined}
            onClick={e => {
              e.stopPropagation()
              handleSelect(undefined)
            }}
            disabled={value === undefined}
            className={[
              "w-full flex items-center gap-2 px-3 py-2 text-body-sm transition-colors",
              value === undefined
                ? "text-text-disabled cursor-default"
                : "text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            <RotateCcw size={14} />
            <span>미설정으로 초기화</span>
          </button>
          <div className="px-3 pt-1 pb-2 text-caption text-text-tertiary leading-snug border-t border-border mt-1">
            선택하지 않으면 AI가 판단한 값으로 분석돼요.
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="경험 중요도"
        aria-haspopup={isInteractive ? "listbox" : undefined}
        aria-expanded={isInteractive ? open : undefined}
        disabled={!isInteractive}
        onClick={e => {
          if (!isInteractive) return
          e.stopPropagation()
          setOpen(o => !o)
        }}
        className={triggerBase}
      >
        <Dot level={value} size={size} />
        <span className="whitespace-nowrap">{label}</span>
        {isInteractive && (
          <ChevronDown
            size={size === "md" ? 14 : 12}
            className="text-text-tertiary"
          />
        )}
      </button>
      {menu}
    </>
  )
}
