import type { ReactNode } from "react";
import { FullPageMessage } from "@/components/ui";

interface AdminComingSoonProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * admin 셸 안의 아직 준비되지 않은 섹션 자리를 채우는 공용 placeholder.
 * 후속 이슈(고객 FRT-16/17, 행동 분석 FRT-18~20, 감사 로그 BAC-14)에서 해당
 * page.tsx 본문만 실제 화면으로 교체하면 된다. main(flex-1) 안에서 렌더되므로 parent 높이 기준.
 */
export function AdminComingSoon({ title, description, icon }: AdminComingSoonProps) {
  return (
    <FullPageMessage
      fill="parent"
      icon={icon}
      title={title}
      description={description}
      role="status"
    />
  );
}
