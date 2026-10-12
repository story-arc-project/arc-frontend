"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { captureFunnel, newFunnelId, sanitizeFunnelEntry } from "@/lib/analytics/funnel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSuppressFeedback } from "@/contexts/FeedbackTriggerContext";
import type { FakeDoorAdapter, FakeDoorCatalog, FakeDoorExposure, FakeDoorIntent } from "@/lib/credits/fake-door";

export interface FakeDoorIntegration {
  accountId: string;
  entryPoint: string;
  adapter: FakeDoorAdapter;
  onMission: (context: { flowId: string }) => void;
}
const TelemetryContext = createContext<{ accountId: string; controllers: Set<AbortController> } | null>(null);

/** Mount above page/mission navigation; a new account cancels the previous account's writes. */
export function FakeDoorTelemetryProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  const owner = useMemo(() => ({ accountId, controllers: new Set<AbortController>() }), [accountId]);
  useLayoutEffect(() => () => {
    owner.controllers.forEach((controller) => controller.abort());
    owner.controllers.clear();
  }, [owner]);
  return <TelemetryContext.Provider value={owner}>{children}</TelemetryContext.Provider>;
}

const notice = "크레딧 결제를 준비하고 있어요. 지금은 실제 결제나 충전이 이루어지지 않아요. 미션에 참여하면 정해진 보상만큼 크레딧을 받을 수 있어요.";
export function useFakeDoorFlow({ accountId, entryPoint, adapter, onMission }: FakeDoorIntegration) {
  const [flowId] = useState(newFunnelId);
  const [catalog, setCatalog] = useState<FakeDoorCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<"catalog" | "notice">("catalog");
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "error" | "saved">("idle");
  const priceViewed = useRef(false);
  const noticeViewed = useRef<string | null>(null);
  const deliberations = useRef(0);
  const entryPath = sanitizeFunnelEntry(entryPoint);
  const intent = useRef<FakeDoorIntent | null>(null);
  const pending = useRef(false);
  const clicked = useRef(false);
  const exposure = useRef<FakeDoorExposure | null>(null);
  const alive = useRef(true);
  const [localControllers] = useState(() => new Set<AbortController>());
  const owner = useContext(TelemetryContext);
  const controllers = owner?.accountId === accountId ? owner.controllers : localControllers;
  const sharedOwner = owner?.accountId === accountId;

  const selected = catalog?.packages.find((item) => item.id === selectedId);

  useLayoutEffect(() => {
    alive.current = true;
    const requests = controllers;
    return () => {
      alive.current = false;
      if (!sharedOwner) requests.forEach((controller) => controller.abort());
    };
  }, [controllers, sharedOwner]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => adapter.loadCatalog(controller.signal)).then((value) => {
      if (!controller.signal.aborted) setCatalog(value);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [adapter, attempt]);
  useEffect(() => {
    if (!catalog || priceViewed.current) return;
    priceViewed.current = true;
    captureFunnel("token_purchase_page_viewed", { flow_id: flowId, entry_path: entryPath, offer_version: catalog.version, catalog_source: "adapter", packages: catalog.packages.map(({ id, credits, price_krw }) => ({ package_id: id, credits, price_krw })) });
  }, [catalog, flowId, entryPath]);
  // Exposure is sent only after React has committed the notice, independently of intent storage.
  useEffect(() => {
    if (step !== "notice" || !intent.current) return;
    if (noticeViewed.current !== intent.current.intentId) {
      noticeViewed.current = intent.current.intentId;
      captureFunnel("fake_door_revealed", { flow_id: flowId, intent_id: intent.current.intentId, entry_path: entryPath });
    }
    const controller = new AbortController();
    controllers.add(controller);
    const payload = exposure.current ?? (exposure.current = { accountId, flowId, intentId: intent.current.intentId, exposureId: crypto.randomUUID(), shownAt: new Date().toISOString() });
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return adapter.recordExposure(payload, controller.signal);
    }).catch(() => {
      // Exposure failure is deliberately not converted into a successful event.
    }).finally(() => controllers.delete(controller));
  }, [step, adapter, accountId, flowId, controllers, entryPath]);

  function save() {
    if (pending.current || !intent.current) return;
    pending.current = true;
    setSaveStatus("pending");
    const controller = new AbortController();
    controllers.add(controller);
    const payload = intent.current;
    const timeout = window.setTimeout(() => {
      controller.abort();
      controllers.delete(controller);
      if (alive.current) { pending.current = false; setSaveStatus("error"); }
    }, 10_000);
    controller.signal.addEventListener("abort", () => window.clearTimeout(timeout), { once: true });
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return adapter.recordIntent(payload, controller.signal); }).then(() => {
      if (alive.current && !controller.signal.aborted) setSaveStatus("saved");
    }).catch(() => {
      if (alive.current && !controller.signal.aborted) setSaveStatus("error");
    }).finally(() => {
      window.clearTimeout(timeout);
      controllers.delete(controller);
      if (alive.current && !controller.signal.aborted) pending.current = false;
    });
  }
  function purchase() {
    if (!selected || !catalog || clicked.current || pending.current) return;
    clicked.current = true;
    intent.current = { accountId, flowId, intentId: crypto.randomUUID(), entryPoint, catalogVersion: catalog.version, package: selected, clickedAt: new Date().toISOString() };
    captureFunnel("credit_purchase_intent", { flow_id: flowId, intent_id: intent.current.intentId, entry_path: entryPath, offer_version: catalog.version, package_id: selected.id, credits: selected.credits, price_krw: selected.price_krw, catalog_source: "adapter" });
    save();
    setStep("notice");
  }
  function dismiss() {
    if (step === "notice") {
      if (intent.current) captureFunnel("fake_door_dismissed", { flow_id: flowId, intent_id: intent.current.intentId, entry_path: entryPath, dismissal_type: "close" });
      clicked.current = false; exposure.current = null; setStep("catalog"); }
  }

  function select(id: string) {
    const item = catalog?.packages.find((item) => item.id === id);
    if (!item || !catalog || selectedId === id) return;
    setSelectedId(id);
    captureFunnel("token_package_selected", { flow_id: flowId, entry_path: entryPath, offer_version: catalog.version, package_id: item.id, credits: item.credits, price_krw: item.price_krw, deliberation_count: ++deliberations.current, catalog_source: "adapter" });
  }
  function navigateToMission() {
    if (intent.current) captureFunnel("mission_page_navigated_from_fakedoor", { flow_id: flowId, intent_id: intent.current.intentId, entry_path: entryPath });
    onMission({ flowId });
  }
  return { catalog, loadError, selectedId, setSelectedId: select, navigateToMission, purchase, pending: saveStatus === "pending", retryCatalog: () => { setLoadError(false); setAttempt((value) => value + 1); }, notice: { open: step === "notice", onClose: dismiss, saveStatus, onRetry: save, flowId } };
}

export function FakeDoorDialog({ open, onClose, saveStatus, onRetry, onMission }: { open: boolean; onClose: () => void; saveStatus: string; onRetry: () => void; onMission: () => void }) {
  useSuppressFeedback(open);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <Dialog open={open} onClose={onClose} ariaLabel="크레딧 결제 안내" className="max-w-md max-h-[90dvh] overflow-y-auto">
    <h2 className="text-title font-semibold text-text-primary">크레딧 결제를 준비하고 있어요</h2>
    <p className="mt-4 text-body text-text-secondary">{notice}</p>
    {saveStatus === "error" && <div className="mt-4"><p role="status" className="text-body-sm text-text-secondary">선택 정보가 저장되지 않았어요. 미션은 계속 확인할 수 있어요.</p><Button variant="ghost" onClick={onRetry}>저장 다시 시도</Button></div>}
    <Button fullWidth className="mt-6" onClick={onMission}>미션으로 크레딧 받기</Button>
    <Button fullWidth variant="secondary" className="mt-2" onClick={onClose}>닫기</Button>
  </Dialog>;
}
