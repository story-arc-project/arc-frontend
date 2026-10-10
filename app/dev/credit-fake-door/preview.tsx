"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FakeDoorTelemetryProvider } from "@/components/features/credits/FakeDoorDialog";
import { CreditCharge } from "@/components/features/credits/CreditCharge";
import { InsufficientCreditsDialog } from "@/components/features/credits/InsufficientCreditsDialog";
import { MissionPreviewPanel } from "@/components/features/missions/MissionPreviewPanel";
import { createFakeDoorMock } from "@/lib/mocks/fake-door";

export function FakeDoorPreview() {
  const [scenario, setScenario] = useState("normal");
  return <PreviewSession key={scenario} scenario={scenario} onScenario={setScenario} />;
}
function PreviewSession({ scenario, onScenario }: { scenario: string; onScenario: (value: string) => void }) {
  const mock = useMemo(() => createFakeDoorMock({
    catalogFailures: scenario === "catalog-error" ? 1 : 0,
    intentFailures: scenario === "intent-error" ? 1 : 0,
    exposureFailures: scenario === "exposure-error" ? 1 : 0,
    delayMs: scenario === "delayed" ? 2000 : 20,
    audience: scenario === "repeat" ? "repeat" : undefined,
  }), [scenario]);
  const [accountId, setAccountId] = useState("preview-account-a");
  const [screen, setScreen] = useState<"form" | "insufficient" | "prices" | "mission">("form");
  const [draft, setDraft] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const returnScroll = useRef(0);
  const chargePage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (screen !== "prices") return;
    // Wait until the departing dialog has restored focus, then move to the visible page.
    const frame = requestAnimationFrame(() => chargePage.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [screen]);
  const close = () => {
    setScreen("form");
    requestAnimationFrame(() => { trigger.current?.focus({ preventScroll: true }); window.scrollTo(0, returnScroll.current); });
  };
  return <FakeDoorTelemetryProvider accountId={accountId}><main className="mx-auto max-w-3xl space-y-6 p-6 text-text-primary">
    <h1 className="text-heading-2">FRT-138 개발 전용 preview</h1>
    <p>인증·저장·미션은 메모리 mock입니다. 실제 결제와 보상은 발생하지 않습니다.</p>
    <label className="block">시나리오 <select aria-label="시나리오" value={scenario} onChange={(e) => onScenario(e.target.value)}>
      <option value="normal">정상</option><option value="catalog-error">가격 오류</option>
      <option value="intent-error">의향 응답 유실</option><option value="exposure-error">노출 기록 오류</option>
      <option value="delayed">느린 응답</option><option value="repeat">반복 의향</option>
    </select></label>
    <div hidden={screen === "prices" || screen === "mission"}>
    <label className="block">작성 중인 내용<textarea aria-label="작성 중인 내용" className="mt-2 block w-full rounded border p-4" value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
    <Button ref={trigger} onClick={() => { returnScroll.current = window.scrollY; setScreen("insufficient"); }}>분석 시도 (부족 안내 mock)</Button>
    <p>생성 요청: 0 · 실제 잔액 변경: 0</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => setAccountId((id) => id.endsWith("a") ? "preview-account-b" : "preview-account-a")}>계정 전환</Button>
      <Button variant="secondary" onClick={() => setSnapshot(JSON.stringify({ intents: mock.intents, exposures: mock.exposures }, null, 2))}>기록 확인</Button>
    </div>
    <output aria-label="현재 계정">{accountId}</output>
    <pre data-testid="mock-records" className="overflow-auto text-xs">{snapshot}</pre>
    {screen === "form" && <div className="h-[70vh]" aria-hidden="true" />}
    <InsufficientCreditsDialog open={screen === "insufficient"} onClose={close} onCharge={() => setScreen("prices")} />
    {screen === "prices" && <div ref={chargePage}><CreditCharge fakeDoor={{ accountId, entryPoint: "development-preview", adapter: mock.adapter, onMission: () => setScreen("mission") }} onBack={close} /></div>}
    <div hidden={screen !== "mission"}>
      <MissionPreviewPanel key={accountId} accountId={accountId} scenario="normal" onBack={close} />
    </div>
  </main></FakeDoorTelemetryProvider>;
}
