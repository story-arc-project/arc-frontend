"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditBalanceView } from "@/components/features/credits/CreditBalance";
import { createMissionMock, type MissionScenario } from "@/lib/mocks/missions";
import type { CreditsState } from "@/types/credits";
import { MissionSession } from "./MissionSession";
import { MissionWorkspace } from "./MissionWorkspace";
import { useMissionSession } from "./MissionSession";

/** Imported only by explicitly gated preview routes. No production fallback. */
export function MissionPreviewPanel({ accountId, scenario = "normal", onBack, diagnostics = false }: {
  accountId: string; scenario?: MissionScenario; onBack: () => void; diagnostics?: boolean;
}) {
  return <PreviewAccount key={`${accountId}:${scenario}`} scenario={scenario} accountId={accountId} onBack={onBack} diagnostics={diagnostics} />;
}
function PreviewAccount({ accountId, scenario, onBack, diagnostics }: Required<Parameters<typeof MissionPreviewPanel>[0]>) {
  const mock = useMemo(() => createMissionMock({ scenario, delayMs: 40 }), [scenario]);
  const controller = useRef<AbortController | null>(null);
  const [balance, setBalance] = useState<CreditsState>({ status: "loading", data: null, error: null, isRefreshing: false, isStale: false });
  const refresh = useCallback(async () => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted) return;
    setBalance(previous => ({ ...previous, isRefreshing: !!previous.data }));
    try {
      const value = await mock.readBalance(signal);
      if (!signal.aborted) setBalance({ status: "success", data: { balance: value, available: value, reserved: 0, updated_at: "2026-10-10T00:00:00Z" }, error: null, isRefreshing: false, isStale: false });
    } catch (error) {
      if (!signal.aborted) setBalance(previous => ({ ...previous, status: "error", error: error as Error, isRefreshing: false, isStale: !!previous.data }));
      throw error;
    }
  }, [mock]);
  useEffect(() => {
    const current = new AbortController(); controller.current = current;
    void refresh().catch(() => {});
    return () => current.abort();
  }, [refresh]);
  return <MissionSession accountId={accountId} adapter={mock.adapter} onClaimed={refresh}>
    <MissionWorkspace onBack={onBack} backLabel="작성 화면으로 돌아가기" balance={<CreditBalanceView state={balance} variant="summary" onRetry={() => { void refresh().catch(() => {}); }} />} />
    {diagnostics && <PreviewControls mock={mock} />}
  </MissionSession>;
}
function PreviewControls({ mock }: { mock: ReturnType<typeof createMissionMock> }) {
  const store = useMissionSession();
  const [records, setRecords] = useState("");
  return <aside aria-label="개발 검증 도구" className="mx-auto max-w-5xl border-t border-border px-4 py-6 text-body-sm">
    <p className="mb-3 text-text-secondary">개발 검증 전용 · 아래 승인은 운영자 API를 대신하는 시뮬레이션입니다.</p>
    <div className="flex flex-wrap gap-3">
      <button className="min-h-11 rounded border border-border px-4" onClick={() => { mock.approve("M2"); void store.load(); }}>후기 승인 시뮬레이션</button>
      <button className="min-h-11 rounded border border-border px-4" onClick={() => setRecords(JSON.stringify({ claims: mock.claims, submissions: mock.submissions }))}>요청 기록 확인</button>
    </div>
    <output data-testid="mission-requests" className="mt-3 block break-all text-xs">{records}</output>
  </aside>;
}
