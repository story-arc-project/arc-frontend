"use client";

import { useEffect, useLayoutEffect, useRef, useCallback, useState, type KeyboardEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface FolderContextMenuProps {
  anchorRect: DOMRect;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function FolderContextMenu({
  anchorRect,
  onRename,
  onDelete,
  onClose,
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number; visibility: "hidden" | "visible" }>({
    top: anchorRect.bottom + 4,
    left: anchorRect.right,
    visibility: "hidden",
  });

  const setItemRef = useCallback((el: HTMLButtonElement | null, idx: number) => {
    if (el) itemsRef.current[idx] = el;
  }, []);

  // Position menu within viewport, right-aligned to the anchor button
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchorRect.right - rect.width;
    let top = anchorRect.bottom + 4;
    if (left < 8) left = 8;
    if (left + rect.width > vw - 8) left = vw - rect.width - 8;
    if (top + rect.height > vh - 8) top = anchorRect.top - rect.height - 4;
    setPos({ top, left, visibility: "visible" });
  }, [anchorRect]);

  // Auto-focus first item on mount
  useEffect(() => {
    itemsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = itemsRef.current;
    const current = items.findIndex((el) => el === document.activeElement);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = (current + 1) % items.length;
        items[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = (current - 1 + items.length) % items.length;
        items[prev]?.focus();
        break;
      }
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Tab":
        e.preventDefault();
        onClose();
        break;
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="폴더 메뉴"
      style={pos}
      className="fixed z-50 bg-surface border border-border rounded-lg shadow-md py-1 min-w-[130px]"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={(el) => setItemRef(el, 0)}
        role="menuitem"
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-label text-text-secondary hover:bg-surface-secondary transition-colors"
      >
        <Pencil size={13} />
        이름 변경
      </button>
      <button
        ref={(el) => setItemRef(el, 1)}
        role="menuitem"
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-label text-error hover:bg-surface-error transition-colors"
      >
        <Trash2 size={13} />
        폴더 삭제
      </button>
    </div>
  );
}
