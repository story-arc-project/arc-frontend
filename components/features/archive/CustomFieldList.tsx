"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import type { CustomField } from "@/types/archive";

interface CustomFieldListProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  onSaveAsTemplate?: (name: string) => void;
}

export function CustomFieldList({ fields, onChange, onSaveAsTemplate }: CustomFieldListProps) {
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState("");

  function addField() {
    onChange([
      ...fields,
      { id: `cf-${Date.now()}`, key: `custom_${Date.now()}`, label: "", value: "" },
    ]);
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function updateField(id: string, key: "label" | "value", value: string) {
    onChange(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  }

  function handleSaveTemplate() {
    if (templateName.trim()) {
      onSaveAsTemplate?.(templateName.trim());
      setTemplateName("");
      setShowTemplateSave(false);
    }
  }

  return (
    <div className="mt-5">
      {/* Custom field rows */}
      {fields.length > 0 && (
        <div className="flex flex-col gap-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 p-3.5 rounded-lg border border-border bg-surface-secondary"
            >
              <div className="flex items-center gap-2">
                <input
                  value={field.label}
                  onChange={(e) => updateField(field.id, "label", e.target.value)}
                  placeholder="항목 이름"
                  className="flex-1 text-label font-semibold text-text-secondary bg-transparent border-b border-border focus:border-brand outline-none pb-1 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:bg-surface-error hover:text-error transition-colors flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
              <Textarea
                value={field.value}
                onChange={(e) => updateField(field.id, "value", e.target.value)}
                placeholder="내용을 입력하세요"
                className="min-h-[60px]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Add field button */}
      <button
        type="button"
        onClick={addField}
        className="flex items-center gap-1.5 text-label text-brand font-medium hover:text-brand-dark transition-colors mt-3"
      >
        <Plus size={14} />
        항목 추가
      </button>

      {/* Save as template */}
      {fields.length > 0 && (
        <div className="mt-2">
          {!showTemplateSave ? (
            <button
              type="button"
              onClick={() => setShowTemplateSave(true)}
              className="text-caption text-text-tertiary underline underline-offset-2 hover:text-brand transition-colors"
            >
              이 구성을 템플릿으로 저장
            </button>
          ) : (
            <div className="flex gap-2 items-center mt-1">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="템플릿 이름"
                className="flex-1 h-9"
              />
              <Button variant="secondary" size="sm" onClick={handleSaveTemplate}>
                저장
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowTemplateSave(false);
                  setTemplateName("");
                }}
              >
                취소
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
