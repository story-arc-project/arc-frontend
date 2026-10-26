import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fireEvent, within } from "storybook/test";

import { AuthContext } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import type { AuthContextValue } from "@/types/auth";
import { DemoGNB } from "./DemoGNB";

const auth: AuthContextValue = {
  user: null, isLoading: false, isAuthenticated: false, isOnboarded: false,
  error: null, refetch: async () => {}, logout: async () => {},
};

const meta: Meta<typeof DemoGNB> = {
  title: "Demo/DemoGNB",
  component: DemoGNB,
  tags: ["frt242"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/demo/archive" } },
  },
  decorators: [(Story) => (
    <AuthContext.Provider value={auth}>
      <DemoModeProvider><Story /></DemoModeProvider>
    </AuthContext.Provider>
  )],
};
export default meta;
type Story = StoryObj<typeof DemoGNB>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector<HTMLButtonElement>("button[aria-controls]")!;
    await expect(toggle).toHaveAttribute("aria-label", "메뉴 열기");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const nav = canvasElement.ownerDocument.getElementById(toggle.getAttribute("aria-controls")!);
    await expect(nav).toHaveAttribute("hidden");
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector<HTMLButtonElement>("button[aria-controls]")!;
    await expect(toggle).toHaveAttribute("aria-label", "메뉴 열기");
    // The CI runner also exercises this state at desktop width, where the mobile toggle is CSS-hidden.
    // Native keyboard behavior and responsive visibility are covered on actual routes by Playwright.
    fireEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-label", "메뉴 닫기");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const nav = canvasElement.ownerDocument.getElementById(toggle.getAttribute("aria-controls")!);
    await expect(nav).not.toHaveAttribute("hidden");
    await expect(within(nav!).getByText("분석")).toHaveAttribute("href", "/demo/analysis");
  },
};
