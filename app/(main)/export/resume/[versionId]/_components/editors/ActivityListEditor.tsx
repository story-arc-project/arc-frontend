"use client";

import type { Activity } from "@/types/resume";
import {
  AddItemButton,
  BulletListEditor,
  EditorCard,
  EditorField,
  EditorTextInput,
  nextClientId,
  SortableList,
} from "./shared";

interface Props {
  value: Activity[];
  onChange: (next: Activity[]) => void;
}

export function ActivityListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Activity>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        활동명: null,
        기관: null,
        기간_시작: null,
        기간_종료: null,
        기간_원문: null,
        진행중: false,
        역할: null,
        활동내용: [],
        성과: [],
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
              <EditorField label="활동명">
                <EditorTextInput
                  value={a.활동명 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 활동명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="기관">
                <EditorTextInput
                  value={a.기관 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 기관: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <EditorField label="역할">
              <EditorTextInput
                value={a.역할 ?? ""}
                onChange={(e) =>
                  updateItem(a.id, { 역할: e.target.value || null })
                }
              />
            </EditorField>
            <div className="grid grid-cols-3 gap-2">
              <EditorField label="시작">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={a.기간_시작 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 기간_시작: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="종료">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  disabled={a.진행중}
                  value={a.기간_종료 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 기간_종료: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="기간 (원문)">
                <EditorTextInput
                  placeholder="자유 입력"
                  value={a.기간_원문 ?? ""}
                  onChange={(e) =>
                    updateItem(a.id, { 기간_원문: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <label className="flex items-center gap-2 text-caption text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={a.진행중}
                onChange={(e) =>
                  updateItem(a.id, {
                    진행중: e.target.checked,
                    기간_종료: e.target.checked ? null : a.기간_종료,
                  })
                }
                className="h-3.5 w-3.5"
              />
              진행 중
            </label>
            <BulletListEditor
              label="활동 내용"
              items={a.활동내용}
              onChange={(next) => updateItem(a.id, { 활동내용: next })}
            />
            <BulletListEditor
              label="성과"
              items={a.성과}
              onChange={(next) => updateItem(a.id, { 성과: next })}
            />
          </EditorCard>
        )}
      />
      <AddItemButton label="대외활동 추가" onClick={addItem} />
    </div>
  );
}
