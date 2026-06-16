"use client";

import { useRouter } from "next/navigation";

import { PASSWORD_RESET_ENABLED } from "@/app/(auth)/constants";
import { Card, CardHeader, CardTitle, Button } from "@/components/ui";

interface SecurityCardProps {
  hasPassword: boolean;
}

export function SecurityCard({ hasPassword }: SecurityCardProps) {
  const router = useRouter();
  const label = hasPassword ? "비밀번호 변경" : "비밀번호 설정";
  const hint = hasPassword
    ? "비밀번호를 변경할 수 있어요."
    : "소셜 로그인 계정이에요. 비밀번호를 설정하면 이메일로도 로그인할 수 있어요.";

  // forgot-password 는 기존 비밀번호 보유 계정의 재설정(이메일 코드) 흐름이다.
  // 비밀번호가 없는 소셜 전용 계정의 최초 '설정'은 별도 흐름이 필요하므로 아직 활성화하지 않는다.
  const enabled = PASSWORD_RESET_ENABLED && hasPassword;
  const buttonLabel = enabled ? label : `${label} (준비 중)`;

  return (
    <Card variant="default" padding="lg">
      <CardHeader>
        <CardTitle>보안</CardTitle>
      </CardHeader>
      <p className="text-body-sm text-text-secondary mb-3">{hint}</p>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        disabled={!enabled}
        onClick={() => router.push("/forgot-password?from=settings")}
      >
        {buttonLabel}
      </Button>
    </Card>
  );
}
