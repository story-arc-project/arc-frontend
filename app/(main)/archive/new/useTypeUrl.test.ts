import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import useTypeUrl from "./useTypeUrl"

vi.mock("next/navigation", () => ({
  usePathname: () => "/archive/new",
  useSearchParams: () => new URLSearchParams(),
}))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
beforeEach(() => window.history.replaceState({}, "", "/archive/new?returnTo=%2Farchive%3Flib%3Dx"))

describe("type URL navigation", () => {
  it("pushes a first selection and replaces a confirmed changed type without losing returnTo", () => {
    const push = vi.spyOn(window.history, "pushState")
    const { result } = renderHook(() => useTypeUrl(false))
    act(() => result.current.onTypeSelect("career"))
    expect(result.current.selectedTypeId).toBe("career")
    expect(push).toHaveBeenCalledTimes(1)
    act(() => result.current.onTypeSelect("award"))
    expect(result.current.selectedTypeId).toBe("award")
    expect(push).toHaveBeenCalledTimes(1)
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/archive?lib=x")
  })
  it("consumes dirty sentinel into a selector without truncating Forward via pushState", () => {
    window.history.replaceState({ __navGuardSentinel: true }, "", "/archive/new?type=career")
    const { result } = renderHook(() => useTypeUrl(true))
    const push = vi.spyOn(window.history, "pushState")
    // Browser Back landed on the selected form base behind the sentinel.
    window.history.replaceState({}, "", "/archive/new?type=career")
    act(() => expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: {} }))).toBe(true))
    expect(result.current.selectedTypeId).toBeNull()
    expect(push).not.toHaveBeenCalled()
    // The same selector URL base represents an actual page-leave attempt.
    expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: {} }))).toBe(false)
  })
  it("allows Forward sentinel restoration and rejects another route", () => {
    const { result } = renderHook(() => useTypeUrl(true))
    window.history.replaceState({ __navGuardSentinel: true }, "", "/archive/new?type=career")
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { __navGuardSentinel: true } })))
    expect(result.current.selectedTypeId).toBe("career")
    expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: { __navGuardSentinel: true } }))).toBe(true)
    window.history.replaceState({}, "", "/archive")
    expect(result.current.onInternalPop(new PopStateEvent("popstate"))).toBe(false)
  })
  it("resynchronizes from the restored URL on pageshow", () => {
    const { result } = renderHook(() => useTypeUrl(false))
    window.history.replaceState({}, "", "/archive/new?type=award")
    act(() => window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })))
    expect(result.current.selectedTypeId).toBe("award")
  })
  it("selecting again from a dirty selector creates one sentinel entry", () => {
    const { result } = renderHook(() => useTypeUrl(true))
    const push = vi.spyOn(window.history, "pushState")
    act(() => result.current.onTypeSelect("career"))
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.history.state.__navGuardSentinel).toBe(true)
  })
})


it("adds a selector base to direct type links once, including StrictMode/remount", () => {
  window.history.replaceState({}, "", "/archive/new?type=career&returnTo=%2Farchive%3Flib%3Dx")
  const push = vi.spyOn(window.history, "pushState")
  const replace = vi.spyOn(window.history, "replaceState")
  const { unmount } = renderHook(() => useTypeUrl(false))
  expect(replace).toHaveBeenCalledWith({ __archiveTypeStep: true }, "", "/archive/new?returnTo=%2Farchive%3Flib%3Dx")
  expect(push).toHaveBeenCalledTimes(1)
  expect(window.location.search).toContain("type=career")
  unmount()
  renderHook(() => useTypeUrl(false))
  expect(push).toHaveBeenCalledTimes(1)
})


it("clean Forward remains a type step even if the URL subscription rendered before the guard callback", () => {
  const { result } = renderHook(() => useTypeUrl(false))
  act(() => result.current.onTypeSelect("career"))
  window.history.replaceState({}, "", "/archive/new")
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))
    expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: {} }))).toBe(true)
  })
  expect(result.current.selectedTypeId).toBeNull()
  // Force the subscribed reactive value to render career first, just as Next's
  // popstate listener can do before the guard listener is reached.
  window.history.replaceState({ __archiveTypeStep: true }, "", "/archive/new?type=career")
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { __archiveTypeStep: true } })))
  expect(result.current.selectedTypeId).toBe("career")
  act(() => expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: { __archiveTypeStep: true } }))).toBe(true))
  expect(window.location.search).toBe("?type=career")
  expect(result.current.selectedTypeId).toBe("career")
})


it("persisted pageshow followed by its same-entry popstate preserves the restored clean type", () => {
  const { result } = renderHook(() => useTypeUrl(false))
  const state = { __archiveTypeStep: true }
  window.history.replaceState(state, "", "/archive/new?type=career")
  act(() => window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })))
  expect(result.current.selectedTypeId).toBe("career")
  act(() => expect(result.current.onInternalPop(new PopStateEvent("popstate", { state }))).toBe(true))
  expect(window.location.search).toBe("?type=career")
  expect(result.current.selectedTypeId).toBe("career")
})

it("a real Back from a restored dirty sentinel still reaches the selector", () => {
  const { result } = renderHook(() => useTypeUrl(true))
  window.history.replaceState({ __archiveTypeStep: true, __navGuardSentinel: true }, "", "/archive/new?type=career")
  act(() => window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })))
  // Same URL, different sentinel identity: this is a real traversal, not the
  // popstate accompanying restoration of the sentinel entry itself.
  window.history.replaceState({ __archiveTypeStep: true }, "", "/archive/new?type=career")
  act(() => expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: { __archiveTypeStep: true } }))).toBe(true))
  expect(result.current.selectedTypeId).toBeNull()
})

it("a real clean Back after pageshow is not swallowed and clears the restoration marker", () => {
  const { result } = renderHook(() => useTypeUrl(false))
  window.history.replaceState({ __archiveTypeStep: true }, "", "/archive/new?type=career")
  act(() => window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })))
  window.history.replaceState({}, "", "/archive/new")
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))
    expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: {} }))).toBe(true)
  })
  expect(result.current.selectedTypeId).toBeNull()
  act(() => result.current.onTypeSelect("career"))
  act(() => expect(result.current.onInternalPop(new PopStateEvent("popstate", { state: {} }))).toBe(true))
  expect(result.current.selectedTypeId).toBeNull()
})
