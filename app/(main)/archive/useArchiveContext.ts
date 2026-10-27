"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { buildReturnTo, parseArchiveContext, type ArchiveContext } from "@/lib/utils/archive-context"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"
import type { LibraryFilter } from "@/types/archive"

function readContext(query: string): ArchiveContext {
  const parsed = parseArchiveContext(new URLSearchParams(query))
  return { libraryId: parsed?.libraryId ?? ALL_LIBRARY_ID, filter: { sortBy: "updated", ...parsed?.filter } }
}

/** URL authority with an immediate local search draft. Native replacement is
 * synchronous, so a following push cannot leave the prior list entry stale.
 * Next's history integration updates useSearchParams without a server request. */
export function useArchiveContext(params: URLSearchParams, basePath: string) {
  const key = params.toString()
  const archivePath = `${basePath}/archive`
  const queryLocation = `${archivePath}${key ? `?${key}` : ""}`
  const liveLocation = typeof window === "undefined" ? queryLocation : window.location.pathname + window.location.search
  const liveKey = typeof window === "undefined" ? key : new URLSearchParams(window.location.search).toString()
  const canonicalUrl = buildReturnTo(basePath, readContext(key), params.get("id") ?? undefined)
  const canonicalKey = new URL(canonicalUrl, "https://archive.invalid").searchParams.toString()
  const canonicalAcknowledgements = canonicalKey !== key ? [canonicalKey] : []
  const [snapshot, setSnapshot] = useState(() => ({
    key, context: readContext(key), acknowledgements: canonicalAcknowledgements, location: canonicalUrl, external: true,
  }))
  // A matching queued query alone is not navigation identity: later external
  // history may revisit that query. Only our still-current location can ack it.
  const atOwnLocation = snapshot.location === liveLocation
  const acknowledgement = atOwnLocation ? snapshot.acknowledgements.indexOf(key) : -1
  // At that same physical location every changed subscription is an own
  // notification, including a final A acknowledgement after a retired B→A.
  const subscriptionMatchesLocation = key === liveKey && (typeof window === "undefined" || window.location.pathname === archivePath)
  const preserveDraft = atOwnLocation || !subscriptionMatchesLocation
  // A previously superseded notification can already have this key when a
  // real navigation reaches it. Compare the live location as well as the key;
  // the anticipated canonical location is our pending normalization, not a
  // second external navigation.
  const locationChanged = !atOwnLocation && subscriptionMatchesLocation && snapshot.location !== canonicalUrl
  const subscriptionChanged = snapshot.key !== key || locationChanged
  const external = subscriptionChanged ? !preserveDraft : snapshot.external
  const context = !subscriptionChanged || preserveDraft ? snapshot.context : readContext(key)
  if (subscriptionChanged) {
    setSnapshot({ key, context, external, location: external ? canonicalUrl : snapshot.location, acknowledgements: acknowledgement < 0 ? canonicalAcknowledgements : snapshot.acknowledgements.slice(acknowledgement + 1) })
  }
  // Next can batch B→A and never change its subscribed A key. Retire that
  // batch now; any delayed B notification is recognized by the live A URL.
  if (snapshot.key === key && acknowledgement >= 0 && key === liveKey) {
    setSnapshot({ ...snapshot, acknowledgements: snapshot.acknowledgements.slice(acknowledgement + 1) })
  }
  const latest = useRef({ context, key })
  const observedLocation = useRef(`${basePath}/archive${key ? `?${key}` : ""}`)
  const mounted = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; cancel() }
  }, [cancel])
  const canWrite = useCallback(() => mounted.current && window.location.pathname === archivePath, [archivePath])
  useLayoutEffect(() => { latest.current = { context, key } }, [context, key])
  useLayoutEffect(() => {
    if (external) observedLocation.current = `${basePath}/archive${key ? `?${key}` : ""}`
  }, [basePath, key, external])
  const reconcileLocation = useCallback(() => {
    if (!canWrite()) return
    const location = window.location.pathname + window.location.search
    if (location === observedLocation.current) return
    // Back/Forward is synchronous; Next's query subscription can arrive later.
    const query = new URLSearchParams(window.location.search).toString()
    const restored = readContext(query)
    observedLocation.current = location
    latest.current = { ...latest.current, context: restored }
    // Treat the eventual subscription as an acknowledgement of the context we
    // already consumed, so subsequent user edits survive that delayed render.
    setSnapshot(prev => ({ ...prev, context: restored, acknowledgements: [query], location, external: false }))
  }, [canWrite])
  const write = useCallback((ctx: ArchiveContext, id?: string) => {
    const url = buildReturnTo(basePath, ctx, id)
    if (!canWrite()) return url
    if (window.location.pathname + window.location.search !== url) {
      // Passing Next's __NA state back bypasses its subscription wrapper.
      // The wrapper preserves the router-owned history state itself.
      observedLocation.current = url
      const query = new URL(url, window.location.origin).searchParams.toString()
      setSnapshot(prev => ({ ...prev, acknowledgements: [...prev.acknowledgements, query], location: url }))
      window.history.replaceState(null, "", url)
    }
    return url
  }, [basePath, canWrite])
  useEffect(() => {
    if (!external || !canWrite() || new URLSearchParams(window.location.search).toString() !== key) return
    cancel()
    // Drop invalid/default enum parameters while retaining the preview target.
    const location = window.location.pathname + window.location.search
    if (location !== canonicalUrl) {
      observedLocation.current = canonicalUrl
      window.history.replaceState(null, "", canonicalUrl)
    }
  }, [key, canonicalUrl, external, cancel, canWrite])
  useEffect(() => cancel, [cancel])
  const change = useCallback((update: (ctx: ArchiveContext) => ArchiveContext, debounce = false) => {
    cancel()
    if (!canWrite()) return
    reconcileLocation()
    const next = update(latest.current.context)
    latest.current = { ...latest.current, context: next }
    setSnapshot(prev => ({ ...prev, context: next }))
    const location = window.location.pathname + window.location.search
    const commit = () => {
      // A traversal/route departure can precede Next's subscription render.
      if (window.location.pathname + window.location.search !== location) return
      write(next, new URLSearchParams(window.location.search).get("id") ?? undefined)
    }
    if (debounce) timer.current = setTimeout(commit, 300)
    else commit()
  }, [cancel, write, reconcileLocation, canWrite])
  const setSearch = useCallback((search: string) => change(ctx => ({ ...ctx, filter: { ...ctx.filter, search: search || undefined } }), true), [change])
  const updateFilter = useCallback((update: (filter: LibraryFilter) => LibraryFilter) => change(ctx => ({ ...ctx, filter: update(ctx.filter) })), [change])
  const setLibraryId = useCallback((libraryId: string, clear = false) => change(ctx => ({ libraryId, filter: clear ? { sortBy: "updated" } : ctx.filter })), [change])
  const flush = useCallback(() => {
    cancel()
    if (!canWrite()) return buildReturnTo(basePath, latest.current.context, new URLSearchParams(latest.current.key).get("id") ?? undefined)
    reconcileLocation()
    return write(latest.current.context, new URLSearchParams(window.location.search).get("id") ?? undefined)
  }, [basePath, cancel, write, reconcileLocation, canWrite])
  const href = useCallback((id?: string) => {
    flush()
    return buildReturnTo(basePath, latest.current.context, id)
  }, [basePath, flush])
  return { context, setSearch, updateFilter, setLibraryId, flush, href }
}
