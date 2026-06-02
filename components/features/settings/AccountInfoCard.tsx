import { Card, CardHeader, CardTitle, Badge } from "@/components/ui";
import type { Account } from "@/types/auth";

interface AccountInfoCardProps {
  account: Account;
}

const OAUTH_LABELS: Record<string, string> = {
  google: "Google",
  kakao: "Kakao",
  naver: "Naver",
  apple: "Apple",
};

export function AccountInfoCard({ account }: AccountInfoCardProps) {
  const socials = account.connected_oauth ?? [];

  return (
    <Card variant="default" padding="lg">
      <CardHeader>
        <CardTitle>계정 정보</CardTitle>
      </CardHeader>
      <dl className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-body-sm text-text-secondary shrink-0">이메일</dt>
          <dd className="text-body text-text-primary truncate">{account.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-body-sm text-text-secondary shrink-0">이메일 인증</dt>
          <dd>
            {account.email_verified ? (
              <Badge variant="success">인증됨</Badge>
            ) : (
              <Badge variant="warning">미인증</Badge>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-body-sm text-text-secondary shrink-0">연결된 소셜</dt>
          <dd className="text-body text-text-primary text-right">
            {socials.length > 0 ? (
              socials.map((p) => OAUTH_LABELS[p] ?? p).join(", ")
            ) : (
              <span className="text-text-tertiary">없음</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
