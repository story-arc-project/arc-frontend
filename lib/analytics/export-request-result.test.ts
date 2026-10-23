import { describe, expect, expectTypeOf, it } from "vitest";

import { ApiError } from "@/lib/api/api-error";
import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsEventProps } from "./events";
import { classifyExportRequestResult } from "./export-request-result";

describe("classifyExportRequestResult", () => {
  it("uses explicit resolution as acceptance", () => {
    expect(classifyExportRequestResult({ outcome: "resolved", timedOut: false })).toEqual({ accepted: true, request_result: "success" });
  });

  it.each([200, 201, 204, 299])("preserves 2xx acceptance when the response is unreadable (%s)", (status) => {
    expect(classifyExportRequestResult({ outcome: "rejected", error: new ApiError(status, "private body", "INVALID_JSON"), timedOut: false })).toEqual({ accepted: true, request_result: "response_unreadable" });
  });

  it.each([400, 401, 403, 422, 500, 503])("classifies API rejection (%s)", (status) => {
    expect(classifyExportRequestResult({ outcome: "rejected", error: new ApiError(status, "private error"), timedOut: false })).toEqual({ accepted: false, request_result: "api_error" });
  });

  it("does not infer resolution from an absent error", () => {
    expect(classifyExportRequestResult({ outcome: "rejected", timedOut: false })).toEqual({ accepted: null, request_result: "network_or_unknown" });
  });

  it.each([new Error("private message"), new TypeError("Failed to fetch"), { status: 400 }, null])("keeps raw failures unknown", (error) => {
    expect(classifyExportRequestResult({ outcome: "rejected", error, timedOut: false })).toEqual({ accepted: null, request_result: "network_or_unknown" });
  });

  it.each([0, 199, 300, 399, -1, NaN, Infinity, 200.5])("keeps invalid or nonfinal status unknown (%s)", (status) => {
    expect(classifyExportRequestResult({ outcome: "rejected", error: new ApiError(status, "private error"), timedOut: false })).toEqual({ accepted: null, request_result: "network_or_unknown" });
  });

  it("distinguishes abort from an owned timeout", () => {
    const error = new DOMException("private abort reason", "AbortError");
    expect(classifyExportRequestResult({ outcome: "rejected", error, timedOut: false })).toEqual({ accepted: null, request_result: "aborted" });
    expect(classifyExportRequestResult({ outcome: "rejected", error, timedOut: true })).toEqual({ accepted: null, request_result: "timeout" });
  });

  it("returns only allowlisted result metadata", () => {
    expect(Object.keys(classifyExportRequestResult({ outcome: "rejected", error: new ApiError(500, "secret", "SECRET"), timedOut: false })).sort()).toEqual(["accepted", "request_result"]);
  });
});

it("exposes request telemetry and excludes official server outcomes from the FE contract", () => {
  expect(ANALYTICS_EVENTS.exportRequested).toBe("export_requested");
  expect(Object.values(ANALYTICS_EVENTS)).not.toContain("export_completed");
  expectTypeOf<Extract<AnalyticsEventName, "export_completed" | "export_failed">>().toEqualTypeOf<never>();
  expectTypeOf<Extract<keyof AnalyticsEventProps, "export_completed" | "export_failed">>().toEqualTypeOf<never>();
  expectTypeOf<AnalyticsEventProps["export_requested"]["accepted"]>().toEqualTypeOf<boolean | null>();
  expectTypeOf<AnalyticsEventProps["export_requested"]["request_result"]>().toEqualTypeOf<
    "success" | "response_unreadable" | "api_error" | "timeout" | "aborted" | "network_or_unknown"
  >();
  expectTypeOf<Extract<AnalyticsEventProps["export_requested"], { export_type: "resume" }>["language"]>().toEqualTypeOf<string>();
  expectTypeOf<Extract<AnalyticsEventProps["export_requested"], { export_type: "cover_letter" }>["question_count"]>().toEqualTypeOf<number>();
  expectTypeOf<Extract<keyof AnalyticsEventProps["export_requested"], "status" | "error" | "message" | "body" | "token" | "idempotency_key">>().toEqualTypeOf<never>();
});
