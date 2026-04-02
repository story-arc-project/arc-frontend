"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Input, Dialog } from "@/components/ui";

const FIELD_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "text", label: "텍스트(단문)" },
  { value: "textarea", label: "텍스트(장문)" },
  { value: "period", label: "기간" },
  { value: "select", label: "선택" },
  { value: "date", label: "날짜" },
  { value: "file", label: "파일" },
];

export interface TemplateFieldDraft {
  id: string;
  label: string;
  type: string;
}

interface SaveTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, fields: TemplateFieldDraft[]) => void;
  initialFields: TemplateFieldDraft[];
}

export function SaveTemplateModal({
  open,
  onClose,
  onSave,
  initialFields,
}: SaveTemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [fields, setFields] = useState<TemplateFieldDraft[]>(initialFields);
  const [nameError, setNameError] = useState(false);

  function updateFieldLabel(id: string, label: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  }

  function updateFieldType(id: string, type: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, type } : f)));
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { id: `draft-${Date.now()}`, label: "", type: "textarea" },
    ]);
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function handleSave() {
    if (!templateName.trim()) {
      setNameError(true);
      return;
    }
    onSave(templateName.trim(), fields.filter((f) => f.label.trim()));
    setTemplateName("");
    setNameError(false);
  }

  function handleClose() {
    setTemplateName("");
    setNameError(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} ariaLabel="템플릿으로 저장" className="max-w-md">
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <h3 className="text-heading-4 text-text-primary">템플릿으로 저장</h3>
          <p className="text-body-sm text-text-tertiary mt-1">
            항목 이름과 유형을 확인하고 수정할 수 있어요
          </p>
        </div>

        {/* Template name */}
        <Input
          label="템플릿 이름"
          value={templateName}
          onChange={(e) => {
            setTemplateName(e.target.value);
            if (nameError) setNameError(false);
          }}
          placeholder="예: 프로젝트 이력"
        />
        {nameError && (
          <p className="text-body-sm text-error -mt-3" role="alert">
            템플릿 이름을 입력해주세요.
          </p>
        )}

        {/* Field list */}
        {fields.length > 0 && (
          <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto -mx-1 px-1">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-surface-secondary"
              >
                <span className="text-caption text-text-quaternary w-5 text-center flex-shrink-0">
                  {idx + 1}
                </span>
                <input
                  value={field.label}
                  onChange={(e) => updateFieldLabel(field.id, e.target.value)}
                  placeholder="항목 이름"
                  className="flex-1 min-w-0 text-body-sm text-text-primary bg-transparent border-b border-transparent focus:border-brand outline-none pb-0.5 transition-colors"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateFieldType(field.id, e.target.value)}
                  className="h-7 rounded-md border border-border bg-surface px-2 text-caption text-text-secondary outline-none transition-colors focus:border-brand flex-shrink-0"
                >
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  aria-label="항목 삭제"
                  className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded text-text-tertiary hover:bg-surface-error hover:text-error transition-colors flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {fields.length === 0 && (
          <p className="text-body-sm text-text-tertiary text-center py-4">
            항목을 추가해주세요.
          </p>
        )}

        {/* Add field */}
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1.5 text-label text-brand font-medium hover:text-brand-dark transition-colors"
        >
          <Plus size={14} />
          항목 추가
        </button>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            취소
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
