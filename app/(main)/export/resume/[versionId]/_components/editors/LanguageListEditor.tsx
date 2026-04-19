"use client";

import type { LanguageItem } from "@/types/resume";
import {
  AddItemButton,
  EditorCard,
  EditorField,
  EditorTextInput,
  nextClientId,
  SortableList,
} from "./shared";

interface Props {
  value: LanguageItem[];
  onChange: (next: LanguageItem[]) => void;
}

export function LanguageListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<LanguageItem>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        언어: null,
        시험명: null,
        점수등급: null,
        취득년월: null,
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={value}
        onReorder={onChange}
        renderItem={(l, handle) => (
          <EditorCard handle={handle} onDelete={() => removeItem(l.id)}>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="언어">
                <EditorTextInput
                  placeholder="예: 영어"
                  value={l.언어 ?? ""}
                  onChange={(e) =>
                    updateItem(l.id, { 언어: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="시험명">
                <EditorTextInput
                  placeholder="예: TOEIC"
                  value={l.시험명 ?? ""}
                  onChange={(e) =>
                    updateItem(l.id, { 시험명: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="점수 / 등급">
                <EditorTextInput
                  value={l.점수등급 ?? ""}
                  onChange={(e) =>
                    updateItem(l.id, { 점수등급: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="취득년월">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={l.취득년월 ?? ""}
                  onChange={(e) =>
                    updateItem(l.id, { 취득년월: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
          </EditorCard>
        )}
      />
      <AddItemButton label="어학 추가" onClick={addItem} />
    </div>
  );
}
