"use client";

import Link from "next/link";
import { Button, Dialog } from "@/components/ui";
import { useSuppressFeedback } from "@/contexts/FeedbackTriggerContext";

export function InsufficientCreditsDialog({ open, onClose, onCharge }: { open: boolean; onClose: () => void; onCharge?: () => void }) {
  useSuppressFeedback(open);

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="크레딧이 부족해요">
      <h2 className="text-title text-text-primary">크레딧이 부족해요</h2>
      <p className="mt-2 text-body-sm text-text-secondary">
        계속하려면 크레딧을 충전해 주세요.
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" className="min-h-11" onClick={onClose}>닫기</Button>
        {onCharge ? (
          <Button size="sm" className="min-h-11" onClick={onCharge}>충전 패키지 보기</Button>
        ) : (
          <Button asChild size="sm" className="min-h-11">
            <Link href="/credits/charge">충전 페이지로 이동</Link>
          </Button>
        )}
      </div>
    </Dialog>
  );
}
