import { notFound } from "next/navigation";
import { ProductionMissionRoute } from "@/components/features/missions/ProductionMissions";
import { MISSION_IDS, type MissionId } from "@/lib/missions/types";

export default async function MissionPage({ params, searchParams }: { params: Promise<{ missionId: string }>; searchParams: Promise<{ entry?: string | string[] }> }) {
  const { missionId } = await params;
  if (!MISSION_IDS.includes(missionId as MissionId)) notFound();
  const { entry } = await searchParams;
  return <ProductionMissionRoute missionId={missionId as MissionId} entryPath={entry === "settings" ? "settings" : "direct"} />;
}
