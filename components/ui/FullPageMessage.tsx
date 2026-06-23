import type { ReactNode } from "react";

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
}: FullPageMessageProps) {
  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] flex items-center justify-center px-4 py-8">
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
