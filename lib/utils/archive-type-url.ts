import { ALL_EXPERIENCE_TYPES, EXPERIENCE_TYPES, canonicalTypeId } from "@/lib/constants/templates-v2"
import type { ExperienceTypeId } from "@/types/archive"

/** New forms accept only selectable registry types (plus aliases for those types). */
export function parseNewExperienceType(params: Pick<URLSearchParams, "getAll">): ExperienceTypeId | null {
  const values = params.getAll("type")
  if (values.length !== 1) return null
  const known = ALL_EXPERIENCE_TYPES.find(type => type.id === values[0])
  if (!known) return null
  const canonical = canonicalTypeId(known.id)
  return EXPERIENCE_TYPES.some(type => type.id === canonical) ? canonical : null
}

export function withExperienceType(url: URL, type: ExperienceTypeId | null): string {
  const params = new URLSearchParams(url.search)
  params.delete("type")
  if (type) params.set("type", type)
  const query = params.toString()
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`
}
