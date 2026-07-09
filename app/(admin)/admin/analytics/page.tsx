import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { AdminComingSoon } from "@/components/features/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "행동 분석 · ARC Admin",
};

// 자리표시 — 후속 FRT-18~20(PostHog 퍼널·리텐션)에서 본문을 교체한다.
export default function AdminAnalyticsPage() {
  return (
    <AdminComingSoon
      icon={<BarChart3 size={22} aria-hidden="true" />}
      title="행동 분석"
      description="핵심 퍼널·리텐션·이탈 추적(PostHog)을 준비하고 있어요."
    />
  );
}
