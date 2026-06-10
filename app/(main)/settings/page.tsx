"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button, Card } from "@/components/ui";
import { ProfileEditForm } from "@/components/features/settings/ProfileEditForm";
import { PlanCard } from "@/components/features/settings/PlanCard";
import { AccountInfoCard } from "@/components/features/settings/AccountInfoCard";
import { SecurityCard } from "@/components/features/settings/SecurityCard";
import { DeleteAccountCard } from "@/components/features/settings/DeleteAccountCard";

export default function SettingsPage() {
  const { user, isLoading, logout } = useAuth();

  // 최초 로드(아직 user 미확정)에서만 전체 스피너를 노출한다.
  // refetch(예: 프로필 저장 후 동기화)는 isLoading을 토글하므로, user 가 있으면 화면을
  // 유지해 페이지가 스피너로 깜빡이지 않게 한다. (AuthGate의 `user===null && isLoading`과 동일 패턴)
  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-body text-text-tertiary">불러오는 중...</p>
      </div>
    );
  }

  const account = user?.account;
  const isSocialAccount = (account?.connected_oauth ?? []).length > 0;
  const profile = user?.profile ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-12">
      <h1 className="text-heading-2 text-text-primary mb-8">내 계정</h1>

      <Card variant="default" padding="lg" className="mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center text-heading-2 text-text-tertiary shrink-0">
          {profile?.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-title font-semibold text-text-primary truncate mb-0.5">
            {profile?.name ?? "이름 없음"}
          </p>
          <p className="text-body-sm text-text-secondary truncate">{account?.email}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ProfileEditForm profile={profile} />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <PlanCard />
          {account && <AccountInfoCard account={account} />}
          {account && <SecurityCard hasPassword={account.has_password} />}
          <Button variant="destructive" fullWidth onClick={logout}>
            로그아웃
          </Button>
          {account && (
            <DeleteAccountCard
              isSocialAccount={isSocialAccount}
              connectedOauth={account.connected_oauth ?? []}
            />
          )}
        </div>
      </div>
    </div>
  );
}
