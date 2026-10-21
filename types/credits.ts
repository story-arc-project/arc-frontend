export interface CreditBalance {
  balance: number;
  reserved: number;
  available: number;
  updated_at: string;
}

export interface CreditsState {
  data: CreditBalance | null;
  status: "idle" | "loading" | "success" | "error" | "unavailable";
  error: Error | null;
  isRefreshing: boolean;
  isStale: boolean;
}
