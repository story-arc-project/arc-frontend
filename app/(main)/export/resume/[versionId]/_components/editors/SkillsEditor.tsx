"use client";

import type { Skills } from "@/types/resume";
import { TagArrayEditor } from "./shared";

interface Props {
  value: Skills;
  onChange: (next: Skills) => void;
}

export function SkillsEditor({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <TagArrayEditor
        label="기술 스택"
        items={value.기술스택}
        placeholder="예: React, TypeScript"
        onChange={(next) => onChange({ ...value, 기술스택: next })}
      />
      <TagArrayEditor
        label="툴"
        items={value.툴}
        placeholder="예: Figma, Notion"
        onChange={(next) => onChange({ ...value, 툴: next })}
      />
      <TagArrayEditor
        label="소프트 스킬"
        items={value.소프트스킬}
        placeholder="예: 커뮤니케이션, 협업"
        onChange={(next) => onChange({ ...value, 소프트스킬: next })}
      />
    </div>
  );
}
