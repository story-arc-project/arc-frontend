"use client";

import { useEffect, useRef, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface FolderContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function FolderContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onClose,
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);

  const setItemRef = useCallback((el: HTMLButtonElement | null, idx: number) => {
    if (el) itemsRef.current[idx] = el;
  }, []);

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

  function handleKeyDown(e: React.KeyboardEvent) {
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
      style={{ top: y, left: x }}
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
