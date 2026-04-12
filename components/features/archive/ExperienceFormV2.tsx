"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { BookOpen, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import TypeSelector from "./TypeSelector"
import FormSection from "./FormSection"
import BlockList from "./blocks/BlockList"
import SavePresetModal from "./SavePresetModal"
import ApplyPresetModal from "./ApplyPresetModal"
import type {
  ExperienceV2,
  ExperienceTypeId,
  ExperienceStatus,
  Block,
  BlockValue,
  TemplateV2,
} from "@/types/archive"
import { getTemplateForType } from "@/lib/templates-v2"
import { cloneBlocks, uid } from "@/lib/block-utils"
import type { UsePresetsReturn } from "@/hooks/usePresets"

interface ExperienceFormV2Props {
  mode: "new" | "edit"
  initialExperience?: ExperienceV2
  presetsHook: UsePresetsReturn
  onSave: (experience: ExperienceV2) => void
  onCancel: () => void
  onUnsavedChange?: (hasUnsaved: boolean) => void
}

// Labels in commonCore that have equivalent fields in type-specific extensions
const CORE_PERIOD_EQUIVALENTS = [
  "기간", "재직기간", "읽은 기간/완독일", "제작 기간", "준비 기간", "학습 기간",
]
const CORE_ROLE_EQUIVALENTS = [
  "내 역할/기여도", "내 역할/기여", "내 역할", "직책/역할", "역할/직책",
]
const CORE_ACHIEVEMENT_EQUIVALENTS = [
  "핵심 성과", "핵심 성과 기록",
]

