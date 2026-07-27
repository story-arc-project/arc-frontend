import type { Metadata } from "next";
import { UserRound } from "lucide-react";

import { AdminComingSoon } from "@/components/features/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "고객 상세 · ARC Admin",
};

// 자리표시 — FRT-16 목록의 행 클릭이 여기로 온다(B4 연결 지점). 활동 요약을 포함한 실제 상세는
// 후속 FRT-17 이 본문을 교체한다(customers/page.tsx 가 FRT-16 전까지 placeholder 였던 것과 동일).
// 이 자리표시가 있어야 목록의 행 링크가 404 로 떨어지지 않는다.
export default function AdminCustomerDetailPage() {
  return (
    <AdminComingSoon
      icon={<UserRound size={22} aria-hidden="true" />}
      title="고객 상세"
      description="가입자 상세와 활동 요약을 준비하고 있어요."
    />
  );
}
