import { describe, expect, it } from "vitest";
import { resolveCallbackUrl } from "@/lib/auth/callback-url";

describe("resolveCallbackUrl — login redirect security contract", () => {
  // These destinations must remain local even if URL parsing normalizes an attack.
  it.each([
    "https://evil.example/archive",
    "http://localhost/archive",
    "javascript:alert(1)",
    "data:text/html,hello",
    "//evil.example/archive?next=1#record",
    "///evil.example/archive",
    "/\\evil.example/archive",
    "\\evil.example/archive",
    "/\\\\evil.example/archive",
    "/.//evil.example/archive",
    "/safe/..//evil.example/archive",
    "/%2e//evil.example/archive",
    "/safe/%2e%2e//evil.example/archive",
    "//localhost.evil.example/archive",
    "//localhost@evil.example/archive",
    "//localhost:8000/archive",
    "//[invalid",
    "//",
    "",
    "archive",
    "?next=/archive",
    "#record",
    " /archive",
  ])("falls back to /dashboard for %j", (raw) => {
    expect(resolveCallbackUrl(raw)).toBe("/dashboard");
  });

  it.each([
    ["/", "/"],
    ["/dashboard", "/dashboard"],
    ["/archive/record?tab=notes&sort=recent#passage", "/archive/record?tab=notes&sort=recent#passage"],
    ["/archive?next=https%3A%2F%2Fevil.example#https://evil.example", "/archive?next=https%3A%2F%2Fevil.example#https://evil.example"],
    ["/archive/../dashboard?tab=recent#top", "/dashboard?tab=recent#top"],
    ["/archive/./record", "/archive/record"],
    ["/archive\\record?tab=notes#top", "/archive/record?tab=notes#top"],
    ["/%2F%2Fevil.example?value=%23top#record", "/%2F%2Fevil.example?value=%23top#record"],
    ["//localhost/archive?tab=notes#top", "/archive?tab=notes#top"],
    ["/archive?callbackUrl=//evil.example", "/archive?callbackUrl=//evil.example"],
  ])("preserves the internal destination %j as %j", (raw, destination) => {
    expect(resolveCallbackUrl(raw)).toBe(destination);
  });
});
