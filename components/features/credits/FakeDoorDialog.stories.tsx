import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { FakeDoorTelemetryProvider } from "./FakeDoorDialog";
import { CreditCharge } from "./CreditCharge";
import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";
import type { FakeDoorAdapter } from "@/lib/credits/fake-door";

function Preview({ mode = "ready" }: { mode?: "ready" | "loading" | "error" | "pending" | "failure" }) {
  const [open, setOpen] = useState(false);
  const [mission, setMission] = useState(false);
  const [account, setAccount] = useState("preview-account");
  const adapter = useMemo<FakeDoorAdapter>(() => ({
    loadCatalog: async () => { if (mode === "loading") return new Promise(() => {}); if (mode === "error") throw new Error("Preview catalog failure"); return { version: "preview-v1", packages: DEFAULT_CREDIT_PACKAGES }; },
    recordIntent: async () => { if (mode === "pending") return new Promise(() => {}); if (mode === "failure") throw new Error("Preview save failure"); return { audience: "first" }; },
    recordExposure: async () => {},
  }), [mode]);
  return <FakeDoorTelemetryProvider accountId={account}><main className="min-h-screen bg-background p-6 text-text-primary"><p className="mb-4 text-body-sm">개발 전용 preview · 실제 저장·결제·미션 보상 없음</p><label className="block">작성 중인 내용<textarea aria-label="작성 중인 내용" className="my-4 block w-full rounded border p-3" defaultValue="이어 쓰던 자기소개서" /></label><button className="min-h-11 rounded bg-brand px-4 text-white" onClick={() => { setOpen(true); setMission(false); }}>크레딧 충전 페이지 열기</button><button className="ml-4 min-h-11" onClick={() => setAccount((value) => `${value}-next`)}>계정 전환 (mock)</button>{mission && <section className="mt-6 rounded border p-6"><h2>미션 목적지 (mock)</h2><p>FRT-348 연결 경계입니다. 실제 미션이나 보상은 제공하지 않습니다.</p></section>}{open && <CreditCharge fakeDoor={{ accountId: account, entryPoint: "storybook", adapter, onMission: () => { setOpen(false); setMission(true); } }} onBack={() => setOpen(false)} />}</main></FakeDoorTelemetryProvider>;
}
const meta = { title: "Features/Credits/FakeDoorDialog", tags: ["frt138"], component: Preview, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
const open: NonNullable<Story["play"]> = async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole("button", { name: "크레딧 충전 페이지 열기" })); };
const select: NonNullable<Story["play"]> = async (context) => { await open(context); const canvas = within(context.canvasElement); await userEvent.click((await canvas.findAllByRole("radio"))[0]); };
const reveal: NonNullable<Story["play"]> = async (context) => { await select(context); const canvas = within(context.canvasElement); await userEvent.click(canvas.getByRole("button", { name: "4,900원 결제하기" })); await expect(canvas.getByText(/지금은 실제 결제나 충전/)).toBeVisible(); };
export const Catalog: Story = { play: async (context) => { await open(context); const canvas = within(context.canvasElement); await canvas.findAllByRole("radio"); await expect(canvas.getByRole("button", { name: "결제하기" })).toBeDisabled(); } };
export const Selected: Story = { play: select };
export const Notice: Story = { play: reveal };
export const Loading: Story = { args: { mode: "loading" }, play: open };
export const CatalogError: Story = { args: { mode: "error" }, play: open };
export const SavePending: Story = { args: { mode: "pending" }, play: reveal };
export const SaveFailure: Story = { args: { mode: "failure" }, play: reveal };
export const MissionMock: Story = { play: async (context) => { await reveal(context); const canvas = within(context.canvasElement); await userEvent.click(canvas.getByRole("button", { name: "미션으로 크레딧 받기" })); await expect(canvas.getByText("미션 목적지 (mock)")).toBeVisible(); await expect(canvas.getByRole("textbox")).toHaveValue("이어 쓰던 자기소개서"); } };
