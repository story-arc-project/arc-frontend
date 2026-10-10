import type { ReactNode } from "react";
import { ProductionMissionSession } from "@/components/features/missions/ProductionMissions";

export default function MissionsLayout({ children }: { children: ReactNode }) {
  return <ProductionMissionSession>{children}</ProductionMissionSession>;
}
