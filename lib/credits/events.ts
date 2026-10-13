export const CREDITS_INVALIDATED_EVENT = "arc:credits-invalidated";

/** Call after the server confirms a reserve/capture/release/grant, never optimistically. */
export function invalidateCredits(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_INVALIDATED_EVENT));
}
