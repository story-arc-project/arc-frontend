"use client";

import type { Career } from "@/types/resume";
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

const 고용형태Options = ["정규직", "계약직", "인턴", "파트타임", "프리랜서"] as const;

interface Props {
  value: Career[];
  onChange: (next: Career[]) => void;
}

export function CareerListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Career>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        회사명: null,
        부서: null,
        직위: null,
        고용형태: null,
        입사년월: null,
        퇴사년월: null,
        재직중: false,
        담당업무: [],
        성과: [],
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
              <EditorField label="회사명">
                <EditorTextInput
                  value={c.회사명 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 회사명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="부서">
                <EditorTextInput
                  value={c.부서 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 부서: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="직위">
                <EditorTextInput
                  value={c.직위 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 직위: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="고용형태">
                <EditorSelect
                  options={고용형태Options}
                  value={c.고용형태 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, {
                      고용형태: (e.target.value || null) as Career["고용형태"],
                    })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="입사년월">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={c.입사년월 ?? ""}
                  onChange={(e) =>
                    updateItem(c.id, { 입사년월: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="퇴사년월">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={c.퇴사년월 ?? ""}
                  disabled={c.재직중}
                  onChange={(e) =>
                    updateItem(c.id, { 퇴사년월: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <label className="flex items-center gap-2 text-caption text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={c.재직중}
                onChange={(e) =>
                  updateItem(c.id, {
                    재직중: e.target.checked,
                    퇴사년월: e.target.checked ? null : c.퇴사년월,
                  })
                }
                className="h-3.5 w-3.5"
              />
              현재 재직 중
            </label>
            <BulletListEditor
              label="담당 업무"
              items={c.담당업무}
              onChange={(next) => updateItem(c.id, { 담당업무: next })}
            />
            <BulletListEditor
              label="성과"
              items={c.성과}
              onChange={(next) => updateItem(c.id, { 성과: next })}
            />
          </EditorCard>
        )}
      />
      <AddItemButton label="경력 추가" onClick={addItem} />
    </div>
  );
}
