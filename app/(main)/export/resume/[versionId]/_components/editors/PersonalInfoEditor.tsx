"use client";

import { Plus, X } from "lucide-react";
import type { PersonalInfo, PersonalInfoLink } from "@/types/resume";
import {
  EditorField,
  EditorTextInput,
} from "./shared";

interface Props {
  value: PersonalInfo;
  onChange: (next: PersonalInfo) => void;
}

export function PersonalInfoEditor({ value, onChange }: Props) {
  const patch = (key: keyof PersonalInfo, v: string) => {
    onChange({ ...value, [key]: v || null });
  };

  const updateLink = (i: number, next: Partial<PersonalInfoLink>) => {
    const links = [...value.링크];
    links[i] = { ...links[i], ...next };
    onChange({ ...value, 링크: links });
  };
  const addLink = () => onChange({ ...value, 링크: [...value.링크, { label: null, url: "" }] });
  const removeLink = (i: number) =>
    onChange({ ...value, 링크: value.링크.filter((_, idx) => idx !== i) });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <EditorField label="이름">
          <EditorTextInput
            value={value.이름 ?? ""}
            onChange={(e) => patch("이름", e.target.value)}
          />
        </EditorField>
        <EditorField label="영문명">
          <EditorTextInput
            value={value.영문명 ?? ""}
            onChange={(e) => patch("영문명", e.target.value)}
          />
        </EditorField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <EditorField label="생년월일">
          <EditorTextInput
            placeholder="YYYY-MM-DD"
            value={value.생년월일 ?? ""}
            onChange={(e) => patch("생년월일", e.target.value)}
          />
        </EditorField>
        <EditorField label="전화번호">
          <EditorTextInput
            value={value.전화번호 ?? ""}
            onChange={(e) => patch("전화번호", e.target.value)}
          />
        </EditorField>
      </div>
      <EditorField label="이메일">
        <EditorTextInput
          type="email"
          value={value.이메일 ?? ""}
          onChange={(e) => patch("이메일", e.target.value)}
        />
      </EditorField>
      <EditorField label="주소">
        <EditorTextInput
          value={value.주소 ?? ""}
          onChange={(e) => patch("주소", e.target.value)}
        />
      </EditorField>

      <div className="flex flex-col gap-1.5">
        <p className="text-caption font-medium text-text-secondary">링크</p>
        {value.링크.length === 0 ? (
          <p className="text-caption text-text-tertiary">링크가 없어요.</p>
        ) : (
          value.링크.map((link, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <EditorTextInput
                placeholder="라벨"
                value={link.label ?? ""}
                onChange={(e) => updateLink(i, { label: e.target.value || null })}
                className="max-w-[120px]"
              />
              <EditorTextInput
                placeholder="https://"
                value={link.url ?? ""}
                onChange={(e) => updateLink(i, { url: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="shrink-0 p-1.5 text-text-tertiary hover:text-error"
                aria-label="링크 삭제"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          onClick={addLink}
          className="inline-flex items-center gap-1 self-start text-caption text-text-secondary hover:text-text-primary transition-colors"
        >
          <Plus size={12} /> 링크 추가
        </button>
      </div>
    </div>
  );
}
