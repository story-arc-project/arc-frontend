"use client";

import type { Certification } from "@/types/resume";
import {
  AddItemButton,
  EditorCard,
  EditorField,
  EditorSelect,
  EditorTextInput,
  nextClientId,
  SortableList,
} from "./shared";

const 자격구분Options = ["자격증", "면허", "수료증"] as const;

interface Props {
  value: Certification[];
  onChange: (next: Certification[]) => void;
}

export function CertificationListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Certification>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        자격증명: null,
        발급기관: null,
        취득년월: null,
        자격구분: null,
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={value}
        onReorder={onChange}
        renderItem={(c, handle) => (
          <EditorCard handle={handle} onDelete={() => removeItem(c.id)}>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="자격증명">
                <EditorTextInput
                  value={c.자격증명 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 자격증명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="발급 기관">
                <EditorTextInput
                  value={c.발급기관 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 발급기관: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="취득년월">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={c.취득년월 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 취득년월: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="구분">
                <EditorSelect
                  options={자격구분Options}
                  value={c.자격구분 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, {
                      자격구분: (e.target.value || null) as Certification["자격구분"],
                    })
                  }
                />
              </EditorField>
            </div>
          </EditorCard>
        )}
      />
      <AddItemButton label="자격증 추가" onClick={addItem} />
    </div>
  );
}
