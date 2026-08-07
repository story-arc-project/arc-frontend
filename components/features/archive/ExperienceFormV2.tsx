"use client"

import { useState, useEffect, useCallback, useId, useMemo, useRef, forwardRef, useImperativeHandle } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import TypeSelector from "./TypeSelector"
import FormSection from "./FormSection"
import ImportanceSelector from "./ImportanceSelector"
import type {
  ExperienceV2,
  ExperienceTypeId,
  ExperienceStatus,
  Block,
  BlockValue,
  RepeatableCellBlockValue,
  TemplateV2,
  ImportanceLevel,
  SectionCategory,
} from "@/types/archive"
import { SECTION_DESCRIPTION_OVERRIDES, SECTION_LABEL_OVERRIDES } from "@/types/archive"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { mergeSavedIntoTemplate } from "@/lib/utils/experience-mapper"
import {
  cloneBlocks,
  createEmptyRow,
  createGroupBlock,
  cellText,
  isBlockEmpty,
  mapRoleTags,
  removeRoleTag,
  renameRoleTag,
  roleNamesOf,
  uid,
} from "@/lib/utils/block-utils"
import { capture } from "@/lib/analytics"
import { computeFormCards, computeFormProgress } from "@/lib/utils/form-cards"
import { normalizeHiddenKeys, resolveHiddenBlocks } from "@/lib/utils/hidden-fields"
import { conditionHiddenKeys, partitionByCondition } from "@/lib/utils/conditional-fields"
import { ProjectLinkProvider, type ProjectLinkContextValue } from "@/contexts/ProjectLinkContext"
import { RoleHistoryProvider, type RoleHistoryContextValue } from "@/contexts/RoleHistoryContext"

interface ExperienceFormV2Props {
  mode: "new" | "edit"
  initialExperience?: ExperienceV2
  onSave: (experience: ExperienceV2) => void
  onCancel: () => void
  onUnsavedChange?: (hasUnsaved: boolean) => void
  /**
   * 하단 인라인 액션(초안 저장/완료/취소)을 숨긴다. 입력 뷰 셸(InputViewShell)이
   * sticky 액션 바에서 ref(handle)로 저장을 트리거할 때 사용. 기본 false라
   * 폼을 단독 마운트하는 테스트·스토리는 인라인 버튼을 그대로 유지한다.
   */
  hideInlineActions?: boolean
  onVisibleSectionsChange?: (sections: { id: string; label: string }[]) => void
  /** 고정 카드 진행도(완료 카드 수/전체) 변경 알림. 값 입력마다 갱신된다. */
  onProgressChange?: (progress: { done: number; total: number }) => void
}

/** detail 카드의 공통 기본 안내 — 유형별 문구가 없을 때만 쓴다. */
const DEFAULT_DETAIL_DESCRIPTION = "선택 입력이에요. 채울수록 분석이 정확해져요"

/**
 * 카드 안내 문구. 유형별 확정본 문구(SECTION_DESCRIPTION_OVERRIDES)가 있으면 그것을,
 * 없으면 detail 카드에 한해 공통 문구를 쓴다(FRT-177 이전 동작 유지).
 */
function sectionDescription(
  typeId: ExperienceTypeId | null,
  category: SectionCategory,
): string | undefined {
  const override = typeId ? SECTION_DESCRIPTION_OVERRIDES[typeId]?.[category] : undefined
  if (override) return override
  return category === "detail" ? DEFAULT_DETAIL_DESCRIPTION : undefined
}

/**
 * 셸(InputViewShell)이 sticky 바에서 저장을 트리거하기 위한 imperative handle.
 */
export interface ExperienceFormV2Handle {
  save: (status: ExperienceStatus) => void
}

