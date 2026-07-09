import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { AdminComingSoon } from "@/components/features/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "감사 로그 · ARC Admin",
};

// 자리표시 — 후속 BAC-14(감사 로그 facility) 연동 시 본문을 교체한다.
export default function AdminAuditLogPage() {
  return (
    <AdminComingSoon
      icon={<ScrollText size={22} aria-hidden="true" />}
      title="감사 로그"
      description="고객 데이터 조회·익스포트 기록 추적을 준비하고 있어요."
    />
  );
}
