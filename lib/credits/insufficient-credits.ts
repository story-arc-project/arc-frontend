import { ApiError } from "@/lib/api/api-error";

/** Only explicit server rejections from a paid operation can open the dialog. */
export function isInsufficientCredits(error: unknown): boolean {
  return error instanceof ApiError &&
    (error.status === 402 || error.code === "INSUFFICIENT_CREDITS");
}
