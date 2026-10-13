import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MissionSession, useMissionSession } from "./MissionSession";
import { useMissions } from "@/lib/missions/use-missions";
import type { MissionAdapter } from "@/lib/missions/types";

function Status() {
  const state = useMissions(useMissionSession());
  return <output>{state.status}</output>;
}
afterEach(cleanup);
function renderSession(adapter: MissionAdapter) {
  return render(<StrictMode><MissionSession accountId="account-a" adapter={adapter} onClaimed={() => {}}><Status /></MissionSession></StrictMode>);
}
it("starts only one initial load during StrictMode effect replay", async () => {
  const adapter: MissionAdapter = {
    load: vi.fn().mockResolvedValue({ version: "1", missions: [{ missionId: "M1", status: "unavailable" }] }),
    submit: vi.fn(), claim: vi.fn(),
  };
  renderSession(adapter);
  expect(await screen.findByText("success")).toBeInTheDocument();
  expect(adapter.load).toHaveBeenCalledTimes(1);
});
it("keeps an initial error without silently retrying under StrictMode", async () => {
  const adapter: MissionAdapter = {
    load: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ version: "2", missions: [{ missionId: "M1", status: "available" }] }),
    submit: vi.fn(), claim: vi.fn(),
  };
  renderSession(adapter);
  expect(await screen.findByText("error")).toBeInTheDocument();
  expect(adapter.load).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("success")).toBeNull();
});
