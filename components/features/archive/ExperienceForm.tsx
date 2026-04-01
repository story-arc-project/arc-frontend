"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, Textarea, PeriodPicker } from "@/components/ui";
import { TemplateChips } from "./TemplateChips";
import { QualitativeSection } from "./QualitativeSection";
import { CustomFieldList } from "./CustomFieldList";
import type {
  Folder,
  Template,
  ExperienceWithFolder,
  CustomField,
  RawTextField,
  TemplateField,
} from "@/types/archive";
import { isQualitativeKey, isQualitativeTemplate } from "@/lib/templates";

interface ExperienceFormProps {
  mode: "new" | "edit";
  initialExperience?: ExperienceWithFolder;
  initialTemplate?: Template;
  folders: Folder[];
  templates: Template[];
  onSave: (experience: ExperienceWithFolder) => void;
  onCancel: () => void;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

// ── Dynamic field renderer ──────────────────────────────────────────────────
function DynamicField({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "period") {
    return <PeriodPicker label={field.label} value={value} onChange={onChange} />;
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        label={field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === "select" && field.options) {
    const selectId = `field-${field.key}`;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-label text-text-primary">{field.label}</label>
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-md border border-border bg-surface px-4 text-body text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          <option value="">선택하세요</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Default: text
  return (
    <Input
      label={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function ExperienceForm({
  mode,
  initialExperience,
  initialTemplate,
  folders,
  templates,
  onSave,
  onCancel,
  onUnsavedChange,
}: ExperienceFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    initialTemplate ?? null
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    initialExperience?.folderId ?? "unclassified"
  );
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    if (!initialExperience) return {};
    return Object.fromEntries(
      initialExperience.raw_text.map((f) => [f.key, f.value])
    );
  });
  const [motivation, setMotivation] = useState(
    () => initialExperience?.raw_text.find((f) => f.key === "motivation")?.value ?? ""
  );
  const [takeaway, setTakeaway] = useState(
    () => initialExperience?.raw_text.find((f) => f.key === "takeaway")?.value ?? ""
  );
  const [templateError, setTemplateError] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    if (!initialExperience || !selectedTemplate) return [];
    const schemaKeys = new Set(selectedTemplate.field_schema.map((f) => f.key));
    return initialExperience.raw_text
      .filter((f) => !schemaKeys.has(f.key))
      .map((f) => ({ id: `cf-${f.key}`, key: f.key, label: f.label, value: f.value, type: ((f as unknown as Record<string, unknown>).fieldType as CustomField["type"]) ?? "textarea" }));
  });

  const showQualitative = selectedTemplate
    ? isQualitativeTemplate(selectedTemplate.label)
    : false;

  // Notify parent when form becomes dirty
  useEffect(() => {
    const hasSomeValue =
      Object.values(formValues).some(Boolean) ||
      !!motivation ||
      !!takeaway ||
      customFields.some((f) => f.value);
    onUnsavedChange?.(hasSomeValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues, motivation, takeaway, customFields]);

  const handleTemplateSelect = useCallback(
    (template: Template) => {
      setSelectedTemplate(template);
      setTemplateError(false);
      setFormValues({});
      setMotivation("");
      setTakeaway("");
      setCustomFields([]);
      onUnsavedChange?.(false);
    },
    [onUnsavedChange]
  );

  function handleFieldChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!selectedTemplate) {
      setTemplateError(true);
      return;
    }

    // Build raw_text array
    const mainFields: RawTextField[] = selectedTemplate.field_schema
      .filter((f) => !isQualitativeKey(f.key))
      .map((f) => ({ key: f.key, label: f.label, value: formValues[f.key] ?? "" }));

    const qualFields: RawTextField[] = showQualitative
      ? [
          {
            key: "motivation",
            label: "왜 이 활동을 했나요?",
            value: motivation,
          },
          {
            key: "takeaway",
            label: "무엇을 배웠나요?",
            value: takeaway,
          },
        ]
      : [];

    const customRaw = customFields.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value,
      fieldType: f.type,
    }));

    const now = new Date().toISOString();
    const saved: ExperienceWithFolder = {
      id: initialExperience?.id ?? `exp-${Date.now()}`,
      user_id: initialExperience?.user_id ?? "mock",
      templates_id: selectedTemplate.id,
      folderId: selectedFolderId,
      raw_text: [...mainFields, ...qualFields, ...customRaw],
      created_at: initialExperience?.created_at ?? now,
      updated_at: now,
    };

    onSave(saved);
  }

  const mainFields = selectedTemplate?.field_schema.filter(
    (f) => !isQualitativeKey(f.key)
  ) ?? [];

  return (
    <div className="max-w-[640px] mx-auto px-5 py-6 lg:px-12 lg:py-10">
      {/* Header */}
      <div className="mb-7">
        <h2 className="text-heading-3 text-text-primary">
          {mode === "new" ? "새 이력 추가" : "이력 수정"}
        </h2>
        <p className="text-body-sm text-text-tertiary mt-1">
          유형을 선택하고 내용을 기록해주세요
        </p>
      </div>

      {/* Template chips */}
      <TemplateChips
        templates={templates}
        selectedId={selectedTemplate?.id ?? null}
        onSelect={handleTemplateSelect}
        disabled={mode === "edit"}
      />
      {templateError && (
        <p className="text-body-sm text-error -mt-5 mb-5" role="alert">
          유형을 선택해주세요.
        </p>
      )}

      {/* Dynamic fields */}
      {selectedTemplate && (
        <div className="flex flex-col gap-5">
          {mainFields.map((field) => (
            <DynamicField
              key={field.key}
              field={field}
              value={formValues[field.key] ?? ""}
              onChange={(v) => handleFieldChange(field.key, v)}
            />
          ))}

          {/* Folder selector */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="folder-select" className="text-label text-text-tertiary font-semibold">저장할 폴더</label>
            <select
              id="folder-select"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="h-12 w-full rounded-md border border-border bg-surface px-4 text-body text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Qualitative section */}
      {showQualitative && (
        <QualitativeSection
          motivation={motivation}
          takeaway={takeaway}
          onMotivationChange={setMotivation}
          onTakeawayChange={setTakeaway}
        />
      )}

      {/* Custom fields */}
      {selectedTemplate && (
        <CustomFieldList
          fields={customFields}
          onChange={setCustomFields}
        />
      )}

      {/* Action buttons */}
      {selectedTemplate && (
        <div className="flex gap-2 mt-8 pt-6 border-t border-border">
          <Button variant="primary" size="md" onClick={handleSubmit}>
            저장
          </Button>
          <Button variant="ghost" size="md" onClick={onCancel}>
            취소
          </Button>
        </div>
      )}
    </div>
  );
}
