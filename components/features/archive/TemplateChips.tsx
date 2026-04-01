"use client";

import type { Template } from "@/types/archive";

interface TemplateChipsProps {
  templates: Template[];
  selectedId: string | null;
  onSelect: (template: Template) => void;
}

export function TemplateChips({ templates, selectedId, onSelect }: TemplateChipsProps) {
  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  const chipBase =
    "px-3 py-1 rounded-full text-label transition-all cursor-pointer";
  const chipSelected = "bg-brand text-white border border-brand font-semibold";
  const chipUnselected =
    "text-text-secondary border border-border hover:border-brand hover:text-brand hover:bg-surface-brand";

  return (
    <div className="mb-7">
      <p className="text-caption text-text-tertiary uppercase tracking-widest font-semibold mb-2">
        기본 유형
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {systemTemplates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={[chipBase, selectedId === t.id ? chipSelected : chipUnselected].join(" ")}
          >
            {t.label}
          </button>
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
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className={[chipBase, selectedId === t.id ? chipSelected : chipUnselected].join(
                  " "
                )}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              disabled
              title="준비 중"
              className={`${chipBase} text-text-disabled border border-dashed border-border cursor-not-allowed`}
            >
              + 새 템플릿 만들기
            </button>
          </div>
        </>
      )}

      {customTemplates.length === 0 && (
        <button
          type="button"
          disabled
          title="준비 중"
          className={`${chipBase} text-text-disabled border border-dashed border-border cursor-not-allowed`}
        >
          + 새 템플릿 만들기
        </button>
      )}
    </div>
  );
}
