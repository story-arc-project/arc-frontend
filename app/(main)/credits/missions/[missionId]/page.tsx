import { notFound } from "next/navigation";
import { ProductionMissionRoute } from "@/components/features/missions/ProductionMissions";
import { MISSION_IDS, type MissionId } from "@/lib/missions/types";

export default async function MissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  if (!MISSION_IDS.includes(missionId as MissionId)) notFound();
  return <ProductionMissionRoute missionId={missionId as MissionId} />;
}
