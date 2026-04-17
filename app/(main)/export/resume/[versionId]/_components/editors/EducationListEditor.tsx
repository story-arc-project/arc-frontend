"use client";

import type { Education } from "@/types/resume";
import {
  AddItemButton,
  EditorCard,
  EditorField,
  EditorSelect,
  EditorTextInput,
  nextClientId,
  SortableList,
} from "./shared";

const 전공구분Options = ["주전공", "복수전공", "부전공", "연계전공"] as const;
const 학위Options = ["학사", "석사", "박사", "전문학사"] as const;
const 졸업구분Options = ["졸업", "재학", "휴학", "수료", "중퇴", "졸업예정"] as const;

interface Props {
  value: Education[];
  onChange: (next: Education[]) => void;
}

export function EducationListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Education>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        학교명: null,
        학과: null,
        전공구분: null,
        학위: null,
        입학년월: null,
        졸업년월: null,
        졸업구분: null,
        학점: null,
        만점: null,
        비고: null,
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={value}
        onReorder={onChange}
        renderItem={(edu, handle) => (
          <EditorCard handle={handle} onDelete={() => removeItem(edu.id)}>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="학교명">
                <EditorTextInput
                  value={edu.학교명 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, { 학교명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="학과">
                <EditorTextInput
                  value={edu.학과 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, { 학과: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <EditorField label="전공 구분">
                <EditorSelect
                  options={전공구분Options}
                  value={edu.전공구분 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, {
                      전공구분: (e.target.value || null) as Education["전공구분"],
                    })
                  }
                />
              </EditorField>
              <EditorField label="학위">
                <EditorSelect
                  options={학위Options}
                  value={edu.학위 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, {
                      학위: (e.target.value || null) as Education["학위"],
                    })
                  }
                />
              </EditorField>
              <EditorField label="졸업 구분">
                <EditorSelect
                  options={졸업구분Options}
                  value={edu.졸업구분 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, {
                      졸업구분: (e.target.value || null) as Education["졸업구분"],
                    })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="입학년월">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={edu.입학년월 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, { 입학년월: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="졸업년월">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={edu.졸업년월 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, { 졸업년월: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <EditorField label="학점">
                <EditorTextInput
                  inputMode="decimal"
                  value={edu.학점 ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw === "" ? null : Number(raw);
                    updateItem(edu.id, {
                      학점: num !== null && Number.isFinite(num) ? num : null,
                    });
                  }}
                />
              </EditorField>
              <EditorField label="만점">
                <EditorTextInput
                  inputMode="decimal"
                  value={edu.만점 ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw === "" ? null : Number(raw);
                    updateItem(edu.id, {
                      만점: num !== null && Number.isFinite(num) ? num : null,
                    });
                  }}
                />
              </EditorField>
              <EditorField label="비고">
                <EditorTextInput
                  value={edu.비고 ?? ""}
                  onChange={(e) =>
                    updateItem(edu.id, { 비고: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
          </EditorCard>
        )}
      />
      <AddItemButton label="학력 추가" onClick={addItem} />
    </div>
  );
}
