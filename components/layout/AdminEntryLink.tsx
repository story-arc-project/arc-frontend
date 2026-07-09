import Link from "next/link";
import { Shield } from "lucide-react";

interface AdminEntryLinkProps {
  /** admin 사용자에게만 렌더. false 면 null(일반 UI 에 관리자 진입점 노출 X). */
  isAdmin: boolean;
  onClick?: () => void;
  /** 렌더 위치별 스타일 — 데스크톱 UserMenu 드롭다운 vs GNB 모바일 인라인 블록 */
  variant?: "menu" | "mobile";
}

/**
 * GNB 계정 메뉴의 관리자 영역(/admin) 진입점. admin 이 아니면 아무것도 렌더하지 않는다.
 * admin 여부 판정은 상위(GNB)의 useIsAdmin() 이 내려주는 prop 에 위임 — 표시 로직만 담는
 * 순수 prop→UI 컴포넌트라 Storybook 으로 격리 검증한다.
 */
export function AdminEntryLink({ isAdmin, onClick, variant = "menu" }: AdminEntryLinkProps) {
  if (!isAdmin) return null;

  const className =
    variant === "menu"
      ? "flex items-center gap-2 px-4 py-2.5 text-body text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
      : "flex items-center gap-2 rounded-md px-3 py-2.5 text-body text-text-secondary transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary";

  return (
    <Link
      href="/admin"
      role={variant === "menu" ? "menuitem" : undefined}
      onClick={onClick}
      className={className}
    >
      <Shield size={16} aria-hidden="true" />
      관리자
    </Link>
  );
}
