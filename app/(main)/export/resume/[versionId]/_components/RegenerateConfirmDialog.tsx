"use client";

import { Button, Dialog } from "@/components/ui";

interface Props {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RegenerateConfirmDialog({
  open,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      ariaLabel="다시 만들기 확인"
      className="max-w-sm"
    >
      <h2 className="text-title text-text-primary">다시 만들까요?</h2>
      <p className="text-body-sm text-text-secondary mt-1">
        현재 편집 내용이 사라지고 새 버전이 만들어져요.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          취소
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? "만드는 중..." : "다시 만들기"}
        </Button>
      </div>
    </Dialog>
  );
}
