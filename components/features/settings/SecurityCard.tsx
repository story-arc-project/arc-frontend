import { Card, CardHeader, CardTitle, Button } from "@/components/ui";

interface SecurityCardProps {
  hasPassword: boolean;
}

export function SecurityCard({ hasPassword }: SecurityCardProps) {
  const label = hasPassword ? "비밀번호 변경" : "비밀번호 설정";
  const hint = hasPassword
    ? "비밀번호를 변경할 수 있어요."
    : "소셜 로그인 계정이에요. 비밀번호를 설정하면 이메일로도 로그인할 수 있어요.";

  return (
    <Card variant="default" padding="lg">
      <CardHeader>
        <CardTitle>보안</CardTitle>
      </CardHeader>
      <p className="text-body-sm text-text-secondary mb-3">{hint}</p>
      {/* TODO(FRT-8): 비밀번호 재설정 화면 연결 + disabled 해제 */}
      <Button variant="secondary" size="sm" fullWidth disabled>
        {label} (준비 중)
      </Button>
    </Card>
  );
}
