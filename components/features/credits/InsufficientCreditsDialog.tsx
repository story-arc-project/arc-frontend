"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Dialog } from "@/components/ui";
import { useSuppressFeedback } from "@/contexts/FeedbackTriggerContext";
import { EmbeddedProductionMissions } from "@/components/features/missions/ProductionMissions";

type Props = { open: boolean; onClose: () => void; onCharge?: () => void };

export function InsufficientCreditsDialog({ open, ...props }: Props) {
  useSuppressFeedback(open);
  // Closing the outer flow also discards the embedded account session and view.
  return open ? <OpenCreditsDialog {...props} /> : null;
}

function OpenCreditsDialog({ onClose, onCharge }: Omit<Props, "open">) {
  const [missionsOpen, setMissionsOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const missionButton = useRef<HTMLButtonElement>(null);
  const previousView = useRef(false);
  useEffect(() => {
    if (previousView.current === missionsOpen) return;
    previousView.current = missionsOpen;
    const frame = requestAnimationFrame(() => {
      if (missionsOpen) content.current?.querySelector<HTMLButtonElement>("button")?.focus();
      else missionButton.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [missionsOpen]);
  const returnToDialog = () => setMissionsOpen(false);

  return (
    <Dialog open onClose={missionsOpen ? returnToDialog : onClose}
      ariaLabel={missionsOpen ? "크레딧 미션" : "크레딧이 부족해요"}
      className={missionsOpen ? "max-w-5xl h-[calc(100dvh-2rem)] overflow-y-auto" : undefined}>
      <div ref={content}>
        {missionsOpen ? <EmbeddedProductionMissions onBack={returnToDialog} /> : <>
          <h2 className="text-title text-text-primary">크레딧이 부족해요</h2>
          <p className="mt-2 text-body-sm text-text-secondary">계속하려면 크레딧을 충전해 주세요.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" className="min-h-11" onClick={onClose}>닫기</Button>
            <Button ref={missionButton} variant="secondary" size="sm" className="min-h-11" onClick={() => setMissionsOpen(true)}>미션 둘러보기</Button>
            {onCharge ? (
              <Button size="sm" className="min-h-11" onClick={onCharge}>충전 패키지 보기</Button>
            ) : (
              <Button asChild size="sm" className="min-h-11"><Link href="/credits/charge">충전 페이지로 이동</Link></Button>
            )}
          </div>
        </>}
      </div>
    </Dialog>
  );
}
