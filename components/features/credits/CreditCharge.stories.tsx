import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { delay, http, HttpResponse } from "msw";
import { CreditCharge } from "./CreditCharge";
import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";

const meta: Meta<typeof CreditCharge> = {
  title: "Features/Credits/CreditCharge",
  component: CreditCharge,
  parameters: {
    layout: "fullscreen",
    msw: { handlers: [http.get("*/credits/packages", () => HttpResponse.json({ packages: DEFAULT_CREDIT_PACKAGES }))] },
  },
};
export default meta;
type Story = StoryObj<typeof CreditCharge>;

export const Catalog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("radio", { name: /Lite/ });
    await expect(canvas.getByRole("button", { name: "결제하기" })).toBeDisabled();
    await expect(canvas.queryByText("크레딧 충전을 준비하고 있어요")).toBeNull();
  },
};
export const Selected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: /Basic/ }));
    await expect(canvas.getByRole("button", { name: "결제하기" })).toBeEnabled();
    await expect(canvas.queryByRole("dialog")).toBeNull();
  },
};
export const RevealAndClose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: /Lite/ }));
    await userEvent.click(canvas.getByRole("button", { name: "결제하기" }));
    await expect(canvas.getByRole("dialog", { name: "크레딧 충전 안내" })).toBeVisible();
    await expect(canvas.getByText(/결제는 진행되지 않았으며/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "닫기" }));
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvas.getByRole("button", { name: "결제하기" })).toHaveFocus();
  },
};
export const Loading: Story = {
  parameters: { msw: { handlers: [http.get("*/credits/packages", async () => { await delay("infinite"); return HttpResponse.json({}); })] } },
};
export const DefaultFallback: Story = {
  parameters: { msw: { handlers: [http.get("*/credits/packages", () => HttpResponse.json({ packages: [] }))] } },
  play: Catalog.play,
};
export const LongCatalogNames: Story = {
  parameters: { msw: { handlers: [http.get("*/credits/packages", () => HttpResponse.json({ packages: [{ id: "long", name: "LongPackageName".repeat(6), credits: Number.MAX_SAFE_INTEGER, price_krw: Number.MAX_SAFE_INTEGER }] }))] } },
};
