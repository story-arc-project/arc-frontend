"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  plan?: "free" | "pro";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: { user: AuthUser } }>("/auth/me", { auth: false })
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
  };
}
