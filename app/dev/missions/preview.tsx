"use client";
import { useRef, useState } from "react";
import { MissionPreviewPanel } from "@/components/features/missions/MissionPreviewPanel";
import { InsufficientCreditsDialog } from "@/components/features/credits/InsufficientCreditsDialog";
import { CreditCharge } from "@/components/features/credits/CreditCharge";
import { FakeDoorTelemetryProvider } from "@/components/features/credits/FakeDoorDialog";
import { createFakeDoorMock } from "@/lib/mocks/fake-door";
import type { MissionScenario } from "@/lib/mocks/missions";

export function MissionsPreview() {
  const [scenario, setScenario] = useState<MissionScenario>("normal");
  const [account, setAccount] = useState("preview-account-a");
  return <main>
    <aside className="border-b border-border bg-surface-secondary px-4 py-4 text-body-sm">
      <p className="mb-3">FRT-348 개발 미리보기 · 예시 계정/보상입니다. 실제 참여·지급 없음.</p>
      <div className="flex flex-wrap items-center gap-4">
        <label>시나리오 <select className="min-h-11 rounded border border-border px-3" value={scenario} onChange={event => setScenario(event.target.value as MissionScenario)}>
          <option value="normal">기본</option><option value="loading">느린 응답</option><option value="load-error">목록 오류</option><option value="empty">빈 응답</option><option value="partial">일부 누락</option><option value="no-rewards">수령 가능 없음</option><option value="claim-loss">수령 응답 유실</option><option value="submit-loss">제출 응답 유실</option><option value="balance-error">잔액 갱신 오류</option>
        </select></label>
        <button className="min-h-11 rounded border border-border px-4" onClick={() => setAccount(account === "preview-account-a" ? "preview-account-b" : "preview-account-a")}>계정 전환</button>
        <output aria-label="현재 계정">{account}</output>
      </div>
    </aside>
    <PreviewFlow key={`${scenario}:${account}`} account={account} scenario={scenario} />
  </main>;
}
function PreviewFlow({ account, scenario }: { account: string; scenario: MissionScenario }) {
  const [screen, setScreen] = useState<"form" | "prices" | "missions">("form");
  const [insufficient, setInsufficient] = useState(false);
  const [draft, setDraft] = useState("");
  const [fakeDoor] = useState(() => createFakeDoorMock());
  const opener = useRef<HTMLButtonElement>(null);
  const back = () => { setScreen("form"); requestAnimationFrame(() => opener.current?.focus()); };
  return <FakeDoorTelemetryProvider accountId={account}>
    <section hidden={screen !== "form"} className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <h1 className="text-heading-2">작성 중인 작업</h1>
      <label className="block">작성 중인 내용<textarea value={draft} onChange={e => setDraft(e.target.value)} className="mt-2 block min-h-40 w-full rounded border border-border p-4" /></label>
      <div className="flex flex-wrap gap-3">
        <button ref={opener} className="min-h-11 rounded bg-text-primary px-4 text-white" onClick={() => setScreen("missions")}>미션 센터 열기</button>
        <button className="min-h-11 rounded border border-border px-4" onClick={() => setInsufficient(true)}>부족 안내 열기</button>
      </div><p>자동 생성 요청: 0</p>
    </section>
    <InsufficientCreditsDialog open={insufficient} onClose={() => setInsufficient(false)} onCharge={() => { setInsufficient(false); setScreen("prices"); }} />
    {screen === "prices" && <CreditCharge fakeDoor={{ accountId: account, entryPoint: "mission-preview", adapter: fakeDoor.adapter, onMission: () => setScreen("missions") }} onBack={back} />}
    <div hidden={screen !== "missions"}>
      <MissionPreviewPanel accountId={account} scenario={scenario} onBack={back} diagnostics />
    </div>
  </FakeDoorTelemetryProvider>;
}
