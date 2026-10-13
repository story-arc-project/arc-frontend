import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RegenerateConfirmDialog } from "./RegenerateConfirmDialog";

afterEach(cleanup);

it("normally focuses cancel, then restores confirm after insufficient credits", async () => {
  const visible = vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(() => document.body);
  const props = { submitting: false, onClose: vi.fn(), onConfirm: vi.fn() };
  try {
    const { rerender } = render(<RegenerateConfirmDialog {...props} open />);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    rerender(<RegenerateConfirmDialog {...props} open={false} />);
    rerender(<RegenerateConfirmDialog {...props} open restoreConfirmFocus />);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(screen.getByRole("button", { name: "다시 만들기" })).toHaveFocus();
    expect(props.onConfirm).not.toHaveBeenCalled();
  } finally { visible.mockRestore(); }
});
