"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSuppressFeedback } from "@/contexts/FeedbackTriggerContext";
import type { FakeDoorAdapter, FakeDoorCatalog, FakeDoorExposure, FakeDoorIntent } from "@/lib/credits/fake-door";

export interface FakeDoorDialogProps {
  accountId: string;
  entryPoint: string;
  adapter: FakeDoorAdapter;
  open: boolean;
  onClose: () => void;
  onMission: (context: { flowId: string }) => void;
}
const number = new Intl.NumberFormat("ko-KR");
const notice = "크레딧 결제를 준비하고 있어요. 지금은 실제 결제나 충전이 이루어지지 않아요. 미션에 참여하면 정해진 보상만큼 크레딧을 받을 수 있어요.";

/** Unpublished integration boundary. The caller keeps its source screen mounted. */
export function FakeDoorDialog(props: FakeDoorDialogProps) {
  useSuppressFeedback(props.open);
  return props.open ? <Session key={props.accountId} {...props} /> : null;
}

function Session({ accountId, entryPoint, adapter, onClose, onMission }: FakeDoorDialogProps) {
  const [flowId] = useState(() => crypto.randomUUID());
  const [catalog, setCatalog] = useState<FakeDoorCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<"catalog" | "notice">("catalog");
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "error" | "saved">("idle");
  const intent = useRef<FakeDoorIntent | null>(null);
  const pending = useRef(false);
  const clicked = useRef(false);
  const exposure = useRef<FakeDoorExposure | null>(null);
  const alive = useRef(true);
  const controllers = useRef(new Set<AbortController>());
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = catalog?.packages.find((item) => item.id === selectedId);

  useLayoutEffect(() => {
    alive.current = true;
    const requests = controllers.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      alive.current = false;
      requests.forEach((controller) => controller.abort());
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => adapter.loadCatalog(controller.signal)).then((value) => {
      if (!controller.signal.aborted) setCatalog(value);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [adapter, attempt]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);
  // Exposure is sent only after React has committed the notice, independently of intent storage.
  useEffect(() => {
    if (step !== "notice" || !intent.current) return;
    const controller = new AbortController();
    controllers.current.add(controller);
    const payload = exposure.current ?? (exposure.current = { accountId, flowId, intentId: intent.current.intentId, exposureId: crypto.randomUUID(), shownAt: new Date().toISOString() });
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return adapter.recordExposure(payload, controller.signal);
    }).catch(() => {
      // Exposure failure is deliberately not converted into a successful event.
    }).finally(() => controllers.current.delete(controller));
  }, [step, adapter, accountId, flowId]);

  function save() {
    if (pending.current || !intent.current) return;
    pending.current = true;
    setSaveStatus("pending");
    const controller = new AbortController();
    controllers.current.add(controller);
    const payload = intent.current;
    const timeout = window.setTimeout(() => {
      controller.abort();
      controllers.current.delete(controller);
      if (alive.current) { pending.current = false; setSaveStatus("error"); }
    }, 10_000);
    controller.signal.addEventListener("abort", () => window.clearTimeout(timeout), { once: true });
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return adapter.recordIntent(payload, controller.signal); }).then(() => {
      if (alive.current && !controller.signal.aborted) setSaveStatus("saved");
    }).catch(() => {
      if (alive.current && !controller.signal.aborted) setSaveStatus("error");
    }).finally(() => {
      window.clearTimeout(timeout);
      controllers.current.delete(controller);
      if (alive.current && !controller.signal.aborted) pending.current = false;
    });
  }
  function purchase() {
    if (!selected || !catalog || clicked.current || pending.current) return;
    clicked.current = true;
    if (!intent.current || intent.current.package.id !== selected.id || saveStatus === "saved") {
      intent.current = { accountId, flowId, intentId: crypto.randomUUID(), entryPoint, catalogVersion: catalog.version, package: selected, clickedAt: new Date().toISOString() };
    }
    save();
    setStep("notice");
  }
  function dismiss() {
    if (step === "notice") { clicked.current = false; exposure.current = null; setStep("catalog"); }
    else onClose();
  }

  return <Dialog open onClose={dismiss} ariaLabel={step === "catalog" ? "크레딧 충전" : "크레딧 결제 안내"} className="max-w-xl max-h-[90dvh] overflow-y-auto">
    <h2 ref={heading} tabIndex={-1} className="text-heading-2 text-text-primary outline-none">{step === "catalog" ? "크레딧 충전" : "크레딧 결제를 준비하고 있어요"}</h2>
    {step === "catalog" ? <>
      <p className="mt-3 text-body text-text-secondary">필요한 만큼, 나에게 맞는 패키지를 선택하세요.</p>
      {!catalog && !loadError && <p role="status" className="py-8 text-text-secondary">가격을 불러오는 중이에요</p>}
      {loadError && <div className="py-6"><p role="alert">가격을 불러오지 못했어요.</p><Button className="mt-3" onClick={() => { setLoadError(false); setAttempt((value) => value + 1); }}>다시 불러오기</Button></div>}
      {catalog && <fieldset className="mt-6"><legend className="mb-3 text-title">충전 패키지</legend><div className="grid gap-3 sm:grid-cols-3">{catalog.packages.map((item) => <label key={item.id} className="cursor-pointer"><input className="peer sr-only" type="radio" name={`package-${flowId}`} checked={selectedId === item.id} onChange={() => setSelectedId(item.id)} /><span className="block rounded-xl border border-border p-4 peer-checked:border-brand peer-checked:bg-brand/5 peer-focus-visible:outline-2 peer-focus-visible:outline-brand"><span className="block font-semibold">{item.credits} 크레딧</span><span className="mt-2 block text-text-secondary">{number.format(item.price_krw)}원</span></span></label>)}</div></fieldset>}
      <Button fullWidth className="mt-6" disabled={!selected || saveStatus === "pending"} onClick={purchase}>{selected ? `${number.format(selected.price_krw)}원 결제하기` : "결제하기"}</Button>
    </> : <>
      <p className="mt-4 text-body text-text-secondary">{notice}</p>
      {saveStatus === "error" && <div className="mt-4"><p role="status" className="text-body-sm text-text-secondary">선택 정보가 저장되지 않았어요. 미션은 계속 확인할 수 있어요.</p><Button variant="ghost" onClick={save}>저장 다시 시도</Button></div>}
      <Button fullWidth className="mt-6" onClick={() => onMission({ flowId })}>미션으로 크레딧 받기</Button>
      <Button fullWidth variant="secondary" className="mt-2" onClick={dismiss}>닫기</Button>
    </>}
    <Button fullWidth variant="ghost" className="mt-2" onClick={onClose}>돌아가기</Button>
  </Dialog>;
}
