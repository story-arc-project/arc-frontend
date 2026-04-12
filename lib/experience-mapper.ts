import type { Experience, ExperienceSavePayload } from "@/types/experience"
import type { ExperienceV2, ExperienceTypeId, ExperienceStatus, Block } from "@/types/archive"

/**
 * API Experience → 프론트엔드 ExperienceV2 변환
 *
 * API의 content 필드에 블록 데이터가 JSON으로 저장되어 있다고 가정.
 */
export function toExperienceV2(exp: Experience): ExperienceV2 {
  const content = (exp.content ?? {}) as {
    title?: string
    summary?: string
    status?: ExperienceStatus
    tags?: string[]
    coreBlocks?: Block[]
    extensionBlocks?: Block[]
    customBlocks?: Block[]
  }

  return {
    id: exp.id,
    userId: exp.user_id,
    typeId: exp.type as ExperienceTypeId,
    title: content.title ?? "",
    summary: content.summary ?? "",
    status: content.status ?? "draft",
    tags: content.tags ?? [],
    coreBlocks: content.coreBlocks ?? [],
    extensionBlocks: content.extensionBlocks ?? [],
    customBlocks: content.customBlocks ?? [],
    createdAt: exp.created_at,
    updatedAt: exp.updated_at,
  }
}

/**
 * 프론트엔드 ExperienceV2 → API 저장 payload 변환
 */
export function toSavePayload(exp: ExperienceV2): ExperienceSavePayload {
  return {
    type: exp.typeId,
    content: {
      title: exp.title,
      summary: exp.summary,
      status: exp.status,
      tags: exp.tags,
      coreBlocks: exp.coreBlocks,
      extensionBlocks: exp.extensionBlocks,
      customBlocks: exp.customBlocks,
    },
  }
}
