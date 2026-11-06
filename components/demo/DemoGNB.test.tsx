import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";

const mocks = vi.hoisted(() => ({ reopen: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/demo/archive" }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ reopen: mocks.reopen }) }));
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} onClick={(event) => { event.preventDefault(); onClick?.(event); }} />
  ),
}));

import { DemoGNB } from "./DemoGNB";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function controlledNav(button: HTMLElement) {
  const id = button.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  const nav = document.getElementById(id!);
  expect(nav?.tagName).toBe("NAV");
  return nav!;
}

describe("DemoGNB mobile menu", () => {
  it("keeps a hidden controlled navigation with collapsed state", () => {
    render(<DemoGNB />);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(controlledNav(toggle)).not.toBeVisible();
  });

  it("updates the name and expansion state with Enter and Space while retaining focus", async () => {
    const user = userEvent.setup();
    render(<DemoGNB />);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAccessibleName("메뉴 닫기");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(controlledNav(toggle)).toBeVisible();
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(toggle).toHaveAccessibleName("메뉴 열기");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(controlledNav(toggle)).not.toBeVisible();
    expect(toggle).toHaveFocus();
  });

  it.each([
    ["아카이브", "/demo/archive"], ["분석", "/demo/analysis"],
    ["익스포트", "/demo/export"], ["회원가입", "/signup"],
  ])("preserves %s destination and closes after activation", async (name, href) => {
    const user = userEvent.setup();
    render(<DemoGNB />);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    await user.click(toggle);
    const nav = controlledNav(toggle);
    const link = within(nav).getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    await user.click(link);
    expect(toggle).toHaveAccessibleName("메뉴 열기");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toBeVisible();
  });

  it("closes before reopening the guide", async () => {
    const user = userEvent.setup();
    render(<DemoGNB />);
    const toggle = screen.getByRole("button", { name: "메뉴 열기" });
    await user.click(toggle);
    await user.click(within(controlledNav(toggle)).getByRole("button", { name: "가이드 다시 보기" }));
    expect(mocks.reopen).toHaveBeenCalledOnce();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(controlledNav(toggle)).not.toBeVisible();
  });

  it("uses a different control target for each mounted instance", () => {
    render(<><DemoGNB /><DemoGNB /></>);
    const toggles = screen.getAllByRole("button", { name: "메뉴 열기" });
    const ids = toggles.map((button) => controlledNav(button).id);
    expect(new Set(ids).size).toBe(2);
  });
});
