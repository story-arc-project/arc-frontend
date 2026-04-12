"use client";

import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

export default function SettingsPage() {
  const { user, isLoading } = useAuth();

  async function handleLogout() {
    await api.post("/auth/logout").catch(() => {});
    window.location.href = "/login";
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-body text-text-tertiary">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-heading-2 text-text-primary mb-8">내 계정</h1>

      <div className="bg-surface border border-border rounded-xl p-6 flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center text-heading-2 text-text-tertiary">
          {user?.profile?.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-title font-semibold text-text-primary truncate mb-0.5">
            {user?.profile?.name ?? "이름 없음"}
          </p>
          <p className="text-body-sm text-text-secondary truncate">
            {user?.account?.email}
          </p>
        </div>
      </div>

      <Button variant="destructive" fullWidth onClick={handleLogout}>
        로그아웃
      </Button>
    </div>
  );
}
