"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getCreditPackages, type CreditPackage } from "@/lib/api/credit-packages-api";

const number = new Intl.NumberFormat("ko-KR");

/** States: loading → catalog (or API default fallback) → selection → CTA-only reveal.
 * No selectable defaults during loading: a late catalog cannot invalidate a selection.
 */
export function CreditCharge() {
  const [packages, setPackages] = useState<readonly CreditPackage[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const selected = packages?.find((item) => item.id === selectedId);

  useEffect(() => {
    const controller = new AbortController();
    void getCreditPackages(controller.signal).then((catalog) => {
      if (controller.signal.aborted) return;
      setSelectedId(null);
      setPackages(catalog);
    });
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/settings" className="mb-8 inline-flex min-h-11 items-center gap-2 text-body-sm text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        <ArrowLeft size={16} aria-hidden="true" /> 내 계정
      </Link>
      <header className="mb-8 sm:mb-10">
        <h1 className="text-heading-2 text-text-primary">크레딧 충전</h1>
        <p className="mt-3 text-body text-text-secondary">필요한 만큼, 나에게 맞는 패키지를 선택하세요.</p>
      </header>

      <fieldset className="min-w-0" aria-busy={!packages}>
        <legend className="mb-4 text-title font-semibold text-text-primary">충전 패키지</legend>
        {!packages ? (
          <div role="status">
            <span className="sr-only">패키지를 불러오는 중이에요</span>
            <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((index) => <div key={index} className="h-48 rounded-xl border border-border bg-surface-secondary motion-safe:animate-pulse" />)}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {packages.map((item) => (
              <label key={item.id} className="relative min-w-0 cursor-pointer">
                <input type="radio" name="credit-package" value={item.id} checked={selectedId === item.id} onChange={() => setSelectedId(item.id)} className="peer sr-only" />
                <div className="h-full rounded-xl border border-border bg-surface p-5 transition-colors hover:border-text-tertiary peer-checked:border-brand peer-checked:bg-brand/5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand sm:p-6">
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-title font-semibold text-text-primary [overflow-wrap:anywhere]">{item.name}</span>
                    <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selectedId === item.id ? "border-brand bg-brand text-text-on-brand" : "border-border"}`}>
                      {selectedId === item.id && <Check size={13} />}
                    </span>
                  </div>
                  <p className="break-words text-heading-2 text-text-primary [overflow-wrap:anywhere]">{number.format(item.credits)} <span className="text-body-sm font-normal text-text-secondary">크레딧</span></p>
                  <p className="mt-3 break-words text-body text-text-secondary [overflow-wrap:anywhere]">{number.format(item.price_krw)}원</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="mt-8 flex flex-col gap-6 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0" aria-live="polite" aria-atomic="true">
          <p className="text-body-sm text-text-secondary">{selected ? "선택한 패키지" : "패키지를 선택해 주세요"}</p>
          {selected && <p className="mt-1 break-words text-title font-semibold text-text-primary [overflow-wrap:anywhere]">{selected.name} · {number.format(selected.price_krw)}원</p>}
        </div>
        <Button size="lg" disabled={!selected} onClick={() => { if (selected) setRevealed(true); }} className="shrink-0 sm:min-w-44">결제하기</Button>
      </div>

      <Dialog open={revealed} onClose={() => setRevealed(false)} ariaLabel="크레딧 충전 안내" className="max-w-md">
        <h2 className="text-title font-semibold text-text-primary">크레딧 충전을 준비하고 있어요</h2>
        <p className="mt-3 text-body text-text-secondary">아직 결제 기능이 제공되지 않아요. 결제는 진행되지 않았으며, 크레딧도 충전되지 않았어요.</p>
        <Button fullWidth className="mt-6" onClick={() => setRevealed(false)}>닫기</Button>
      </Dialog>
    </div>
  );
}
