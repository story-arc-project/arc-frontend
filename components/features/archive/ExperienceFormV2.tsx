"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { BookOpen, Save, Settings, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import TypeSelector from "./TypeSelector"
import FormSection from "./FormSection"
import BlockList from "./blocks/BlockList"
import SavePresetModal from "./SavePresetModal"
import ApplyPresetModal from "./ApplyPresetModal"
import PresetManager from "./PresetManager"
import ImportanceSelector from "./ImportanceSelector"
import type {
  ExperienceV2,
  ExperienceTypeId,
  ExperienceStatus,
  Block,
  BlockValue,
  TemplateV2,
  ImportanceLevel,
} from "@/types/archive"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks, uid } from "@/lib/utils/block-utils"
import type { UsePresetsReturn } from "@/hooks/usePresets"

interface AppliedPreset {
  groupId: string
  name: string
  blocks: Block[]
}

interface ExperienceFormV2Props {
  mode: "new" | "edit"
  initialExperience?: ExperienceV2
  presetsHook: UsePresetsReturn
  onSave: (experience: ExperienceV2) => void
  onCancel: () => void
  onUnsavedChange?: (hasUnsaved: boolean) => void
}

// Semantic groups: labels within the same group are treated as asking the same question.
// Used to hide duplicate fields across core, type-specific extensions, and the shared
// "확장 입력" section so users don't answer the same thing twice.
const SEMANTIC_GROUPS: Record<string, string[]> = {
  period: [
    "기간", "재직기간", "읽은 기간/완독일", "제작 기간", "준비 기간", "학습 기간",
  ],
  role: [
    "내 역할/기여도", "내 역할/기여", "내 역할", "내가 맡은 파트", "직책/역할", "역할/직책", "역할",
  ],
  achievement: [
    "핵심 성과", "핵심 성과 기록", "결과/성과", "성과", "성과/산출물", "반응/성과", "변화/성과", "임팩트/변화",
  ],
  team: [
    "협업/팀", "팀/조직", "팀 구성", "협업 방식", "협업/커뮤니케이션 방식",
  ],
  motivation: [
    "지원 동기", "참여 동기", "읽은 이유", "목표/만들고 싶었던 이유",
  ],
  evidence: [
    "증빙 자료", "증빙", "활동 인증서", "활동 인증서/수료 증빙", "수상 증빙", "자격증 증빙", "봉사 확인서", "꾸준함 증거",
  ],
  lesson: [
    "배운 점", "느낀 점/가치관 변화",
  ],
}

function getSemanticGroup(label: string): string | null {
  for (const [key, labels] of Object.entries(SEMANTIC_GROUPS)) {
    if (labels.includes(label)) return key
  }
  return null
}

function hasEquivalentIn(label: string, otherLabels: Set<string>): boolean {
  if (otherLabels.has(label)) return true
  const group = getSemanticGroup(label)
  if (!group) return false
  return SEMANTIC_GROUPS[group].some(eq => otherLabels.has(eq))
}

function isBlockEmpty(block: Block): boolean {
  const v = block.value
  if (v.type === "text" || v.type === "textarea") return v.text.trim() === ""
  if (v.type === "checklist") return v.checked.length === 0
  if (v.type === "single-select") return v.selected === ""
  if (v.type === "date") return v.date === ""
  if (v.type === "period") return v.start === "" && v.end === ""
  if (v.type === "tags") return v.tags.length === 0
  if (v.type === "link") return v.url.trim() === ""
  if (v.type === "file") return v.fileName.trim() === ""
  if (v.type === "repeatable-cell") return v.rows.length === 0
  if (v.type === "table") return v.rows.length === 0
  return true
}

