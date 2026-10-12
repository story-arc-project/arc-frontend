import { ProductionMissionRoute } from "@/components/features/missions/ProductionMissions";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ entry?: string | string[] }> }) {
  const { entry } = await searchParams;
  return <ProductionMissionRoute entryPath={entry === "settings" ? "settings" : "direct"} />;
}
