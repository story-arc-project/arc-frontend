import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AdminComingSoon } from "@/components/features/admin/AdminComingSoon";
import { AdminCustomersView } from "@/components/features/admin/AdminCustomersView";
import { isAdminCustomersEnabled } from "@/lib/admin/flags";

export const metadata: Metadata = {
  title: "고객 · ARC Admin",
};

// FRT-16: 고객 목록·검색. 백엔드 GET /admin/customers(BAC-16)가 아직 미배포라 플래그로 봉인한다 —
// off 면 기존 "준비 중" placeholder, on(NEXT_PUBLIC_ADMIN_CUSTOMERS_ENABLED=true)이면 실제 목록.
// 게이팅은 여기(호출부)가 하고, 하위 뷰/컴포넌트는 flag 를 모른다(flag-agnostic).
export default function AdminCustomersPage() {
  if (!isAdminCustomersEnabled()) {
    return (
      <AdminComingSoon
        icon={<Users size={22} aria-hidden="true" />}
        title="고객 정보 조회"
        description="가입자 목록·검색·상세와 활동 요약을 준비하고 있어요."
      />
    );
  }

  return <AdminCustomersView />;
}
