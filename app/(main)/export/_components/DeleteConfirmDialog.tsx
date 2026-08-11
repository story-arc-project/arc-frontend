"use client";

import { Button, Dialog } from "@/components/ui";

interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * FRT-126 — 익스포트 목록(레쥬메·자기소개서)의 삭제 확인.
 *
 * 브라우저 기본 `window.confirm` 을 대신한다. 회원 탈퇴(DeleteAccountDialog)·다시 만들기
 * (RegenerateConfirmDialog)와 같은 `Dialog` 를 써 파괴적 확인의 생김새를 한 종류로 맞춘다.
 */
export function DeleteConfirmDialog({
  open,
  title,
  description,
  deleting,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      // 삭제 요청이 나간 뒤에는 닫기를 막는다 — 취소처럼 보여도 요청은 계속 진행된다.
      onClose={deleting ? () => {} : onClose}
      ariaLabel={title}
      className="max-w-sm"
    >
      <h2 className="text-title text-text-primary">{title}</h2>
      <p className="text-body-sm text-text-secondary mt-1">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        {/* 취소를 먼저 둔다 — Dialog 가 첫 포커스 가능 요소로 포커스를 옮기므로,
            파괴적 버튼이 앞에 오면 Enter 한 번에 삭제된다. */}
        <Button variant="ghost" size="sm" onClick={onClose} disabled={deleting}>
          취소
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting ? "삭제 중..." : "삭제하기"}
        </Button>
      </div>
    </Dialog>
  );
}
