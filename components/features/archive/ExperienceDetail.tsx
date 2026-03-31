"use client";

import { Badge, Button } from "@/components/ui";
import { ExperienceForm } from "./ExperienceForm";
import type { Folder, Template, ExperienceWithFolder } from "@/types/archive";
import { isQualitativeKey, isQualitativeTemplate } from "@/lib/templates";

interface ExperienceDetailProps {
  experience: ExperienceWithFolder;
  template: Template | undefined;
  isEditing: boolean;
  folders: Folder[];
  templates: Template[];
  onEdit: () => void;
  onSave: (exp: ExperienceWithFolder) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function ExperienceDetail({
  experience,
  template,
  isEditing,
  folders,
  templates,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onUnsavedChange,
}: ExperienceDetailProps) {
  if (isEditing) {
    return (
      <ExperienceForm
        mode="edit"
        initialExperience={experience}
        initialTemplate={template}
        folders={folders}
        templates={templates}
        onSave={onSave}
        onCancel={onCancel}
        onUnsavedChange={onUnsavedChange}
      />
    );
  }

  const hasQualitative = template ? isQualitativeTemplate(template.label) : false;
  const mainFields = experience.raw_text.filter(
    (f) => !isQualitativeKey(f.key) && f.value
  );
  const motivationField = experience.raw_text.find((f) => f.key === "motivation");
  const takeawayField = experience.raw_text.find((f) => f.key === "takeaway");

  return (
    <div className="max-w-[640px] mx-auto px-5 py-6 lg:px-12 lg:py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <Badge variant="brand">{template?.label ?? "이력"}</Badge>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            수정
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(experience.id)}
          >
            삭제
          </Button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col divide-y divide-border">
        {mainFields.map((field) => (
          <div key={field.key} className="py-3.5">
            <p className="text-caption text-text-tertiary uppercase tracking-widest font-semibold mb-1">
              {field.label}
            </p>
            <p className="text-body text-text-primary leading-relaxed whitespace-pre-wrap">
              {field.value}
            </p>
          </div>
        ))}
      </div>

      {/* Qualitative section */}
      {hasQualitative && (motivationField?.value || takeawayField?.value) && (
        <div className="rounded-xl bg-surface-brand border border-brand/15 p-5 mt-6 flex flex-col gap-5">
          {motivationField?.value && (
            <div>
              <p className="text-caption text-brand-dark uppercase tracking-widest font-bold mb-2">
                ✦ 지원 동기
              </p>
              <p className="text-body-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {motivationField.value}
              </p>
            </div>
          )}
          {takeawayField?.value && (
            <div>
              <p className="text-caption text-brand-dark uppercase tracking-widest font-bold mb-2">
                ✦ 배운 점
              </p>
              <p className="text-body-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {takeawayField.value}
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-caption text-text-disabled mt-6">
        마지막 수정: {formatDate(experience.updated_at)}
      </p>
    </div>
  );
}
