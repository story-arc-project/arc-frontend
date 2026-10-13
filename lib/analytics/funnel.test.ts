import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDemoMode } from "@/lib/demo/state";
import { capture } from "./client";
import { captureFunnel, sanitizeFunnelEntry } from "./funnel";
vi.mock("./client", () => ({ capture: vi.fn() }));
vi.mock("@/lib/demo/state", () => ({ isDemoMode: vi.fn(() => false) }));
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_FUNNEL_DEPLOYMENT", "production"); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });
const props = { flow_id: "flow", intent_id: "intent", entry_path: "charge_page" as const };
describe("funnel transport", () => {
  it("adds observation identity without claiming server confirmation", () => {
    vi.stubEnv("NODE_ENV", "production");
    captureFunnel("fake_door_revealed", props);
    expect(capture).toHaveBeenCalledWith("fake_door_revealed", expect.objectContaining({ ...props, event_id: expect.any(String), occurred_at: expect.any(String), schema_version: 1, environment: "production" }));
    expect(vi.mocked(capture).mock.calls[0][1]).not.toHaveProperty("first_exposure");
  });
  it.each(["development", "test"])("excludes %s even if the SDK was configured", environment => {
    vi.stubEnv("NODE_ENV", environment);
    captureFunnel("fake_door_revealed", props);
    expect(capture).not.toHaveBeenCalled();
  });
  it.each(["preview", "development", "unknown", ""])("excludes deployment %s even from a production bundle", deployment => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_FUNNEL_DEPLOYMENT", deployment);
    captureFunnel("fake_door_revealed", props);
    expect(capture).not.toHaveBeenCalled();
  });
  it("excludes demo sessions", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isDemoMode).mockReturnValueOnce(true);
    captureFunnel("fake_door_revealed", props);
    expect(capture).not.toHaveBeenCalled();
  });
  it("excludes dev preview routes even in production simulation", () => {
    vi.stubEnv("NODE_ENV", "production");
    window.history.replaceState({}, "", "/dev/missions");
    captureFunnel("fake_door_revealed", props);
    expect(capture).not.toHaveBeenCalled();
  });
  it("never lets SDK errors block the user's action", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(capture).mockImplementationOnce(() => { throw new Error("SDK unavailable"); });
    expect(() => captureFunnel("fake_door_revealed", props)).not.toThrow();
  });
  it("does not turn URLs or arbitrary entry strings into analytics properties", () => {
    expect(sanitizeFunnelEntry("https://example.com/?email=private")).toBe("unknown");
    expect(sanitizeFunnelEntry("insufficient_credits")).toBe("insufficient_credits");
  });
});
