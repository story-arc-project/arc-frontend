"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog } from "@/components/ui/dialog"
import type { Block } from "@/types/archive"

interface SavePresetModalProps {
  open: boolean
  blocks: Block[]
  onClose: () => void
  onSave: (name: string, description: string, selectedBlockIds: string[]) => void
}

export default function SavePresetModal({ open, blocks, onClose, onSave }: SavePresetModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(blocks.map(b => b.id))
  )
  const [error, setError] = useState("")

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    if (!name.trim()) {
      setError("프리셋 이름을 입력해주세요.")
      return
    }
    if (selectedIds.size === 0) {
      setError("최소 하나의 블록을 선택해주세요.")
      return
    }
    onSave(name.trim(), description.trim(), Array.from(selectedIds))
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="프리셋으로 저장">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-heading-3 text-text-primary">프리셋으로 저장</h3>
          <p className="text-body-sm text-text-tertiary mt-1">
            선택한 블록 조합을 재사용할 수 있는 프리셋으로 저장합니다.
          </p>
        </div>

        <Input
          label="프리셋 이름"
          placeholder="예: 성과 기록 양식"
          value={name}
          onChange={e => { setName(e.target.value); setError("") }}
          error={error && !name.trim() ? error : undefined}
          required
        />

        <Textarea
          label="설명 (선택)"
          placeholder="이 프리셋의 용도를 간단히 설명해주세요"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Block selection */}
        <div className="flex flex-col gap-2">
          <span className="text-label text-text-primary">포함할 블록</span>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1 border border-border rounded-lg p-2">
            {blocks.map(block => (
              <label
                key={block.id}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-body-sm",
                  selectedIds.has(block.id)
                    ? "bg-surface-brand text-text-primary"
                    : "bg-surface text-text-secondary hover:bg-surface-secondary",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(block.id)}
                  onChange={() => toggle(block.id)}
                  className="rounded border-border"
                />
                <span className="flex-1">{block.label}</span>
                <span className="text-caption text-text-tertiary">{block.type}</span>
              </label>
            ))}
          </div>
          {error && selectedIds.size === 0 && (
            <p className="text-body-sm text-error">{error}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
