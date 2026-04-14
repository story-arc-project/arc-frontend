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
  const [focusedIndex, setFocusedIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const label = value !== undefined ? IMPORTANCE_LABELS[value] : "미설정"
  const isInteractive = !readOnly && typeof onChange === "function"

  // Menu items: 5 levels + reset. Index 0-4 = levels, 5 = reset.
  const itemCount = IMPORTANCE_LEVELS.length + 1
  const resetIndex = IMPORTANCE_LEVELS.length

  const sizeClass =
    size === "md"
      ? "gap-1.5 px-2.5 py-1 text-body-sm"
      : "gap-1 px-2 py-0.5 text-caption"

  // Position menu when opened + focus first item
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 176
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - menuWidth - 8),
    })
    // Focus the currently selected level, or the first item
    const selectedIdx = IMPORTANCE_LEVELS.findIndex(l => l === value)
    const initial = selectedIdx >= 0 ? selectedIdx : 0
    setFocusedIndex(initial)
    // Defer focus until item refs are mounted
    queueMicrotask(() => itemRefs.current[initial]?.focus())
  }, [open, value])

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
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("keydown", handleKey)
    }
  }, [open])

  function moveFocus(delta: number) {
    setFocusedIndex(prev => {
      // Skip reset when it is currently disabled (value === undefined)
      let next = prev
      for (let i = 0; i < itemCount; i++) {
        next = (next + delta + itemCount) % itemCount
        if (next === resetIndex && value === undefined) continue
        break
      }
      itemRefs.current[next]?.focus()
      return next
    })
  }

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveFocus(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveFocus(-1)
    } else if (e.key === "Home") {
      e.preventDefault()
      setFocusedIndex(0)
      itemRefs.current[0]?.focus()
    } else if (e.key === "End") {
      e.preventDefault()
      const last = value === undefined ? resetIndex - 1 : resetIndex
      setFocusedIndex(last)
      itemRefs.current[last]?.focus()
    }
  }

  function handleSelect(level: ImportanceLevel | undefined) {
    if (!isInteractive) return
    onChange?.(level)
    setOpen(false)
    triggerRef.current?.focus()
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

  // Read-only: render a non-interactive span so click events bubble to
  // ancestors (e.g., ExperienceCard onClick) and no disabled button blocks
  // focus/tab order.
  if (!isInteractive) {
    return (
      <span
        aria-label="경험 중요도"
        className={triggerBase}
      >
        <Dot level={value} size={size} />
        <span className="whitespace-nowrap">{label}</span>
      </span>
    )
  }

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="경험 중요도 선택"
          onKeyDown={handleMenuKeyDown}
          className="fixed w-44 bg-surface border border-border rounded-lg shadow-md py-1 z-50"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={e => e.stopPropagation()}
        >
          {IMPORTANCE_LEVELS.map((level, idx) => {
            const checked = value === level
            return (
              <button
                key={level}
                ref={el => {
                  itemRefs.current[idx] = el
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={focusedIndex === idx ? 0 : -1}
                onFocus={() => setFocusedIndex(idx)}
                onClick={e => {
                  e.stopPropagation()
                  handleSelect(level)
                }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 text-body-sm transition-colors outline-none focus-visible:bg-surface-secondary",
                  checked
                    ? "bg-surface-brand/40 text-text-primary"
                    : "text-text-primary hover:bg-surface-secondary",
                ].join(" ")}
              >
                <Dot level={level} size="md" />
                <span>{IMPORTANCE_LABELS[level]}</span>
                {checked && (
                  <span className="ml-auto text-caption text-brand">✓</span>
                )}
              </button>
            )
          })}
          <div
            role="separator"
            aria-orientation="horizontal"
            className="my-1 border-t border-border"
          />
          <button
            ref={el => {
              itemRefs.current[resetIndex] = el
            }}
            type="button"
            role="menuitem"
            tabIndex={focusedIndex === resetIndex ? 0 : -1}
            aria-disabled={value === undefined}
            onFocus={() => setFocusedIndex(resetIndex)}
            onClick={e => {
              e.stopPropagation()
              if (value === undefined) return
              handleSelect(undefined)
            }}
            className={[
              "w-full flex items-center gap-2 px-3 py-2 text-body-sm transition-colors outline-none focus-visible:bg-surface-secondary",
              value === undefined
                ? "text-text-disabled cursor-default"
                : "text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            <RotateCcw size={14} />
            <span>미설정으로 초기화</span>
          </button>
          <div
            role="separator"
            aria-orientation="horizontal"
            className="border-t border-border mt-1"
          />
          <p className="px-3 pt-1 pb-2 text-caption text-text-tertiary leading-snug">
            선택하지 않으면 AI가 판단한 값으로 분석돼요.
          </p>
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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation()
          setOpen(o => !o)
        }}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }
        }}
        className={triggerBase}
      >
        <Dot level={value} size={size} />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          size={size === "md" ? 14 : 12}
          className="text-text-tertiary"
        />
      </button>
      {menu}
    </>
  )
}
