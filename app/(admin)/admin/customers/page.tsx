import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AdminComingSoon } from "@/components/features/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "고객 · ARC Admin",
};

// 자리표시 — 후속 FRT-16(목록·검색)·FRT-17(상세+활동 요약)에서 본문을 교체한다.
export default function AdminCustomersPage() {
  return (
    <AdminComingSoon
      icon={<Users size={22} aria-hidden="true" />}
      title="고객 정보 조회"
      description="가입자 목록·검색·상세와 활동 요약을 준비하고 있어요."
    />
  );
}
