"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed z-50 bg-surface border border-border rounded-lg shadow-md py-1 min-w-[130px]"
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-label text-text-secondary hover:bg-surface-secondary transition-colors"
      >
        <Pencil size={13} />
        이름 변경
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-label text-error hover:bg-surface-error transition-colors"
      >
        <Trash2 size={13} />
        폴더 삭제
      </button>
    </div>
  );
}
