"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { CreditBalance } from "@/components/features/credits/CreditBalance";
import { invalidateCredits } from "@/lib/credits/events";
import { unavailableAdapter } from "@/lib/missions/unavailable-adapter";
import type { MissionId } from "@/lib/missions/types";
import { MissionSession } from "./MissionSession";
import { MissionWorkspace } from "./MissionWorkspace";

export function ProductionMissionSession({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const accountId = user?.account.email ?? (isLoading ? "auth-loading" : "signed-out");
  return <MissionSession accountId={accountId} adapter={unavailableAdapter} onClaimed={invalidateCredits}>{children}</MissionSession>;
}

export function ProductionMissionRoute({ missionId }: { missionId?: MissionId }) {
  const router = useRouter();
  return <MissionWorkspace balance={<CreditBalance variant="summary" />} initialMissionId={missionId}
    onNavigate={id => router.push(id ? `/credits/missions/${id}` : "/credits/missions")}
    onBack={() => router.push("/settings")} backLabel="내 계정으로" />;
}

export function EmbeddedProductionMissions({ onBack }: { onBack: () => void }) {
  return <ProductionMissionSession><MissionWorkspace balance={<CreditBalance variant="summary" />}
    onBack={onBack} backLabel="이전 화면으로" /></ProductionMissionSession>;
}
