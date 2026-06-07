"use client";

import { useState } from "react";

import { Dialog, Button, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { deleteAccountWithPassword } from "@/lib/api/auth-api";
import {
  PROVIDER_LABELS,
  pickReauthProvider,
  startOAuthReauth,
} from "@/lib/auth/oauth-providers";

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
  isSocialAccount: boolean;
  connectedOauth: string[];
}

export function DeleteAccountDialog({
  open,
  onClose,
  isSocialAccount,
  connectedOauth,
}: DeleteAccountDialogProps) {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = isSocialAccount ? pickReauthProvider(connectedOauth) : null;
  const providerLabel = provider ? PROVIDER_LABELS[provider] : "소셜";

  // 제출/리다이렉트 중에는 닫기를 막고(취소처럼 보여도 OAuth 왕복은 계속되므로),
  // 닫을 때 입력·에러를 초기화해 다시 열었을 때 이전 시도 상태가 남지 않게 한다.
  function handleClose() {
    if (isSubmitting) return;
    setPassword("");
    setError(null);
    onClose();
  }

  async function handlePasswordDelete() {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteAccountWithPassword(password);
      // 성공: 하드 내비게이션으로 세션/컨텍스트 정리 후 로그인으로 이동.
      window.location.assign("/login?deleted=1");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? "비밀번호가 올바르지 않아요."
          : "탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.";
      setError(msg);
      setIsSubmitting(false);
    }
  }

  function handleSocialDelete() {
    if (!provider) {
      setError("지원하지 않는 로그인 방식이에요.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const ok = startOAuthReauth(provider);
    if (!ok) {
      setError(`${PROVIDER_LABELS[provider]} 인증을 사용할 수 없어요.`);
      setIsSubmitting(false);
    }
    // ok 이면 리다이렉트가 일어나므로 이후 상태 변경 없음.
  }

  return (
    <Dialog open={open} onClose={handleClose} ariaLabel="회원 탈퇴 확인">
      <h2 className="text-title font-semibold text-text-primary mb-2">회원 탈퇴</h2>
      <p className="text-body-sm text-text-secondary mb-4">
        탈퇴하면 계정과 작성한 모든 경험·분석 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없어요.
      </p>

      {isSocialAccount ? (
        <p className="text-body-sm text-text-secondary mb-4">
          {providerLabel} 계정으로 본인 확인 후 탈퇴가 진행돼요.
        </p>
      ) : (
        <div className="mb-4">
          <Input
            label="현재 비밀번호"
            type="password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
      )}

      {error && <p className="text-body-sm text-error mb-4">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
          취소
        </Button>
        {isSocialAccount ? (
          <Button variant="destructive" onClick={handleSocialDelete} disabled={isSubmitting}>
            {isSubmitting ? "이동 중..." : `${providerLabel} 인증하고 탈퇴하기`}
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={handlePasswordDelete}
            disabled={isSubmitting || password.length === 0}
          >
            {isSubmitting ? "탈퇴 처리 중..." : "탈퇴하기"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
