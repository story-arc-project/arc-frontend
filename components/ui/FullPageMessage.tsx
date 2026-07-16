import type { ReactNode } from "react";

/**
 * 세로 정렬 기준 높이 — 렌더 위치에 GNB·부모 높이가 있느냐에 따라 고른다.
 * - `below-gnb`: (main) 레이아웃 GNB 아래 영역(기본). 뷰포트에서 GNB 높이를 뺀다.
 * - `viewport`: GNB가 없는 루트 레이아웃(예: not-found). 전체 뷰포트.
 * - `parent`: 이미 높이가 정해진 스크롤 컨테이너 안(예: analysis 레이아웃 콘텐츠 팬).
 */
type FullPageFill = "below-gnb" | "viewport" | "parent";

const fillClasses: Record<FullPageFill, string> = {
  "below-gnb": "min-h-[calc(100dvh-var(--gnb-h))]",
  viewport: "min-h-dvh",
  parent: "min-h-full",
};

interface FullPageMessageProps {
  /** 카드 제목 — 한 줄 요약 */
  title: string;
  /** 부가 설명 (선택) */
  description?: string;
  /** 상단 아이콘 슬롯 (선택) */
  icon?: ReactNode;
  /** 액션 슬롯 — 재시도 버튼·홈 링크 등 */
  children?: ReactNode;
  /** 컨테이너 role (에러 경계는 "alert") */
  role?: "alert" | "status";
  /** 세로 정렬 기준 높이 (기본: GNB 아래 영역) */
  fill?: FullPageFill;
}

/**
 * 전면 중앙 정렬 메시지 카드. route 레벨 error.tsx·not-found.tsx에서 공유하는
 * 프레젠테이션 컴포넌트. 순수 마크업이라 서버/클라이언트 양쪽에서 import 가능하다.
 */
export function FullPageMessage({
  title,
  description,
  icon,
  children,
  role,
  fill = "below-gnb",
}: FullPageMessageProps) {
  return (
    <div
      className={`${fillClasses[fill]} flex items-center justify-center px-4 py-8`}
    >
      <div
        role={role}
        className="bg-surface border border-border rounded-xl p-8 max-w-md w-full flex flex-col items-center text-center"
      >
        {icon && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary text-text-tertiary">
            {icon}
          </div>
        )}
        <h1 className="text-heading-3 text-text-primary">{title}</h1>
        {description && (
          <p className="text-body text-text-secondary mt-2">{description}</p>
        )}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  );
}
