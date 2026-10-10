import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ProductionMissionSession } from "./ProductionMissions";
import { useMissionSession } from "./MissionSession";
import { useMissions } from "@/lib/missions/use-missions";

const auth = vi.hoisted(() => ({ user: { account: { email: "account-a@example.com" } } as { account: { email: string } } | null, isLoading: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
function EvidenceProbe() {
  const store = useMissionSession();
  const state = useMissions(store);
  return <><button onClick={() => store.setDraft("M2", { url: "https://example.com", note: "private draft" })}>Write draft</button><output>{state.drafts.M2?.note ?? "empty"}</output></>;
}
afterEach(() => { cleanup(); auth.user = { account: { email: "account-a@example.com" } }; auth.isLoading = false; });
it("preserves the same account draft during auth refresh and clears it on account change or logout", async () => {
  const view = () => <ProductionMissionSession><EvidenceProbe /></ProductionMissionSession>;
  const { rerender } = render(view());
  await act(async () => {});
  await act(async () => screen.getByRole("button", { name: "Write draft" }).click());
  auth.isLoading = true;
  rerender(view());
  expect(screen.getByText("private draft")).toBeInTheDocument();
  auth.isLoading = false;
  rerender(view());
  expect(screen.getByText("private draft")).toBeInTheDocument();
  auth.user = { account: { email: "account-b@example.com" } };
  await act(async () => rerender(view()));
  expect(screen.getByText("empty")).toBeInTheDocument();
  await act(async () => screen.getByRole("button", { name: "Write draft" }).click());
  auth.user = null;
  await act(async () => rerender(view()));
  expect(screen.getByText("empty")).toBeInTheDocument();
});
