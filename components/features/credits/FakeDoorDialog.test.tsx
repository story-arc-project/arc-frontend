import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CreditCharge } from "./CreditCharge";
import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";
import type { FakeDoorAdapter } from "@/lib/credits/fake-door";

afterEach(cleanup);
const createAdapter = (): FakeDoorAdapter => ({ loadCatalog: vi.fn().mockResolvedValue({ version: "test-v1", packages: DEFAULT_CREDIT_PACKAGES }), recordIntent: vi.fn().mockResolvedValue({ audience: "first" }), recordExposure: vi.fn().mockResolvedValue(undefined) });
const props = (adapter: FakeDoorAdapter) => ({ adapter, accountId: "one", entryPoint: "preview", open: true, onClose: vi.fn(), onMission: vi.fn() });
async function purchase() { fireEvent.click((await screen.findAllByRole("radio"))[0]); fireEvent.click(screen.getByRole("button", { name: "4,900원 결제하기" })); }

describe("FakeDoorDialog", () => {
  it("requires selection, commits notice before exposure, and retains selection on Escape", async () => {
    const adapter = createAdapter();
    adapter.recordExposure = vi.fn().mockImplementation(async () => { expect(screen.getByText(/지금은 실제 결제나 충전/)).toBeInTheDocument(); });
    render(<CreditCharge fakeDoor={props(adapter)} />);
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
    expect(screen.queryByText(/지금은 실제 결제나 충전/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await purchase();
    await waitFor(() => expect(adapter.recordIntent).toHaveBeenCalledTimes(1));
    expect(adapter.recordExposure).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole("dialog")).getAllByRole("button")).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not block mission on save failure and retries with the same intent", async () => {
    const adapter = createAdapter();
    adapter.recordIntent = vi.fn().mockRejectedValue(new Error("response lost"));
    const p = props(adapter);
    render(<CreditCharge fakeDoor={p} />);
    await purchase();
    fireEvent.click(await screen.findByRole("button", { name: "저장 다시 시도" }));
    await waitFor(() => expect(adapter.recordIntent).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(adapter.recordIntent).mock.calls;
    expect(calls[0][0].intentId).toBe(calls[1][0].intentId);
    fireEvent.click(screen.getByRole("button", { name: "미션으로 크레딧 받기" }));
    expect(p.onMission).toHaveBeenCalledTimes(1);
  });
  it("deduplicates rapid clicks while allowing mission during a pending save", async () => {
    const adapter = createAdapter();
    adapter.recordIntent = vi.fn().mockImplementation(() => new Promise(() => {}));
    const p = props(adapter);
    render(<CreditCharge fakeDoor={p} />);
    fireEvent.click((await screen.findAllByRole("radio"))[0]);
    const button = screen.getByRole("button", { name: "4,900원 결제하기" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(adapter.recordIntent).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "미션으로 크레딧 받기" }));
    expect(p.onMission).toHaveBeenCalledTimes(1);
  });
  it("restores purchase focus when a pending notice closes and prevents another intent", async () => {
    const adapter = createAdapter();
    adapter.recordIntent = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<CreditCharge fakeDoor={props(adapter)} />);
    fireEvent.click((await screen.findAllByRole("radio"))[0]);
    const purchaseButton = screen.getByRole("button", { name: "4,900원 결제하기" });
    purchaseButton.focus();
    fireEvent.click(purchaseButton);
    await waitFor(() => expect(adapter.recordIntent).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(purchaseButton).toHaveFocus();
    expect(purchaseButton).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    fireEvent.click(purchaseButton);
    expect(adapter.recordIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("aborts old account requests and resets selection", async () => {
    const adapter = createAdapter();
    adapter.recordIntent = vi.fn().mockImplementation(() => new Promise(() => {}));
    const p = props(adapter);
    const view = render(<CreditCharge fakeDoor={p} />);
    await purchase();
    view.rerender(<CreditCharge fakeDoor={{ ...p, accountId: "two" }} />);
    await screen.findAllByRole("radio");
    expect(vi.mocked(adapter.recordIntent).mock.calls[0][1].aborted).toBe(true);
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
  });
  it("ignores a late old-account response", async () => {
    const adapter = createAdapter();
    let reject!: (error: Error) => void;
    adapter.recordIntent = vi.fn().mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    const p = props(adapter);
    const view = render(<CreditCharge fakeDoor={p} />);
    await purchase();
    view.rerender(<CreditCharge fakeDoor={{ ...p, accountId: "two" }} />);
    await act(async () => { reject(new Error("late")); });
    await screen.findAllByRole("radio");
    expect(screen.queryByText(/선택 정보가 저장되지/)).toBeNull();
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
  });
  it("does not block notice on exposure failure and creates a new intent for a changed package", async () => {
    const adapter = createAdapter();
    adapter.recordIntent = vi.fn().mockRejectedValue(new Error("offline"));
    adapter.recordExposure = vi.fn().mockRejectedValue(new Error("offline"));
    render(<CreditCharge fakeDoor={props(adapter)} />);
    await purchase();
    await screen.findByRole("button", { name: "저장 다시 시도" });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(screen.getByRole("button", { name: "9,900원 결제하기" }));
    await waitFor(() => expect(adapter.recordIntent).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(adapter.recordIntent).mock.calls;
    expect(calls[1][0].intentId).not.toBe(calls[0][0].intentId);
    expect(screen.getByRole("button", { name: "미션으로 크레딧 받기" })).toBeEnabled();
  });
  it("shows catalog failure and explicitly retries without default prices", async () => {
    const adapter = createAdapter();
    vi.mocked(adapter.loadCatalog).mockRejectedValueOnce(new Error("offline"));
    render(<CreditCharge fakeDoor={props(adapter)} />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 불러오기" }));
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(3));
    expect(adapter.loadCatalog).toHaveBeenCalledTimes(2);
  });
});
