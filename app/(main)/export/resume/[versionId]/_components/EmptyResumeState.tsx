"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  onContinueAnyway?: () => void;
}

export function EmptyResumeState({ onContinueAnyway }: Props) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--gnb-h))] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-tertiary text-text-tertiary">
        <Inbox size={24} />
      </div>
      <h2 className="text-title text-text-primary">
        기록된 경험이 아직 없어요
      </h2>
      <p className="text-body-sm text-text-secondary max-w-sm">
        경험을 먼저 기록해볼까요? 아카이브에 경험이 쌓이면 더 풍부한 레쥬메를 만들 수 있어요.
      </p>
      <div className="mt-3 flex gap-2">
        <Link href="/archive">
          <Button variant="primary" size="sm">
            경험 기록하러 가기
          </Button>
        </Link>
        {onContinueAnyway && (
          <Button variant="ghost" size="sm" onClick={onContinueAnyway}>
            빈 레쥬메 편집하기
          </Button>
        )}
      </div>
    </div>
  );
}
