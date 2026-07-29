import type { Metadata } from "next";
import { UserRound } from "lucide-react";

import { AdminComingSoon } from "@/components/features/admin/AdminComingSoon";
import { AdminCustomerDetailView } from "@/components/features/admin/AdminCustomerDetailView";
import { isAdminCustomersEnabled } from "@/lib/admin/flags";

export const metadata: Metadata = {
  title: "고객 상세 · ARC Admin",
};

// FRT-17: 고객 상세 + 활동 요약. 백엔드 GET /admin/customers/{id}(BAC-17)가 아직 없어 계약을
// 선확정하고 구현한 뒤, 목록과 **같은 플래그**로 봉인해 둔다.
//
// 게이팅은 이 호출부에서만 한다(FRT-16 과 동일 원칙) — 목록이 잠겨 있는데 상세 라우트만 열리면
// 안 되고, 플래그를 컴포넌트 안에서 읽으면 NEXT_PUBLIC_* 빌드타임 인라인 때문에 Storybook 에서
// 영영 false 가 되어 UI 를 검증할 수 없다(FRT-108/109 · FRT-140 의 "카드만 숨기고 라우트는 열림").
export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isAdminCustomersEnabled()) {
    return (
      <AdminComingSoon
        icon={<UserRound size={22} aria-hidden="true" />}
        title="고객 상세"
        description="가입자 상세와 활동 요약을 준비하고 있어요."
      />
    );
  }

  const { id } = await params;
  return <AdminCustomerDetailView id={id} />;
}
