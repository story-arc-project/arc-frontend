import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductionMissionRoute } from "./ProductionMissions";
import MissionsPage from "@/app/(main)/credits/missions/page";
import MissionPage from "@/app/(main)/credits/missions/[missionId]/page";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), notFound: vi.fn() }));
vi.mock("@/components/features/credits/CreditBalance", () => ({ CreditBalance: () => null }));
vi.mock("./MissionWorkspace", () => ({ MissionWorkspace: ({ entryPath, onNavigate }: { entryPath: string; onNavigate: (id?: string) => void }) => <><output>{entryPath}</output><button onClick={() => onNavigate("M2")}>Detail</button><button onClick={() => onNavigate()}>List</button></> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("preserves the allowlisted settings marker through list and detail routes", async () => {
  const page = await MissionsPage({ searchParams: Promise.resolve({ entry: "settings" }) });
  render(page);
  expect(screen.getByText("settings")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Detail" }));
  expect(push).toHaveBeenCalledWith("/credits/missions/M2?entry=settings");
  cleanup();
  const detail = await MissionPage({ params: Promise.resolve({ missionId: "M2" }), searchParams: Promise.resolve({ entry: "settings" }) });
  render(detail);
  fireEvent.click(screen.getByRole("button", { name: "List" }));
  expect(push).toHaveBeenCalledWith("/credits/missions?entry=settings");
});
it.each([undefined, "https://private.example", ["settings", "private@example.com"]])("does not accept arbitrary entry query data: %s", async entry => {
  render(await MissionsPage({ searchParams: Promise.resolve({ entry }) }));
  expect(screen.getByText("direct")).toBeInTheDocument();
});
it("keeps direct production visits direct", () => {
  render(<ProductionMissionRoute />);
  fireEvent.click(screen.getByRole("button", { name: "Detail" }));
  expect(push).toHaveBeenCalledWith("/credits/missions/M2");
});
