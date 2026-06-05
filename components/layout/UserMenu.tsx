"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";

export function UserMenu() {
  const { user, isLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (isLoading) {
    return (
      <div
        className="h-8 w-8 rounded-full bg-surface-secondary animate-pulse"
        aria-hidden={true}
      />
    );
  }

  // 라우트가 AuthGate로 보호되므로(비인증 시 /login) user 없음은 비정상. 방어적으로 렌더 생략.
  if (!user) return null;

  const displayName = user.profile?.name ?? user.account?.email ?? "사용자";
  const initial = displayName.charAt(0) || "?";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="계정 메뉴"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-body-sm font-semibold text-text-tertiary">
          {initial}
        </span>
        <span className="max-w-[8rem] truncate text-body">{displayName}</span>
        <ChevronDown
          size={16}
          className={["transition-transform", open ? "rotate-180" : ""]
            .filter(Boolean)
            .join(" ")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface py-2 shadow-lg"
        >
          <div className="border-b border-border px-4 py-2">
            <p className="truncate text-body-sm font-semibold text-text-primary">
              {displayName}
            </p>
            <p className="truncate text-caption">{user.account?.email}</p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-body text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          >
            마이페이지
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="block w-full px-4 py-2.5 text-left text-body text-error transition-colors hover:bg-surface-tertiary"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
