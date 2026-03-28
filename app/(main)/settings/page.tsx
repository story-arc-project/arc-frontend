"use client";

import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button, Badge } from "@/components/ui";

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
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "프로필"}
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center text-heading-2 text-text-tertiary">
            {user?.name?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-title font-semibold text-text-primary truncate">
              {user?.name ?? "이름 없음"}
            </p>
            {user?.plan && (
              <Badge variant={user.plan === "pro" ? "brand" : "default"}>
                {user.plan === "pro" ? "Pro" : "Free"}
              </Badge>
            )}
          </div>
          <p className="text-body-sm text-text-secondary truncate">
            {user?.email}
          </p>
        </div>
      </div>

      <Button variant="destructive" fullWidth onClick={handleLogout}>
        로그아웃
      </Button>
    </div>
  );
}
