"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { Button, FullPageMessage } from "@/components/ui";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <FullPageMessage
      role="alert"
      icon={<AlertTriangle size={22} aria-hidden="true" />}
      title="문제가 발생했어요"
      description="잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요."
    >
      <Button variant="secondary" size="sm" onClick={reset}>
        다시 시도
      </Button>
    </FullPageMessage>
  );
}
