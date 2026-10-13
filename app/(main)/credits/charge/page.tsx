import { CreditCharge } from "@/components/features/credits/CreditCharge";

export default async function CreditChargePage({ searchParams }: { searchParams: Promise<{ entry?: string | string[] }> }) {
  const { entry } = await searchParams;
  const entryPath = entry === "insufficient_credits" ? "insufficient_credits" : "charge_page";
  return <main><CreditCharge entryPath={entryPath} /></main>;
}
