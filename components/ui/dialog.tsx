"use client";

import { useEffect, useRef, ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 트랩·초기 포커스 대상은 "실제로 포커스 가능한" 요소만이어야 한다. 셀렉터는 `<button>` 을
 * disabled·tabindex="-1" 여부와 무관하게 매칭하므로, 그대로 쓰면 disabled 제출 버튼 같은
 * 요소가 last 로 잡혀 Tab 이 트랩을 빠져나간다. disabled·roving tabindex(-1)·aria-hidden·
 * 화면에서 감춰진(offsetParent 없는) 요소를 걸러 경계를 바로잡는다.
 */
function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null
  );
}

export function Dialog({ open, onClose, ariaLabel, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Store the element that opened the dialog, restore on close
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;

      // Focus first focusable element inside dialog
      requestAnimationFrame(() => {
        getFocusable(dialogRef.current)[0]?.focus();
      });
    } else if (previousFocus.current) {
      previousFocus.current.focus();
      previousFocus.current = null;
    }
  }, [open]);

  // Trap focus + close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = getFocusable(dialogRef.current);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`bg-surface rounded-xl shadow-lg p-6 w-full ${className ?? "max-w-sm"}`}
      >
        {children}
      </div>
    </div>
  );
}
