"use client";

import { Chip } from "@/components/ui";
import type { Template } from "@/types/archive";

interface TemplateChipsProps {
  templates: Template[];
  selectedId: string | null;
  onSelect: (template: Template) => void;
}

export function TemplateChips({ templates, selectedId, onSelect }: TemplateChipsProps) {
  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  return (
    <div className="mb-7">
      <p className="text-caption text-text-tertiary uppercase tracking-widest font-semibold mb-2">
        기본 유형
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {systemTemplates.map((t) => (
          <Chip
            key={t.id}
            selected={selectedId === t.id}
            onClick={() => onSelect(t)}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {customTemplates.length > 0 && (
        <>
          <div className="h-px bg-border my-2" />
          <p className="text-caption text-text-tertiary uppercase tracking-widest font-semibold mb-2">
            내 템플릿
          </p>
          <div className="flex flex-wrap gap-1.5">
            {customTemplates.map((t) => (
              <Chip
                key={t.id}
                selected={selectedId === t.id}
                onClick={() => onSelect(t)}
              >
                {t.label}
              </Chip>
            ))}
            <Chip disabled>+ 새 템플릿 만들기</Chip>
          </div>
        </>
      )}

      {customTemplates.length === 0 && (
        <Chip disabled>+ 새 템플릿 만들기</Chip>
      )}
    </div>
  );
}
