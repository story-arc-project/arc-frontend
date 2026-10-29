"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { ExperienceTypeId } from "@/types/archive"
import { parseNewExperienceType, withExperienceType } from "@/lib/utils/archive-type-url"

const TYPE_URL_CHANGED = "archive-type-url-changed"
function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  window.addEventListener("pageshow", onChange)
  window.addEventListener(TYPE_URL_CHANGED, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener("pageshow", onChange)
    window.removeEventListener(TYPE_URL_CHANGED, onChange)
  }
}
function notify() {
  window.dispatchEvent(new Event(TYPE_URL_CHANGED))
}

/** The URL is canonical; native history keeps the current draft mounted. */
export default function useTypeUrl(hasUnsaved: boolean) {
  const params = useSearchParams()
  const pathname = usePathname()
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => params.toString())
  const selectedTypeId = parseNewExperienceType(new URLSearchParams(search))
  // React/Next may synchronously render the pop target before the guard listener
  // runs. Keep the last accepted step separately from the reactive URL value.
  const acceptedTypeRef = useRef(selectedTypeId)
  const restoredEntryRef = useRef<{ href: string; sentinel: boolean } | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const state = window.history.state
    if (url.pathname !== pathname || !parseNewExperienceType(url.searchParams) || state?.__archiveTypeStep || state?.__navGuardSentinel) return
    // A shared/direct type link also needs a safe selector base behind it.
    // Tag the step so refresh and StrictMode do not grow another pair.
    window.history.replaceState({ __archiveTypeStep: true }, "", withExperienceType(url, null))
    window.history.pushState({ __archiveTypeStep: true }, "", `${url.pathname}${url.search}${url.hash}`)
    notify()
  }, [pathname])

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      acceptedTypeRef.current = parseNewExperienceType(new URLSearchParams(window.location.search))
      // A bfcache restoration can be followed by popstate for the very same
      // entry. It did not consume the guard base; do not turn its type off.
      restoredEntryRef.current = event.persisted ? {
        href: window.location.href,
        sentinel: Boolean(window.history.state?.__navGuardSentinel),
      } : null
    }
    window.addEventListener("pageshow", restore)
    return () => window.removeEventListener("pageshow", restore)
  }, [])

  const onTypeSelect = useCallback((type: ExperienceTypeId) => {
    restoredEntryRef.current = null
    const url = new URL(window.location.href)
    const currentType = parseNewExperienceType(url.searchParams)
    const next = withExperienceType(url, type)
    if (currentType) {
      // A confirmed explicit change replaces the chosen type, not the selector step.
      window.history.replaceState({ __archiveTypeStep: true, ...(window.history.state?.__navGuardSentinel ? { __navGuardSentinel: true } : {}) }, "", next)
    } else {
      // A dirty selector already owns its guard base. The selected entry doubles
      // as its sentinel instead of inserting another duplicate step.
      window.history.pushState({ __archiveTypeStep: true, ...(hasUnsaved ? { __navGuardSentinel: true } : {}) }, "", next)
    }
    acceptedTypeRef.current = type
    notify()
  }, [hasUnsaved])

  const onInternalPop = useCallback((event: PopStateEvent): boolean => {
    const restoredEntry = restoredEntryRef.current
    restoredEntryRef.current = null
    const url = new URL(window.location.href)
    if (url.pathname !== pathname) return false
    const targetType = parseNewExperienceType(url.searchParams)
    const previousType = acceptedTypeRef.current
    acceptedTypeRef.current = targetType
    if (restoredEntry?.href === url.href && restoredEntry.sentinel === Boolean(event.state?.__navGuardSentinel)) return true
    if (event.state?.__navGuardSentinel) return true // Forward restores the selected form.
    if (targetType && previousType) {
      // Back popped the dirty form's duplicate sentinel. Turn the landed base
      // into the selector; its Forward entry stays intact with the chosen type.
      window.history.replaceState({ __archiveTypeStep: true }, "", withExperienceType(url, null))
      acceptedTypeRef.current = null
      notify()
      return true
    }
    // Different URL steps retain the in-memory draft. A second Back on the
    // selector's same-URL guard base still uses the normal discard modal.
    return targetType !== previousType
  }, [pathname])

  return { selectedTypeId, onTypeSelect, onInternalPop }
}
