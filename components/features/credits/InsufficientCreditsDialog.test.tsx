import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsufficientCreditsDialog } from "./InsufficientCreditsDialog";

afterEach(cleanup);
describe("InsufficientCreditsDialog", () => {
  it("offers a real charge link and supports Escape dismissal", async () => {
    const onClose = vi.fn();
    render(<InsufficientCreditsDialog open onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "크레딧이 부족해요" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("link", { name: "충전 페이지로 이동" })).toHaveAttribute("href", "/credits/charge");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("does not mount a dialog when closed", () => {
    render(<InsufficientCreditsDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
