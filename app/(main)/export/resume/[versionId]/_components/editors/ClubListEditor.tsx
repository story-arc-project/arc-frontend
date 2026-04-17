"use client";

import type { Club } from "@/types/resume";
import {
  AddItemButton,
  BulletListEditor,
  EditorCard,
  EditorField,
  EditorSelect,
  EditorTextInput,
  nextClientId,
  SortableList,
} from "./shared";

const 단체구분Options = ["동아리", "학회", "학생회", "기타"] as const;

interface Props {
  value: Club[];
  onChange: (next: Club[]) => void;
}

export function ClubListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Club>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        단체명: null,
        구분: null,
        기간_원문: null,
        역할: null,
        활동내용: [],
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
              <EditorField label="단체명">
                <EditorTextInput
                  value={c.단체명 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 단체명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="구분">
                <EditorSelect
                  options={단체구분Options}
                  value={c.구분 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, {
                      구분: (e.target.value || null) as Club["구분"],
                    })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="역할">
                <EditorTextInput
                  value={c.역할 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 역할: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="기간">
                <EditorTextInput
                  placeholder="자유 입력"
                  value={c.기간_원문 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 기간_원문: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <BulletListEditor
              label="활동 내용"
              items={c.활동내용}
              onChange={(next) => updateItem(c.id, { 활동내용: next })}
            />
          </EditorCard>
        )}
      />
      <AddItemButton label="동아리·학회 추가" onClick={addItem} />
    </div>
  );
}
