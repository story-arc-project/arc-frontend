import { api } from "./client";
import type { CreditBalance } from "@/types/credits";

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  // Date.parse normalizes impossible dates such as February 30.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour < 24 && minute < 60 && second < 60;
}

export function parseCreditBalance(value: unknown): CreditBalance {
  if (!value || typeof value !== "object") throw new Error("크레딧 응답 형식이 올바르지 않아요.");
  const { balance, reserved, available, updated_at } = value as Record<string, unknown>;
  const isAmount = (amount: unknown): amount is number => typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0;
  if (!isAmount(balance) || !isAmount(reserved) || !isAmount(available) ||
      reserved > balance || available !== balance - reserved || !isTimestamp(updated_at)) {
    throw new Error("크레딧 응답 형식이 올바르지 않아요.");
  }
  return { balance, reserved, available, updated_at };
}

export async function getCredits(signal?: AbortSignal): Promise<CreditBalance> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  // Bound the entire client operation (including auth refresh and response parsing).
  // Some client stages do not consume AbortSignal, so abort alone cannot bound waiting.
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
      controller.abort();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new Error("크레딧 조회 시간이 초과됐어요. 다시 시도해주세요."));
      controller.abort();
    }, 10_000);
  });
  try {
    const result = await Promise.race([
      api.get<unknown>("/credits", { cache: "no-store", signal: controller.signal }),
      cancelled,
    ]);
    return parseCreditBalance(result);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