const ExperienceFormV2 = forwardRef<ExperienceFormV2Handle, ExperienceFormV2Props>(function ExperienceFormV2({
  mode,
  initialExperience,
  onSave,
  onCancel,
  onUnsavedChange,
  hideInlineActions,
  onVisibleSectionsChange,
  onProgressChange,
}: ExperienceFormV2Props, ref) {
  const [typeId, setTypeId] = useState<ExperienceTypeId | null>(
    initialExperience?.typeId ?? null
  )
  const [template, setTemplate] = useState<TemplateV2 | null>(null)
  const [coreBlocks, setCoreBlocks] = useState<Block[]>(
    initialExperience?.coreBlocks ?? []
  )
  const [extensionSections, setExtensionSections] = useState<
    { id: string; label: string; category: SectionCategory; collapsed?: boolean; blocks: Block[] }[]
  >([])
  const [customBlocks, setCustomBlocks] = useState<Block[]>(
    initialExperience?.customBlocks ?? []
  )
  const [tags, setTags] = useState<string[]>(initialExperience?.tags ?? [])
  const tagInputId = useId()
  const [importance, setImportance] = useState<ImportanceLevel | undefined>(
    initialExperience?.importance,
  )
  const [typeError, setTypeError] = useState(false)
  const [titleError, setTitleError] = useState(false)
  /** 사용자가 숨긴 선택 필드의 안정키 (FRT-190). */
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(initialExperience?.hiddenKeys ?? [])

  /**
   * 실제로 숨김이 적용되는 키 — **이 값 하나만 쓴다**(렌더·진행도·저장·미저장 경고 전부).
   *
   * `hiddenKeys` 를 그대로 쓰면 안 된다. `resolveHiddenBlocks` 는 숨김 키라도 값이 생겼거나
   * 필수가 된 블록을 **되돌려 보여주는데**(다른 기기 편집·템플릿 개편), state 에는 그 키가 남는다.
   * 그 상태로 진행도에 넘기면 화면에 보이는 필드를 없는 셈 치고, 저장하면 다음 로드에서
   * (값이 다시 비는 순간) 조용히 사라진다. `normalizeHiddenKeys` 가 `canHideBlock` 이라는
   * 같은 잣대로 걸러 주므로, 소비처마다 판정 사본을 두지 않고 여기서 한 번만 맞춘다.
   */
  /**
   * 조건부 노출(FRT-211) 판정용 전체 블록 — 트리거가 다른 카드로 분배돼도 찾을 수 있어야 한다.
   * `computeFormCards` 가 템플릿 섹션을 4카드로 재구성하므로 카드 안 블록만 보면 트리거를 놓친다.
   */
  const allBlocksFlat = useMemo(
    () => [...coreBlocks, ...extensionSections.flatMap(s => s.blocks)],
    [coreBlocks, extensionSections]
  )

  const effectiveHiddenKeys = useMemo(
    () => normalizeHiddenKeys(allBlocksFlat, hiddenKeys),
    [allBlocksFlat, hiddenKeys]
  )

  /**
   * 조건 미충족으로 화면에서 빠진 필드의 안정키 — **진행도 계산에만** `effectiveHiddenKeys` 와
   * 합쳐 쓴다. 저장(`hiddenKeys`)에는 절대 섞지 않는다: 조건 미충족은 트리거 값에서 매번 다시
   * 계산되는 파생 상태라 영속화할 것이 없고, 저장하면 사용자가 치운 것과 구분되지 않는다.
   */
  const conditionKeys = useMemo(() => conditionHiddenKeys(allBlocksFlat), [allBlocksFlat])

  // Load template when type changes
  useEffect(() => {
    if (!typeId) return
    const tmpl = getTemplateForType(typeId)
    setTemplate(tmpl)

    if (mode === "new" || !initialExperience) {
      setCoreBlocks(cloneBlocks(tmpl.commonCore.blocks))
      // 유형을 바꾸면 숨김도 리셋한다 — 안정키(`${sectionId}.${label}`)는 유형 간에 겹치므로
      // (`basic.기간` 등) 그대로 두면 새 유형에서 사용자가 숨긴 적 없는 필드가 사라진다.
      // 블록을 템플릿으로 되돌리는 이 자리에 함께 둬야 둘이 어긋나지 않는다.
      setHiddenKeys([])
      setExtensionSections(
        tmpl.extensions.map(ext => ({
          id: ext.id,
          label: ext.label,
          category: ext.category,
          collapsed: ext.collapsed,
          blocks: cloneBlocks(ext.blocks),
        }))
      )
    } else {
      // Edit mode: keep existing data, use template for structure reference.
      // 레거시/부분 레코드는 coreBlocks 에 "경험명"이 없어 헤더 입력이 렌더되지 않는다
      // (제목 수정·복구 불가). 템플릿의 경험명 블록을 기존 title 로 채워 항상 편집 가능하게 한다.
      setCoreBlocks(prev => {
        const base = prev.length === 0 ? initialExperience.coreBlocks : prev
        if (base.some(b => b.label === "경험명")) return base
        const titleTemplate = tmpl.commonCore.blocks.find(b => b.label === "경험명")
        if (!titleTemplate) return base
        const [seeded] = cloneBlocks([titleTemplate])
        seeded.value = { type: "text", text: initialExperience.title ?? "" }
        return [seeded, ...base]
      })
      if (extensionSections.length === 0) {
        const savedBlocks = initialExperience.extensionBlocks
        // Distribute saved extension blocks across template sections.
        // schema v2: 안정키로 매칭(라벨 충돌 무관). 키 없는 레거시 블록만 라벨 폴백.
        //
        // ⚠️ 매칭분으로 섹션을 **교체하지 않고 템플릿에 병합**한다(FRT-211, Codex P1).
        // v2 레코드는 toExperienceV2 가 현재 템플릿 전체를 재구성해 내려주므로 교체든 병합이든
        // 결과가 같지만, v1 레거시 레코드(저장된 블록 배열 그대로 — 데모 시드가 이 모양)는
        // 살아남은 라벨만 들어 있어 교체하면 **나머지 새 필드가 화면에서 통째로 사라진다**.
        // 수상경력은 확정본 개편으로 구 라벨 중 '수상일' 하나만 살아남아, 그 한 칸 때문에
        // 필수 5개를 채울 방법이 없어져 완료 저장이 영구 차단됐다.
        // 매칭된 블록은 **정의는 템플릿, 값은 저장분**으로 병합한다(mergeSavedIntoTemplate).
        // 통째로 쓰면 구 템플릿의 required·guide 가 따라와 필수 표시가 사라진다(Codex P2).
        const savedByKey = new Map<string, Block>()
        const savedByLabel = new Map<string, Block>()
        for (const b of savedBlocks) {
          if (b.key) savedByKey.set(b.key, b)
          else if (!savedByLabel.has(b.label)) savedByLabel.set(b.label, b)
        }
        setExtensionSections(
          tmpl.extensions.map(ext => ({
            id: ext.id,
            label: ext.label,
            category: ext.category,
            collapsed: ext.collapsed,
            blocks: ext.blocks.map(tb => {
              const saved = (tb.key ? savedByKey.get(tb.key) : undefined) ?? savedByLabel.get(tb.label)
              const [tplBlock] = cloneBlocks([tb])
              return saved ? mergeSavedIntoTemplate(tplBlock, saved) : tplBlock
            }),
          }))
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId])

  // Snapshot of the loaded form state, captured once after the template loads
  // and "경험명" materializes (edit mode only). Dirty is judged against this
  // baseline so opening an existing experience without editing isn't flagged.
  const dirtyBaselineRef = useRef<string | null>(null)

  // Track dirty state
  useEffect(() => {
    const hasBlockData = (blocks: Block[]) => blocks.some(b => !isBlockEmpty(b))

    // New mode (or no initial record): any entered data counts as unsaved.
    if (mode === "new" || !initialExperience) {
      const extensionBlocks = extensionSections.flatMap(s => s.blocks)
      const importanceChanged = importance !== initialExperience?.importance
      const hasData =
        hasBlockData(coreBlocks) ||
        hasBlockData(extensionBlocks) ||
        customBlocks.length > 0 ||
        tags.length > 0 ||
        effectiveHiddenKeys.length > 0 ||
        importanceChanged
      onUnsavedChange?.(hasData)
      return
    }

    // Edit mode: an existing record is loaded with data, so "has data" can't mean
    // "dirty". Compare the current form state against the loaded baseline instead.
    // Wait until the template loads (and the load effect materializes blocks) so
    // the baseline reflects the settled, post-materialization state.
    if (!template) return
    const snapshot = JSON.stringify({
      core: coreBlocks,
      ext: extensionSections.map(s => s.blocks),
      custom: customBlocks,
      tags,
      importance: importance ?? null,
      // 숨김만 바꾸고 나가도 미저장 경고가 떠야 한다 — 빠뜨리면 숨김이 조용히 사라진다.
      // 저장 payload 와 같은 값(정규화된 키)을 봐야 "저장했는데 계속 dirty" 가 안 생긴다.
      hidden: effectiveHiddenKeys,
    })
    if (dirtyBaselineRef.current === null) {
      dirtyBaselineRef.current = snapshot
      onUnsavedChange?.(false)
      return
    }
    onUnsavedChange?.(snapshot !== dirtyBaselineRef.current)
  }, [coreBlocks, extensionSections, customBlocks, tags, importance, effectiveHiddenKeys, mode, template, initialExperience, onUnsavedChange])

  const handleTypeSelect = useCallback((id: ExperienceTypeId) => {
    setTypeId(id)
    setTypeError(false)
    // TypeSelector 는 edit 모드에서 disabled 이므로 이 콜백은 새 기록 작성 흐름에서만 도달한다.
    // 유형 선택 후 저장까지 못 간 drop-off 를 보기 위한 직전 선택 이벤트(FRT-19).
    capture("archive_type_selected", { experience_type: id })
  }, [])

  const handleRequestTypeChange = useCallback((): boolean => {
    const hasBlockData = (blocks: Block[]) => blocks.some(b => !isBlockEmpty(b))
    const extensionBlocks = extensionSections.flatMap(s => s.blocks)
    const hasData =
      hasBlockData(coreBlocks) ||
      hasBlockData(extensionBlocks) ||
      customBlocks.length > 0 ||
      tags.length > 0 ||
      // 숨김도 사용자가 한 작업이다 — 유형을 바꾸면 초기화되므로(안정키가 유형 간에 겹쳐
      // 그대로 두면 숨긴 적 없는 필드가 사라진다) 확인 없이 버리면 안 된다. 미저장 판정
      // (`effectiveHiddenKeys.length > 0`)과 기준이 갈리면 "경고는 뜨는데 확인은 안 뜨는" 상태가 된다.
      effectiveHiddenKeys.length > 0
    if (!hasData) return true
    return window.confirm("경험 유형을 바꾸면 입력한 내용이 초기화될 수 있어요. 계속할까요?")
  }, [coreBlocks, extensionSections, customBlocks, tags, effectiveHiddenKeys])

  // ── 선택 필드 숨김 (FRT-190) ──────────────────────────────────────
  // 안정키만 담는다 — 블록 인스턴스를 담으면 값이 바뀔 때마다 stale 참조가 된다.
  const handleHideBlock = useCallback((block: Block) => {
    const key = block.key
    if (!key) return
    setHiddenKeys(prev => (prev.includes(key) ? prev : [...prev, key]))
  }, [])

  const handleUnhideBlock = useCallback((block: Block) => {
    const key = block.key
    if (!key) return
    setHiddenKeys(prev => prev.filter(k => k !== key))
  }, [])

  // ── Computed form cards ──────────────────────────────────────────
  const formCards = useMemo(
    () =>
      template
        ? computeFormCards(
            coreBlocks,
            extensionSections,
            typeId ? SECTION_LABEL_OVERRIDES[typeId] : undefined,
          )
        : null,
    [template, coreBlocks, extensionSections, typeId]
  )

  // 카드 onChange가 돌려준 블록들을 id로 core/extension state에 되쓴다. block id는
  // uid()로 전역 고유하므로 core와 extension 간 충돌이 없고, updated에 없는 블록(dedup으로
  // 숨겨진 블록)은 `?? b` 폴백으로 state에 그대로 보존된다.
  // ── Universal write-back: routes updated blocks to coreBlocks / extensionSections by id ──
  function writeBackBlocks(updated: Block[]) {
    const map = new Map(updated.map(b => [b.id, b]))
    setCoreBlocks(prev => prev.map(b => map.get(b.id) ?? b))
    setExtensionSections(prev =>
      prev.map(s => ({ ...s, blocks: s.blocks.map(b => map.get(b.id) ?? b) }))
    )
  }

  // ── FRT-76: '프로젝트로 연결' 교차-섹션 배선 (ProjectLinkContext provider) ──
  // OutcomeList 활동 행이 다른 섹션(프로젝트 기록)에 프로젝트 행을 만들고/조회/스크롤한다.
  // extensionSections 가 형제 state 라 writeBackBlocks 와 같은 방식으로 대상 섹션만 갱신한다.
  const findProjectBlock = useCallback(
    (targetSectionId: string): { block: Block; value: RepeatableCellBlockValue } | null => {
      const section = extensionSections.find(s => s.id === targetSectionId)
      const block = section?.blocks.find(b => b.value.type === "repeatable-cell")
      if (!block) return null
      return { block, value: block.value as RepeatableCellBlockValue }
    },
    [extensionSections],
  )

  /**
   * 역방향 인덱스 `대상 행 id → 소스 OutcomeList 블록 라벨` (FRT-210).
   *
   * 링크의 진실은 소스 행의 `linkedProjectRowId` 한쪽에만 있어(대상 행엔 아무 표시도 없다)
   * "나를 가리키는 행이 있는가"는 훑어야만 알 수 있다. 훑기를 **폼에서 한 번만** 하고 각 행은
   * Map 조회만 하게 한다 — 행마다 훑으면 O(행 수 × 블록 수)가 된다.
   * `allBlocksFlat` 은 조건부 노출·숨김 정규화가 이미 쓰는 같은 목록이라 새 비용이 아니다.
   */
  const incomingProjectLinks = useMemo(() => {
    const map = new Map<string, string>()
    for (const block of allBlocksFlat) {
      if (block.variant !== "outcome-list" || block.value.type !== "repeatable-cell") continue
      for (const row of block.value.rows) {
        if (row.linkedProjectRowId) map.set(row.linkedProjectRowId, block.label)
      }
    }
    return map
  }, [allBlocksFlat])

  const projectLink = useMemo<ProjectLinkContextValue>(() => ({
    createProjectRow(targetSectionId, titleColumnKey, text) {
      const found = findProjectBlock(targetSectionId)
      if (!found) return null
      // 대상 표에서 제목 컬럼이 사라졌으면(사용자가 열 삭제) 링크하지 않는다 — 보이지 않는
      // 셀에 제목만 써 넣어 활동 행은 '연결됨'인데 프로젝트 제목은 안 보이는 상태를 막는다.
      if (!found.value.columns.some(c => c.key === titleColumnKey)) return null
      // row 를 먼저 생성해 id 를 동기 반환한다(setState 콜백 안에서 만들면 반환 불가).
      const row = createEmptyRow(found.value.columns)
      row.cells[titleColumnKey] = text
      setExtensionSections(prev =>
        prev.map(s =>
          s.id !== targetSectionId
            ? s
            : {
                ...s,
                collapsed: false, // 연결하면 대상 섹션을 펼쳐 새 프로젝트가 보이게 한다.
                blocks: s.blocks.map(b =>
                  b.id === found.block.id
                    ? {
                        ...b,
                        value: {
                          ...(b.value as RepeatableCellBlockValue),
                          rows: [...(b.value as RepeatableCellBlockValue).rows, row],
                        },
                      }
                    : b,
                ),
              },
        ),
      )
      return row.id
    },
    getProjectRow(targetSectionId, titleColumnKey, projectRowId) {
      const found = findProjectBlock(targetSectionId)
      const row = found?.value.rows.find(r => r.id === projectRowId)
      if (!row) return null
      // 쓰기와 같은 컬럼에서 읽는다(첫 컬럼이 아니라) — createProjectRow 와 대칭.
      const title = cellText(row.cells[titleColumnKey])
      return { title }
    },
    getIncomingLink(rowId) {
      const sourceLabel = incomingProjectLinks.get(rowId)
      return sourceLabel ? { sourceLabel } : null
    },
    scrollToProjectRow(projectRowId) {
      if (typeof document === "undefined") return
      // 새 행 DOM 이 커밋된 뒤로 미룬다(생성 직후 호출되므로).
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-row-id="${projectRowId}"]`)
        el?.scrollIntoView?.({ behavior: "smooth", block: "center" })
      })
    },
  }), [findProjectBlock, incomingProjectLinks])

  // ── FRT-178: 역할 이력 → 역할 태그 파생·동기화 (RoleHistoryContext provider) ──
  // 태그 선택지가 상수가 아니라 형제 블록('역할 이력')의 값에서 나온다. 블록은 형제를 모르므로
  // 폼이 목록을 공급하고, 이름 변경·삭제는 폼이 전 블록에 전파한다(태그는 이름으로 저장된다).
  const roles = useMemo(() => {
    for (const section of extensionSections) {
      const block = section.blocks.find(b => b.variant === "role-history")
      if (block) return roleNamesOf(block)
    }
    return []
  }, [extensionSections])

  const applyRoleTags = useCallback((fn: (tags: string[]) => string[]) => {
    setCoreBlocks(prev => prev.map(b => mapRoleTags(b, fn)))
    setExtensionSections(prev =>
      prev.map(s => ({ ...s, blocks: s.blocks.map(b => mapRoleTags(b, fn)) })),
    )
    setCustomBlocks(prev => prev.map(b => mapRoleTags(b, fn)))
  }, [])

  const roleHistory = useMemo<RoleHistoryContextValue>(() => ({
    roles,
    renameRole: (from, to) => applyRoleTags(renameRoleTag(from, to)),
    removeRole: name => applyRoleTags(removeRoleTag(name)),
  }), [roles, applyRoleTags])

  // ── Header input handler (경험명 / 한 줄 요약 only) ──────────────
  function handleCoreBlockChange(blockId: string, value: BlockValue) {
    setCoreBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, value } : b))
    )
  }

  // ── 사용자 섹션(FRT-78) — customBlocks 의 group 블록 = 최상위 섹션 ──
  const userSections = useMemo(() => customBlocks.filter(b => b.type === "group"), [customBlocks])
  const looseCustomBlocks = useMemo(() => customBlocks.filter(b => b.type !== "group"), [customBlocks])

  const handleSectionBlocksChange = useCallback((sectionId: string, blocks: Block[]) => {
    setCustomBlocks(prev => prev.map(b => (b.id === sectionId ? { ...b, children: blocks } : b)))
  }, [])
  const handleSectionLabelChange = useCallback((sectionId: string, label: string) => {
    setCustomBlocks(prev => prev.map(b => (b.id === sectionId ? { ...b, label } : b)))
  }, [])
  const handleSectionDelete = useCallback((sectionId: string) => {
    setCustomBlocks(prev => prev.filter(b => b.id !== sectionId))
  }, [])
  const handleAddSection = useCallback(() => {
    setCustomBlocks(prev => [...prev, createGroupBlock("새 블록")])
  }, [])
  // 최상위 사용자 섹션 정렬. customBlocks 순서가 좌측 네비·상세 카드 순서를 결정하므로
  // group 블록만 추려 위치를 바꾸고(loose 는 항상 뒤로 정규화) 되쓴다.
  const handleMoveSection = useCallback((sectionId: string, dir: -1 | 1) => {
    setCustomBlocks(prev => {
      const groups = prev.filter(b => b.type === "group")
      const loose = prev.filter(b => b.type !== "group")
      const idx = groups.findIndex(b => b.id === sectionId)
      const target = idx + dir
      if (idx === -1 || target < 0 || target >= groups.length) return prev
      const next = [...groups]
      const [moved] = next.splice(idx, 1)
      next.splice(target, 0, moved)
      return [...next, ...loose]
    })
  }, [])
  // 레거시 loose 필드: group 섹션은 위치 유지, loose 묶음만 교체(추가 불가, 편집·삭제만).
  const handleLooseChange = useCallback((updated: Block[]) => {
    setCustomBlocks(prev => [...prev.filter(b => b.type === "group"), ...updated])
  }, [])

  function handleSave(status: ExperienceStatus) {
    if (!typeId || !template) {
      setTypeError(true)
      return
    }

    // Extract title from first core text block. 편집 모드에서는 로드 시 "경험명"
    // 블록을 항상 materialize 하므로(아래 useEffect), 모든 레코드에서 이 블록이 존재한다.
    const titleBlock = coreBlocks.find(b => b.label === "경험명")
    const titleVal = titleBlock?.value
    const title = titleVal && titleVal.type === "text" ? titleVal.text : ""

    // 초안·완료 모두 경험명은 필수다(빈 제목 저장 → "(제목 없음)"·분석 품질 저하 방지).
    if (!title.trim()) {
      setTitleError(true)
      return
    }
    setTitleError(false)

    // Extract summary
    const summaryBlock = coreBlocks.find(b => b.label === "한 줄 요약")
    const summaryVal = summaryBlock?.value
    const summary = summaryVal && summaryVal.type === "text" ? summaryVal.text : ""

    // Flatten extension blocks
    const allExtensionBlocks = extensionSections.flatMap(s => s.blocks)

    const now = new Date().toISOString()
    const experience: ExperienceV2 = {
      id: initialExperience?.id ?? uid("exp"),
      userId: initialExperience?.userId ?? "",
      typeId,
      title,
      summary,
      status,
      tags,
      importance,
      coreBlocks,
      extensionBlocks: allExtensionBlocks,
      customBlocks,
      hiddenKeys: effectiveHiddenKeys,
      createdAt: initialExperience?.createdAt ?? now,
      updatedAt: now,
    }

    onSave(experience)
  }

  // 셸이 sticky 바 버튼에서 호출하는 저장 트리거를 노출한다. deps 배열을 생략해
  // 매 렌더마다 최신 handleSave(최신 state 클로저)를 바인딩한다 — 스테일 클로저 방지.
  useImperativeHandle(ref, () => ({ save: handleSave }))

  // ── Visible sections callback (고정 4카드 + 사용자 섹션) ──────────────────────────────────────
  // 앵커 라벨은 카드 라벨(오버라이드 반영)과 동일 소스를 쓴다 → 앵커=카드헤더 일치.
  const fixedSections = useMemo(
    () => (formCards?.cards ?? []).map(c => ({ id: c.category as string, label: c.label })),
    [formCards]
  )
  const allNavSections = useMemo(
    () => [...fixedSections, ...userSections.map(s => ({ id: s.id, label: s.label || "새 블록" }))],
    [fixedSections, userSections]
  )
  const visibleKey = allNavSections.map(s => `${s.id}:${s.label}`).join(",")
  const onVisibleSectionsChangeRef = useRef(onVisibleSectionsChange)
  useEffect(() => {
    onVisibleSectionsChangeRef.current = onVisibleSectionsChange
  })
  useEffect(() => {
    const emit = onVisibleSectionsChangeRef.current
    if (!emit) return
    emit(template ? allNavSections : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emit read from ref; depend only on visibleKey/template
  }, [visibleKey, template])

  // ── Progress callback (고정 카드 완료 수/전체) ──────────────────────────────────────
  // onVisibleSectionsChange 는 구조(섹션 목록)만 emit 하므로, 값 입력마다 갱신되는
  // 진행도는 별도 채널로 흘린다. formCards 는 블록 값 변화에 따라 재계산된다.
  // 숨긴 항목은 진행도에서도 빠져야 한다 — 안 빼면 "해당 없음"으로 치울수록 바가 안 차고,
  // 되돌려서 자기와 무관한 항목을 채워야만 100% 가 되는 모순이 난다(FRT-190).
  // 조건 미충족으로 화면에 없는 필드도 같은 이유로 빠진다 — 보이지도 않는 칸 때문에 필수 없는
  // 카드가 영원히 미완료로 남는다(FRT-211).
  const progress = useMemo(
    () => computeFormProgress(formCards?.cards ?? [], [...effectiveHiddenKeys, ...conditionKeys]),
    [formCards, effectiveHiddenKeys, conditionKeys]
  )
  const onProgressChangeRef = useRef(onProgressChange)
  useEffect(() => {
    onProgressChangeRef.current = onProgressChange
  })
  useEffect(() => {
    const emit = onProgressChangeRef.current
    if (!emit) return
    emit(template ? progress : { done: 0, total: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emit read from ref; depend only on progress/template
  }, [progress.done, progress.total, template])

  const titleValue = formCards?.titleBlock?.value
  const titleText = titleValue?.type === "text" ? titleValue.text : ""
  const summaryValue = formCards?.summaryBlock?.value
  const summaryText = summaryValue?.type === "text" ? summaryValue.text : ""

  return (
    <div className="max-w-[640px] mx-auto px-5 py-6 md:px-12 md:py-10">
      {/* Header — inline editable title + summary */}
      <div className="flex items-start justify-between mb-7 gap-4">
        <div className="flex-1 min-w-0">
          {template && formCards?.titleBlock && titleValue?.type === "text" ? (
            <input
              type="text"
              className="w-full text-heading-3 text-text-primary bg-transparent border-0 p-0 focus:outline-none placeholder:text-text-tertiary"
              placeholder={formCards.titleBlock.placeholder ?? (mode === "new" ? "새 경험 추가" : "경험명")}
              value={titleText}
              aria-label="경험명"
              aria-invalid={titleError}
              onChange={e => {
                if (titleError) setTitleError(false)
                handleCoreBlockChange(formCards.titleBlock!.id, {
                  type: "text",
                  text: e.target.value,
                })
              }}
            />
          ) : (
            <h2 className="text-heading-3 text-text-primary">
              {mode === "new" ? "새 경험 추가" : "경험 수정"}
            </h2>
          )}

          {titleError && (
            <p className="text-body-sm text-error mt-1" role="alert">
              경험명을 입력해주세요.
            </p>
          )}

          {template && formCards?.summaryBlock && summaryValue?.type === "text" ? (
            <input
              type="text"
              className="w-full mt-1 text-body text-text-secondary bg-transparent border-0 p-0 focus:outline-none placeholder:text-text-tertiary"
              placeholder={formCards.summaryBlock.placeholder ?? "한 줄 요약"}
              value={summaryText}
              aria-label="한 줄 요약"
              onChange={e =>
                handleCoreBlockChange(formCards.summaryBlock!.id, {
                  type: "text",
                  text: e.target.value,
                })
              }
            />
          ) : (
            <p className="text-body-sm text-text-tertiary mt-1">
              유형을 선택하고 내용을 기록해주세요
            </p>
          )}

          <div className="mt-3">
            <ImportanceSelector
              value={importance}
              onChange={setImportance}
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Type selector */}
      <TypeSelector
        selectedId={typeId}
        onSelect={handleTypeSelect}
        disabled={mode === "edit"}
        onRequestChange={handleRequestTypeChange}
      />
      {typeError && (
        <p className="text-body-sm text-error -mt-4 mb-4" role="alert">
          경험 유형을 선택해주세요.
        </p>
      )}

      {/* Form sections — 4-card layout */}
      {template && formCards && (
        <ProjectLinkProvider value={projectLink}>
        <RoleHistoryProvider value={roleHistory}>
        <div className="flex flex-col gap-5 archive-input-14">
          {formCards.cards.map(card => {
            // 숨김은 카드 모델이 아니라 이 렌더 층에서 가른다 — 카드 자체와 하단 되살리기
            // 토글은 남겨야 마지막 필드를 숨겨도 되돌릴 길이 사라지지 않는다.
            //
            // 조건부 노출(FRT-211)을 **먼저** 거른다. 두 필터는 층이 다르다 — 조건 미충족은
            // `hidden`(되살리기 토글 목록)으로 넘기지 않는다. 사용자가 치운 적이 없으니 되살릴
            // 것도 없고, 목록에 뜨면 자기가 하지 않은 일을 되돌리라는 버튼이 생긴다.
            // 걸러진 블록의 값은 `writeBackBlocks` 가 id 기준으로 병합하므로 state 에 그대로 남는다.
            const { visible: shown } = partitionByCondition(card.blocks, allBlocksFlat)
            const { visible, hidden } = resolveHiddenBlocks(shown, effectiveHiddenKeys)
            return (
              <FormSection
                key={card.category}
                variant="card"
                sectionId={card.category}
                label={card.label}
                blocks={visible}
                hiddenBlocks={hidden}
                onHide={handleHideBlock}
                onUnhide={handleUnhideBlock}
                optional={card.optional}
                description={sectionDescription(typeId, card.category)}
                onChange={writeBackBlocks}
              />
            )
          })}

          {/* 사용자 섹션 (FRT-78) — 최상위 블록, 고정 카드와 동일 시각. 헤더 위/아래로 카드 정렬. */}
          {userSections.map((section, i) => (
            <FormSection
              key={section.id}
              variant="card"
              sectionId={section.id}
              label={section.label}
              blocks={section.children ?? []}
              editableLabel
              onLabelChange={label => handleSectionLabelChange(section.id, label)}
              onDelete={() => handleSectionDelete(section.id)}
              onMoveUp={i > 0 ? () => handleMoveSection(section.id, -1) : undefined}
              onMoveDown={i < userSections.length - 1 ? () => handleMoveSection(section.id, 1) : undefined}
              allowAdd
              allowReorder
              allowDelete
              onChange={blocks => handleSectionBlocksChange(section.id, blocks)}
            />
          ))}

          {/* 레거시 loose 커스텀 필드 폴백 — 새 추가는 막고 편집·정렬·삭제는 유지 */}
          {looseCustomBlocks.length > 0 && (
            <FormSection
              variant="card"
              label="기타"
              blocks={looseCustomBlocks}
              allowReorder
              allowDelete
              allowEdit
              onChange={handleLooseChange}
            />
          )}

          {/* 블록 추가 — 최상위 사용자 섹션 생성 */}
          <button
            type="button"
            onClick={handleAddSection}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-border px-5 py-4 text-body-sm text-text-secondary hover:text-text-primary hover:border-brand transition-colors"
          >
            <Plus size={16} />
            블록 추가
          </button>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={tagInputId} className="text-field-label text-text-primary">태그</label>
            <TagInput inputId={tagInputId} tags={tags} onChange={setTags} />
          </div>

          {/* Action buttons — 입력 뷰 셸에서는 sticky 바로 이관되어 숨겨진다(hideInlineActions). */}
          {!hideInlineActions && (
            <div className="flex gap-2 pt-6 border-t border-border">
              <Button variant="secondary" size="md" onClick={() => handleSave("draft")}>
                초안 저장
              </Button>
              <Button variant="primary" size="md" onClick={() => handleSave("complete")}>
                완료
              </Button>
              <Button variant="ghost" size="md" onClick={onCancel} className="ml-auto">
                취소
              </Button>
            </div>
          )}
        </div>
        </RoleHistoryProvider>
        </ProjectLinkProvider>
      )}
    </div>
  )
})

ExperienceFormV2.displayName = "ExperienceFormV2"

export default ExperienceFormV2

// ── Inline tag input ──────────────────────────────────────────────────────
function TagInput({ inputId, tags, onChange }: { inputId?: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("")

  function add() {
    const t = input.trim()
    if (!t || tags.includes(t)) return
    onChange([...tags, t])
    setInput("")
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-surface-brand text-brand-dark rounded-full pl-2.5 pr-1.5 py-0.5 text-caption font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter(t => t !== tag))}
              className="rounded-full p-0.5 hover:bg-brand-light transition-colors text-brand-dark"
              aria-label={`${tag} 삭제`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder="태그 입력 후 Enter"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        />
      </div>
    </div>
  )
}