export default function ExperienceFormV2({
  mode,
  initialExperience,
  presetsHook,
  onSave,
  onCancel,
  onUnsavedChange,
}: ExperienceFormV2Props) {
  const [typeId, setTypeId] = useState<ExperienceTypeId | null>(
    initialExperience?.typeId ?? null
  )
  const [template, setTemplate] = useState<TemplateV2 | null>(null)
  const [coreBlocks, setCoreBlocks] = useState<Block[]>(
    initialExperience?.coreBlocks ?? []
  )
  const [extensionSections, setExtensionSections] = useState<
    { id: string; label: string; collapsed?: boolean; blocks: Block[] }[]
  >([])
  const [customBlocks, setCustomBlocks] = useState<Block[]>(
    initialExperience?.customBlocks ?? []
  )
  const [appliedPresets, setAppliedPresets] = useState<AppliedPreset[]>([])
  const [tags, setTags] = useState<string[]>(initialExperience?.tags ?? [])
  const [importance, setImportance] = useState<ImportanceLevel | undefined>(
    initialExperience?.importance,
  )
  const [typeError, setTypeError] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [applyPresetOpen, setApplyPresetOpen] = useState(false)
  const [managePresetOpen, setManagePresetOpen] = useState(false)
  const { presets, createPreset, updatePreset, deletePreset, duplicatePreset, getPreset } = presetsHook

  // Load template when type changes
  useEffect(() => {
    if (!typeId) return
    const tmpl = getTemplateForType(typeId)
    setTemplate(tmpl)

    if (mode === "new" || !initialExperience) {
      setCoreBlocks(cloneBlocks(tmpl.commonCore.blocks))
      setExtensionSections(
        tmpl.extensions.map(ext => ({
          id: ext.id,
          label: ext.label,
          collapsed: ext.collapsed,
          blocks: cloneBlocks(ext.blocks),
        }))
      )
    } else {
      // Edit mode: keep existing data, use template for structure reference
      if (coreBlocks.length === 0) {
        setCoreBlocks(initialExperience.coreBlocks)
      }
      if (extensionSections.length === 0) {
        const savedBlocks = initialExperience.extensionBlocks
        // Distribute saved extension blocks across template sections by matching labels
        setExtensionSections(
          tmpl.extensions.map(ext => {
            const templateLabels = new Set(ext.blocks.map(b => b.label))
            const matchedBlocks = savedBlocks.filter(b => templateLabels.has(b.label))
            return {
              id: ext.id,
              label: ext.label,
              collapsed: ext.collapsed,
              blocks: matchedBlocks.length > 0
                ? matchedBlocks
                : cloneBlocks(ext.blocks),
            }
          })
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId])

  // Track dirty state
  useEffect(() => {
    const hasBlockData = (blocks: Block[]) => blocks.some(b => !isBlockEmpty(b))
    const extensionBlocks = extensionSections.flatMap(s => s.blocks)
    const presetBlocks = appliedPresets.flatMap(p => p.blocks)
    const importanceChanged = importance !== initialExperience?.importance
    const hasData =
      hasBlockData(coreBlocks) ||
      hasBlockData(extensionBlocks) ||
      customBlocks.length > 0 ||
      presetBlocks.length > 0 ||
      tags.length > 0 ||
      importanceChanged
    onUnsavedChange?.(hasData)
  }, [coreBlocks, extensionSections, customBlocks, appliedPresets, tags, importance, initialExperience, onUnsavedChange])

  const handleTypeSelect = useCallback((id: ExperienceTypeId) => {
    setTypeId(id)
    setTypeError(false)
  }, [])

  const handleRequestTypeChange = useCallback((): boolean => {
    const hasBlockData = (blocks: Block[]) => blocks.some(b => !isBlockEmpty(b))
    const extensionBlocks = extensionSections.flatMap(s => s.blocks)
    const presetBlocks = appliedPresets.flatMap(p => p.blocks)
    const hasData =
      hasBlockData(coreBlocks) ||
      hasBlockData(extensionBlocks) ||
      customBlocks.length > 0 ||
      presetBlocks.length > 0 ||
      tags.length > 0
    if (!hasData) return true
    return window.confirm("경험 유형을 바꾸면 입력한 내용이 초기화될 수 있어요. 계속할까요?")
  }, [coreBlocks, extensionSections, customBlocks, appliedPresets, tags])

  function handleExtensionChange(sectionId: string, blocks: Block[]) {
    setExtensionSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, blocks } : s))
    )
  }

  // ── Computed layout for restructured form ──────────────────────
  const formLayout = useMemo(() => {
    if (!template) return null

    // Separate type-specific sections from shared extended section
    const typeSpecificSections = extensionSections.filter(s => s.id !== "extended")
    const sharedExtendedSection = extensionSections.find(s => s.id === "extended")

    // Extract standalone fields from core
    const titleBlock = coreBlocks.find(b => b.label === "경험명")
    const summaryBlock = coreBlocks.find(b => b.label === "한 줄 요약")
    const evidenceBlock = coreBlocks.find(b => b.label === "증빙 자료")

    // Collect all labels from type-specific extensions to detect overlap
    const extensionLabels = new Set<string>()
    for (const section of typeSpecificSections) {
      for (const block of section.blocks) {
        extensionLabels.add(block.label)
      }
    }

    // Remaining core blocks = those not extracted and not overlapping with extensions
    const extractedLabels = new Set(["경험명", "한 줄 요약", "증빙 자료"])
    const remainingCoreBlocks = coreBlocks.filter(b => {
      if (extractedLabels.has(b.label)) return false
      // Keep if user already wrote something — never hide data silently
      if (!isBlockEmpty(b)) return true
      return !hasEquivalentIn(b.label, extensionLabels)
    })

    // Labels already present in remaining core + type-specific extensions.
    // Used to filter duplicate fields out of the shared "확장 입력" section.
    const usedLabels = new Set<string>(extensionLabels)
    for (const b of remainingCoreBlocks) usedLabels.add(b.label)

    const filteredSharedExtended = (sharedExtendedSection?.blocks ?? []).filter(b => {
      // Never hide a block that already has user data
      if (!isBlockEmpty(b)) return true
      return !hasEquivalentIn(b.label, usedLabels)
    })

    // Merge remaining core + filtered shared extended blocks into "확장 입력"
    const mergedExtendedBlocks = [
      ...remainingCoreBlocks,
      ...filteredSharedExtended,
    ]

    return {
      titleBlock,
      summaryBlock,
      evidenceBlock,
      typeSpecificSections,
      mergedExtendedBlocks,
      sharedExtendedSectionId: sharedExtendedSection?.id ?? "extended",
    }
  }, [template, coreBlocks, extensionSections])

  // ── Handle changes to blocks that live in merged sections ──────
  function handleCoreBlockChange(blockId: string, value: BlockValue) {
    setCoreBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, value } : b))
    )
  }

  function handleMergedExtendedChange(blocks: Block[]) {
    // Split back: core blocks update coreBlocks state, shared extended update extensionSections.
    // The merged array may only contain a subset of shared extended blocks (the rest
    // are hidden by dedupe); preserve hidden blocks when writing back.
    if (!formLayout) return
    const coreBlockIds = new Set(coreBlocks.map(b => b.id))
    const updatedCoreBlocks = blocks.filter(b => coreBlockIds.has(b.id))
    const updatedExtBlocks = blocks.filter(b => !coreBlockIds.has(b.id))
    const updatedExtMap = new Map(updatedExtBlocks.map(b => [b.id, b]))

    // Update core blocks that are in the merged section
    setCoreBlocks(prev =>
      prev.map(b => {
        const updated = updatedCoreBlocks.find(u => u.id === b.id)
        return updated ?? b
      })
    )

    // Merge visible shared-extended blocks back into full section, keeping hidden ones intact
    setExtensionSections(prev =>
      prev.map(s => {
        if (s.id !== formLayout.sharedExtendedSectionId) return s
        return {
          ...s,
          blocks: s.blocks.map(b => updatedExtMap.get(b.id) ?? b),
        }
      })
    )
  }

  // Handle evidence block appended to last type-specific section
  function handleTypeSpecificWithEvidenceChange(sectionId: string, blocks: Block[]) {
    if (!formLayout?.evidenceBlock) {
      handleExtensionChange(sectionId, blocks)
      return
    }

    const evidenceId = formLayout.evidenceBlock.id
    const evidenceUpdated = blocks.find(b => b.id === evidenceId)
    const sectionBlocks = blocks.filter(b => b.id !== evidenceId)

    // Update the extension section
    handleExtensionChange(sectionId, sectionBlocks)

    // Update evidence block in core
    if (evidenceUpdated) {
      setCoreBlocks(prev =>
        prev.map(b => (b.id === evidenceId ? evidenceUpdated : b))
      )
    }
  }

  function handleSave(status: ExperienceStatus) {
    if (!typeId || !template) {
      setTypeError(true)
      return
    }

    // Extract title from first core text block
    const titleBlock = coreBlocks.find(b => b.label === "경험명")
    const titleVal = titleBlock?.value
    const title = titleVal && titleVal.type === "text" ? titleVal.text : ""

    if (status === "draft" && !title.trim()) {
      // Even draft needs a title
      setTypeError(false)
      return
    }

    // Extract summary
    const summaryBlock = coreBlocks.find(b => b.label === "한 줄 요약")
    const summaryVal = summaryBlock?.value
    const summary = summaryVal && summaryVal.type === "text" ? summaryVal.text : ""

    // Flatten extension blocks
    const allExtensionBlocks = extensionSections.flatMap(s => s.blocks)
    // Merge custom blocks with applied-preset blocks for persistence
    const allCustomBlocks = [
      ...customBlocks,
      ...appliedPresets.flatMap(p => p.blocks),
    ]

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
      customBlocks: allCustomBlocks,
      createdAt: initialExperience?.createdAt ?? now,
      updatedAt: now,
    }

    onSave(experience)
  }

  const titleValue = formLayout?.titleBlock?.value
  const titleText = titleValue?.type === "text" ? titleValue.text : ""
  const summaryValue = formLayout?.summaryBlock?.value
  const summaryText = summaryValue?.type === "text" ? summaryValue.text : ""

  return (
    <div className="max-w-[640px] mx-auto px-5 py-6 md:px-12 md:py-10">
      {/* Header — inline editable title + summary */}
      <div className="flex items-start justify-between mb-7 gap-4">
        <div className="flex-1 min-w-0">
          {template && formLayout?.titleBlock && titleValue?.type === "text" ? (
            <input
              type="text"
              className="w-full text-heading-3 text-text-primary bg-transparent border-0 p-0 focus:outline-none placeholder:text-text-tertiary"
              placeholder={formLayout.titleBlock.placeholder ?? (mode === "new" ? "새 경험 추가" : "경험명")}
              value={titleText}
              aria-label="경험명"
              onChange={e =>
                handleCoreBlockChange(formLayout.titleBlock!.id, {
                  type: "text",
                  text: e.target.value,
                })
              }
            />
          ) : (
            <h2 className="text-heading-3 text-text-primary">
              {mode === "new" ? "새 경험 추가" : "경험 수정"}
            </h2>
          )}

          {template && formLayout?.summaryBlock && summaryValue?.type === "text" ? (
            <input
              type="text"
              className="w-full mt-1 text-body text-text-secondary bg-transparent border-0 p-0 focus:outline-none placeholder:text-text-tertiary"
              placeholder={formLayout.summaryBlock.placeholder ?? "한 줄 요약"}
              value={summaryText}
              aria-label="한 줄 요약"
              onChange={e =>
                handleCoreBlockChange(formLayout.summaryBlock!.id, {
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
        {initialExperience && (
          <Badge variant={initialExperience.status === "complete" ? "success" : "warning"}>
            {initialExperience.status === "complete" ? "완료" : "작성 중"}
          </Badge>
        )}
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

      {/* Form sections — restructured order */}
      {template && formLayout && (
        <div className="flex flex-col gap-5">
          {/* 1. First type-specific section — flat (no box) */}
          {formLayout.typeSpecificSections.map((section, idx) => {
            const isLast = idx === formLayout.typeSpecificSections.length - 1
            const sectionBlocks = isLast && formLayout.evidenceBlock
              ? [...section.blocks, formLayout.evidenceBlock]
              : section.blocks
            const onChange = (blocks: Block[]) =>
              isLast && formLayout.evidenceBlock
                ? handleTypeSpecificWithEvidenceChange(section.id, blocks)
                : handleExtensionChange(section.id, blocks)

            // Render the first type-specific section flat (no box)
            if (idx === 0) {
              return (
                <div key={section.id} className="flex flex-col gap-1">
                  <div className="text-label text-text-tertiary mb-1">
                    {section.label}
                  </div>
                  <BlockList
                    blocks={sectionBlocks}
                    onChange={onChange}
                  />
                </div>
              )
            }

            // Subsequent sections — collapsible boxed
            return (
              <FormSection
                key={section.id}
                label={section.label}
                blocks={sectionBlocks}
                defaultCollapsed={section.collapsed}
                onChange={onChange}
              />
            )
          })}

          {/* 2. Merged "확장 입력" section (remaining core + shared extended) */}
          {formLayout.mergedExtendedBlocks.length > 0 && (
            <FormSection
              label="확장 입력"
              blocks={formLayout.mergedExtendedBlocks}
              defaultCollapsed
              onChange={handleMergedExtendedChange}
            />
          )}

          {/* 3. 나만의 블록 — standalone block addition */}
          <section className="border border-dashed border-border rounded-lg px-5 py-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="min-w-0">
                <h3 className="text-title text-text-primary">나만의 블록</h3>
                <p className="text-caption text-text-tertiary mt-0.5">
                  필요한 입력을 자유롭게 추가하세요
                </p>
              </div>
              {customBlocks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSavePresetOpen(true)}
                >
                  <Save size={14} className="mr-1" />
                  프리셋으로 저장
                </Button>
              )}
            </div>
            <BlockList
              blocks={customBlocks}
              onChange={setCustomBlocks}
              allowAdd
              allowReorder
              allowDelete
            />
          </section>

          {/* 4. Applied presets — each as its own boxed group */}
          {appliedPresets.map(group => (
            <section
              key={group.groupId}
              className="border border-border rounded-lg px-5 py-5 bg-surface-secondary/40"
            >
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={16} className="text-brand-dark shrink-0" />
                  <h3 className="text-title text-text-primary truncate">{group.name}</h3>
                  <Badge variant="default">프리셋</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setAppliedPresets(prev => prev.filter(p => p.groupId !== group.groupId))
                  }
                  aria-label={`${group.name} 프리셋 제거`}
                >
                  <Trash2 size={14} className="mr-1" />
                  제거
                </Button>
              </div>
              <BlockList
                blocks={group.blocks}
                onChange={blocks =>
                  setAppliedPresets(prev =>
                    prev.map(p => (p.groupId === group.groupId ? { ...p, blocks } : p))
                  )
                }
                allowAdd
                allowReorder
                allowDelete
              />
            </section>
          ))}

          {/* 5. Preset toolbar */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setApplyPresetOpen(true)}
            >
              <BookOpen size={14} className="mr-1" />
              프리셋 불러오기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManagePresetOpen(true)}
            >
              <Settings size={14} className="mr-1" />
              프리셋 관리
            </Button>
          </div>

          {/* Preset modals */}
          <SavePresetModal
            open={savePresetOpen}
            blocks={customBlocks}
            onClose={() => setSavePresetOpen(false)}
            onSave={(name, description, selectedBlockIds) => {
              const selected = customBlocks.filter(b => selectedBlockIds.includes(b.id))
              createPreset(name, selected, { description })
            }}
          />
          <ApplyPresetModal
            open={applyPresetOpen}
            presets={presets}
            onClose={() => setApplyPresetOpen(false)}
            onApply={(presetId) => {
              const preset = getPreset(presetId)
              if (!preset) return
              const cloned = cloneBlocks(preset.blocks)
              setAppliedPresets(prev => [
                ...prev,
                { groupId: uid("grp"), name: preset.name, blocks: cloned },
              ])
            }}
          />
          <Dialog
            open={managePresetOpen}
            onClose={() => setManagePresetOpen(false)}
            ariaLabel="프리셋 관리"
            className="max-w-lg max-h-[85vh] flex flex-col"
          >
            <PresetManager
              presets={presets}
              onToggleFavorite={(id) => {
                const target = presets.find(p => p.id === id)
                if (!target) return
                void updatePreset(id, { isFavorite: !target.isFavorite })
              }}
              onRename={(id, name) => {
                void updatePreset(id, { name })
              }}
              onDuplicate={(id) => {
                void duplicatePreset(id)
              }}
              onDelete={(id) => {
                void deletePreset(id)
              }}
            />
          </Dialog>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-primary">태그</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* Action buttons */}
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
        </div>
      )}
    </div>
  )
}

// ── Inline tag input ──────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
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
