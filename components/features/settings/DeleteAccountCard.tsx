"use client";

import { useEffect, useState } from "react";

import { Card, Button } from "@/components/ui";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

interface DeleteAccountCardProps {
  isSocialAccount: boolean;
  connectedOauth: string[];
}

export function DeleteAccountCard({ isSocialAccount, connectedOauth }: DeleteAccountCardProps) {
  const [open, setOpen] = useState(false);
  const [redirectError, setRedirectError] = useState(false);

  // 소셜 탈퇴 OAuth 왕복 실패 시 콜백이 /settings?deleteError=1 로 돌려보낸다.
  // Suspense 경계 없이 처리하려 window.location.search 를 직접 읽고 파라미터를 정리한다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deleteError") === "1") {
      // 마운트 후 1회 브라우저 전용 쿼리(deleteError)를 읽어 동기화한다.
      // 렌더 중 window 읽기는 SSR 하이드레이션 불일치를 유발하므로 effect가 올바른 위치다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedirectError(true);
      params.delete("deleteError");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  return (
    <Card variant="default" padding="lg" className="border-error/40">
      <h3 className="text-body font-semibold text-error mb-1">위험 구역</h3>
      <p className="text-body-sm text-text-secondary mb-3">
        회원 탈퇴 시 계정과 모든 데이터가 삭제되며 되돌릴 수 없어요.
      </p>
      {redirectError && (
        <p className="text-body-sm text-error mb-3">
          탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.
        </p>
      )}
      <Button variant="destructive" size="sm" fullWidth onClick={() => setOpen(true)}>
        회원 탈퇴
      </Button>
      <DeleteAccountDialog
        open={open}
        onClose={() => setOpen(false)}
        isSocialAccount={isSocialAccount}
        connectedOauth={connectedOauth}
      />
    </Card>
  );
}
