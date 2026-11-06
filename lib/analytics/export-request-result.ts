import { ApiError } from "@/lib/api/api-error";

export type ExportRequestResult = {
  accepted: boolean | null;
  request_result:
    | "success"
    | "response_unreadable"
    | "api_error"
    | "timeout"
    | "aborted"
    | "network_or_unknown";
};

// Request settlement is browser evidence, not proof that generation completed.
// Never return error text, status, bodies, tokens, or request identifiers.
export function classifyExportRequestResult(input: {
  outcome: "resolved" | "rejected";
  error?: unknown;
  timedOut: boolean;
}): ExportRequestResult {
  if (input.outcome === "resolved") {
    return { accepted: true, request_result: "success" };
  }
  if (input.timedOut) {
    return { accepted: null, request_result: "timeout" };
  }
  if (input.error instanceof ApiError && Number.isInteger(input.error.status)) {
    if (input.error.status >= 200 && input.error.status < 300) {
      return { accepted: true, request_result: "response_unreadable" };
    }
    if (input.error.status >= 400 && input.error.status < 600) {
      return { accepted: false, request_result: "api_error" };
    }
  }
  if (
    (input.error instanceof Error || input.error instanceof DOMException) &&
    input.error.name === "AbortError"
  ) {
    return { accepted: null, request_result: "aborted" };
  }
  return { accepted: null, request_result: "network_or_unknown" };
}