function hasEquivalentInExtensions(coreLabel: string, extensionLabels: Set<string>): boolean {
  if (extensionLabels.has(coreLabel)) return true

  if (coreLabel === "기간") {
    return CORE_PERIOD_EQUIVALENTS.some(eq => extensionLabels.has(eq))
  }
  if (coreLabel === "내 역할/기여도") {
    return CORE_ROLE_EQUIVALENTS.some(eq => extensionLabels.has(eq))
  }
  if (coreLabel === "핵심 성과") {
    return CORE_ACHIEVEMENT_EQUIVALENTS.some(eq => extensionLabels.has(eq))
  }
  return false
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
  const [tags, setTags] = useState<string[]>(initialExperience?.tags ?? [])
  const [typeError, setTypeError] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [applyPresetOpen, setApplyPresetOpen] = useState(false)
  const { presets, createPreset, getPreset } = presetsHook

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
    const hasBlockData = (blocks: Block[]) =>
      blocks.some(b => {
        const v = b.value
        if (v.type === "text" || v.type === "textarea") return v.text.trim() !== ""
        if (v.type === "checklist") return v.checked.length > 0
        if (v.type === "single-select") return v.selected !== ""
        if (v.type === "date") return v.date !== ""
        if (v.type === "period") return v.start !== "" || v.end !== ""
        if (v.type === "tags") return v.tags.length > 0
        if (v.type === "link") return v.url.trim() !== ""
        if (v.type === "file") return v.fileName.trim() !== ""
        if (v.type === "repeatable-cell") return v.rows.length > 0
        if (v.type === "table") return v.rows.length > 0
        return false
      })
    const extensionBlocks = extensionSections.flatMap(s => s.blocks)
    const hasData =
      hasBlockData(coreBlocks) ||
      hasBlockData(extensionBlocks) ||
      customBlocks.length > 0 ||
      tags.length > 0
    onUnsavedChange?.(hasData)
  }, [coreBlocks, extensionSections, customBlocks, tags, onUnsavedChange])

  const handleTypeSelect = useCallback((id: ExperienceTypeId) => {
    setTypeId(id)
    setTypeError(false)
  }, [])

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
      return !hasEquivalentInExtensions(b.label, extensionLabels)
    })

    // Merge remaining core + shared extended blocks into "확장 입력"
    const mergedExtendedBlocks = [
      ...remainingCoreBlocks,
      ...(sharedExtendedSection?.blocks ?? []),
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
    // Split back: core blocks update coreBlocks state, shared extended update extensionSections
    if (!formLayout) return
    const coreBlockIds = new Set(coreBlocks.map(b => b.id))
    const updatedCoreBlocks = blocks.filter(b => coreBlockIds.has(b.id))
    const updatedExtBlocks = blocks.filter(b => !coreBlockIds.has(b.id))

    // Update core blocks that are in the merged section
    setCoreBlocks(prev =>
      prev.map(b => {
        const updated = updatedCoreBlocks.find(u => u.id === b.id)
        return updated ?? b
      })
    )

    // Update shared extended section
    setExtensionSections(prev =>
      prev.map(s =>
        s.id === formLayout.sharedExtendedSectionId
          ? { ...s, blocks: updatedExtBlocks }
          : s
      )
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

    const now = new Date().toISOString()
    const experience: ExperienceV2 = {
      id: initialExperience?.id ?? uid("exp"),
      userId: initialExperience?.userId ?? "",
      typeId,
      title,
      summary,
      status,
      tags,
      coreBlocks,
      extensionBlocks: allExtensionBlocks,
      customBlocks,
      createdAt: initialExperience?.createdAt ?? now,
      updatedAt: now,
    }

    onSave(experience)
  }

  return (
    <div className="max-w-[640px] mx-auto px-5 py-6 md:px-12 md:py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 gap-4">
        <div>
          <h2 className="text-heading-3 text-text-primary">
            {mode === "new" ? "새 경험 추가" : "경험 수정"}
          </h2>
          <p className="text-body-sm text-text-tertiary mt-1">
            유형을 선택하고 내용을 기록해주세요
          </p>
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
      />
      {typeError && (
        <p className="text-body-sm text-error -mt-4 mb-4" role="alert">
          경험 유형을 선택해주세요.
        </p>
      )}

      {/* Form sections — restructured order */}
      {template && formLayout && (
        <div className="flex flex-col gap-5">
          {/* 1. Standalone title + summary */}
          {formLayout.titleBlock && (
            <StandaloneBlockField
              block={formLayout.titleBlock}
              onChange={handleCoreBlockChange}
            />
          )}
          {formLayout.summaryBlock && (
            <StandaloneBlockField
              block={formLayout.summaryBlock}
              onChange={handleCoreBlockChange}
            />
          )}

          {/* 2. Type-specific extension sections FIRST */}
          {formLayout.typeSpecificSections.map((section, idx) => {
            const isLast = idx === formLayout.typeSpecificSections.length - 1
            // Append evidence block to the last type-specific section
            const sectionBlocks = isLast && formLayout.evidenceBlock
              ? [...section.blocks, formLayout.evidenceBlock]
              : section.blocks

            return (
              <FormSection
                key={section.id}
                label={section.label}
                blocks={sectionBlocks}
                defaultCollapsed={section.collapsed}
                onChange={blocks =>
                  isLast && formLayout.evidenceBlock
                    ? handleTypeSpecificWithEvidenceChange(section.id, blocks)
                    : handleExtensionChange(section.id, blocks)
                }
              />
            )
          })}

          {/* 3. Merged "확장 입력" section (remaining core + shared extended) */}
          {formLayout.mergedExtendedBlocks.length > 0 && (
            <FormSection
              label="확장 입력"
              blocks={formLayout.mergedExtendedBlocks}
              defaultCollapsed
              onChange={handleMergedExtendedChange}
            />
          )}

          {/* 4. Custom blocks section (unchanged) */}
          <section className="border border-dashed border-border rounded-lg px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title text-text-primary">나만의 블록 추가</h3>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setApplyPresetOpen(true)}
                >
                  <BookOpen size={14} className="mr-1" />
                  프리셋 적용
                </Button>
                {customBlocks.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSavePresetOpen(true)}
                  >
                    <Save size={14} className="mr-1" />
                    프리셋 저장
                  </Button>
                )}
              </div>
            </div>
            <BlockList
              blocks={customBlocks}
              onChange={setCustomBlocks}
              allowAdd
              allowReorder
              allowDelete
            />
          </section>

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
            onApply={(presetId, mode) => {
              const preset = getPreset(presetId)
              if (!preset) return
              const cloned = cloneBlocks(preset.blocks)
              if (mode === "overwrite") {
                setCustomBlocks(cloned)
              } else {
                setCustomBlocks(prev => [...prev, ...cloned])
              }
            }}
          />

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

// ── Standalone block field (title / summary) ────────────────────────
function StandaloneBlockField({
  block,
  onChange,
}: {
  block: Block
  onChange: (blockId: string, value: BlockValue) => void
}) {
  const val = block.value
  if (val.type !== "text") return null

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-text-primary">
        {block.label}
        {block.required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type="text"
        className="h-12 w-full rounded-md border border-border bg-surface px-4 text-body text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors"
        placeholder={block.placeholder}
        value={val.text}
        onChange={e => onChange(block.id, { ...val, text: e.target.value })}
      />
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
