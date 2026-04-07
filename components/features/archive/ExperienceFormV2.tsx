"use client"

import { useState, useEffect, useCallback } from "react"
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
import { usePresets } from "@/hooks/usePresets"

interface ExperienceFormV2Props {
  mode: "new" | "edit"
  initialExperience?: ExperienceV2
  onSave: (experience: ExperienceV2) => void
  onCancel: () => void
  onUnsavedChange?: (hasUnsaved: boolean) => void
}

export default function ExperienceFormV2({
  mode,
  initialExperience,
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
  const { presets, createPreset, getPreset } = usePresets()

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
        setExtensionSections(
          tmpl.extensions.map(ext => ({
            id: ext.id,
            label: ext.label,
            collapsed: ext.collapsed,
            blocks: initialExperience.extensionBlocks.length > 0
              ? initialExperience.extensionBlocks
              : cloneBlocks(ext.blocks),
          }))
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId])

  // Track dirty state
  useEffect(() => {
    const hasData =
      coreBlocks.some(b => {
        const v = b.value
        if (v.type === "text" || v.type === "textarea") return v.text.trim() !== ""
        return false
      }) || customBlocks.length > 0
    onUnsavedChange?.(hasData)
  }, [coreBlocks, customBlocks, onUnsavedChange])

  const handleTypeSelect = useCallback((id: ExperienceTypeId) => {
    setTypeId(id)
    setTypeError(false)
  }, [])

  function handleExtensionChange(sectionId: string, blocks: Block[]) {
    setExtensionSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, blocks } : s))
    )
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
      userId: initialExperience?.userId ?? "mock",
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

      {/* Core fields */}
      {template && (
        <div className="flex flex-col gap-5">
          <FormSection
            label={template.commonCore.label}
            blocks={coreBlocks}
            onChange={setCoreBlocks}
          />

          {/* Extension sections */}
          {extensionSections.map(section => (
            <FormSection
              key={section.id}
              label={section.label}
              blocks={section.blocks}
              defaultCollapsed={section.collapsed}
              onChange={blocks => handleExtensionChange(section.id, blocks)}
            />
          ))}

          {/* Custom blocks section */}
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
