import { capture } from "@/lib/analytics";
import { classifyExportRequestResult } from "./export-request-result";

type Metadata =
  | { export_type: "resume"; language: "ko" | "en"; experience_count?: number }
  | { export_type: "cover_letter"; question_count: number };

// Observe only API settlement. UI callbacks and analytics failures cannot change it.
export async function observeExportRequest<T>(
  request: () => Promise<T>,
  metadata: Metadata,
  isCurrent: () => boolean,
  options: { timedOut?: () => boolean; onSettled?: () => void } = {},
): Promise<T> {
  const record = (outcome: "resolved" | "rejected", error?: unknown) => {
    options.onSettled?.();
    if (!isCurrent()) return;
    try {
      capture("export_requested", {
        ...metadata,
        ...classifyExportRequestResult({ outcome, error, timedOut: options.timedOut?.() ?? false }),
      });
    } catch {
      // Collection is best effort and must never change request/UI behavior.
    }
  };
  let result: T;
  try {
    result = await request();
  } catch (error) {
    record("rejected", error);
    throw error;
  }
  record("resolved");
  return result;
}
