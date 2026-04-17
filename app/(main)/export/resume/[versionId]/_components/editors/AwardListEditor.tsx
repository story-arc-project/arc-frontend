"use client";

import type { Award } from "@/types/resume";
import {
  AddItemButton,
  EditorCard,
  EditorField,
  EditorTextInput,
  EditorTextarea,
  nextClientId,
  SortableList,
} from "./shared";

interface Props {
  value: Award[];
  onChange: (next: Award[]) => void;
}

export function AwardListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Award>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        수상명: null,
        수여기관: null,
        수상년월: null,
        내용: null,
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={value}
        onReorder={onChange}
        renderItem={(a, handle) => (
          <EditorCard handle={handle} onDelete={() => removeItem(a.id)}>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="수상명">
                <EditorTextInput
                  value={a.수상명 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 수상명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="수여 기관">
                <EditorTextInput
                  value={a.수여기관 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 수여기관: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <EditorField label="수상년월">
              <EditorTextInput
                placeholder="YYYY-MM"
                value={a.수상년월 ?? ""}
                onChange={(e) =>
                  updateItem(a.id, { 수상년월: e.target.value || null })
                }
              />
            </EditorField>
            <EditorField label="내용">
              <EditorTextarea
                rows={2}
                value={a.내용 ?? ""}
                onChange={(e) =>
                  updateItem(a.id, { 내용: e.target.value || null })
                }
              />
            </EditorField>
          </EditorCard>
        )}
      />
      <AddItemButton label="수상 추가" onClick={addItem} />
    </div>
  );
}
