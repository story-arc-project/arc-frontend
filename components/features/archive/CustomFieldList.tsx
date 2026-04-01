"use client";

import { useRef } from "react";
import { Plus, X, Paperclip } from "lucide-react";
import { Input, Textarea, DatePicker } from "@/components/ui";
import type { CustomField, CustomFieldType } from "@/types/archive";

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: "textarea", label: "텍스트(장문)" },
  { value: "text", label: "텍스트(단문)" },
  { value: "date", label: "날짜" },
  { value: "file", label: "파일" },
];

interface CustomFieldListProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

export function CustomFieldList({ fields, onChange }: CustomFieldListProps) {

  function addField() {
    onChange([
      ...fields,
      { id: `cf-${Date.now()}`, key: `custom_${Date.now()}`, label: "", value: "", type: "textarea" },
    ]);
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function updateField(id: string, key: "label" | "value", value: string) {
    onChange(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  }

  function updateFieldType(id: string, type: CustomFieldType) {
    onChange(fields.map((f) => (f.id === id ? { ...f, type, value: "" } : f)));
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
                  aria-label="항목 이름"
                  className="flex-1 text-label font-semibold text-text-secondary bg-transparent border-b border-border focus:border-brand outline-none pb-1 transition-colors"
                />
                <select
                  value={field.type ?? "textarea"}
                  onChange={(e) => updateFieldType(field.id, e.target.value as CustomFieldType)}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-caption text-text-secondary outline-none transition-colors focus:border-brand"
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
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-text-tertiary hover:bg-surface-error hover:text-error transition-colors flex-shrink-0 -mr-1.5"
                >
                  <X size={13} />
                </button>
              </div>
              <FieldInput field={field} onChange={(v) => updateField(field.id, "value", v)} />
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
    </div>
  );
}

/** Renders the appropriate input based on field type */
function FieldInput({
  field,
  onChange,
}: {
  field: CustomField;
  onChange: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const type = field.type ?? "textarea";

  switch (type) {
    case "text":
      return (
        <Input
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="내용을 입력하세요"
        />
      );
    case "date":
      return (
        <DatePicker
          mode="date"
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "file":
      return (
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const name = e.target.files?.[0]?.name ?? "";
              onChange(name);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 h-12 px-4 rounded-md border border-dashed border-border bg-surface text-body text-text-tertiary hover:border-brand hover:text-brand transition-colors"
          >
            <Paperclip size={14} />
            {field.value || "파일 선택"}
          </button>
        </div>
      );
    case "textarea":
    default:
      return (
        <Textarea
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="내용을 입력하세요"
          className="min-h-[60px]"
        />
      );
  }
}
