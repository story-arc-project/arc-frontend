import type {
  Experience,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
} from "@/types/experience"
import type {
  ExperienceV2,
  ExperienceTypeId,
  ExperienceStatus,
  Block,
  ImportanceLevel,
} from "@/types/archive"
import { isImportanceLevel } from "@/types/archive"

/**
 * API Experience → 프론트엔드 ExperienceV2 변환
 *
 * API의 content 필드에 블록 데이터가 JSON으로 저장되어 있다고 가정.
 * importance 는 최상위 컬럼이므로 content 밖에서 읽는다.
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
    importance: isImportanceLevel(exp.importance) ? exp.importance : undefined,
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
    importance: exp.importance ?? null,
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

/**
 * 중요도 인라인 변경용 경량 업데이트 payload.
 * content 를 포함하지 않고 importance 필드만 전송한다.
 */
export function toUpdateImportancePayload(
  value: ImportanceLevel | undefined,
): ExperienceUpdatePayload {
  return {
    importance: value ?? null,
  }
}
