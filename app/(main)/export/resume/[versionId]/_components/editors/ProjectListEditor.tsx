"use client";

import type { Project } from "@/types/resume";
import {
  AddItemButton,
  BulletListEditor,
  EditorCard,
  EditorField,
  EditorTextInput,
  nextClientId,
  SortableList,
  TagArrayEditor,
} from "./shared";

interface Props {
  value: Project[];
  onChange: (next: Project[]) => void;
}

export function ProjectListEditor({ value, onChange }: Props) {
  const updateItem = (id: number, patch: Partial<Project>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () =>
    onChange([
      ...value,
      {
        id: nextClientId(),
        프로젝트명: null,
        소속기관: null,
        기간_시작: null,
        기간_종료: null,
        기간_원문: null,
        역할: null,
        사용기술: [],
        내용: [],
        성과: [],
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={value}
        onReorder={onChange}
        renderItem={(p, handle) => (
          <EditorCard handle={handle} onDelete={() => removeItem(p.id)}>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="프로젝트명">
                <EditorTextInput
                  value={p.프로젝트명 ?? ""}
                  onChange={(e) =>
                    updateItem(p.id, { 프로젝트명: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="소속 기관">
                <EditorTextInput
                  value={p.소속기관 ?? ""}
                  onChange={(e) =>
                    updateItem(p.id, { 소속기관: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <EditorField label="역할">
              <EditorTextInput
                value={p.역할 ?? ""}
                onChange={(e) =>
                  updateItem(p.id, { 역할: e.target.value || null })
                }
              />
            </EditorField>
            <div className="grid grid-cols-3 gap-2">
              <EditorField label="시작">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={p.기간_시작 ?? ""}
                  onChange={(e) =>
                    updateItem(p.id, { 기간_시작: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="종료">
                <EditorTextInput
                  placeholder="YYYY-MM"
                  value={p.기간_종료 ?? ""}
                  onChange={(e) =>
                    updateItem(p.id, { 기간_종료: e.target.value || null })
                  }
                />
              </EditorField>
              <EditorField label="기간 (원문)">
                <EditorTextInput
                  placeholder="자유 입력"
                  value={p.기간_원문 ?? ""}
                  onChange={(e) =>
                    updateItem(p.id, { 기간_원문: e.target.value || null })
                  }
                />
              </EditorField>
            </div>
            <TagArrayEditor
              label="사용 기술"
              items={p.사용기술}
              placeholder="예: React, Figma"
              onChange={(next) => updateItem(p.id, { 사용기술: next })}
            />
            <BulletListEditor
              label="내용"
              items={p.내용}
              onChange={(next) => updateItem(p.id, { 내용: next })}
            />
            <BulletListEditor
              label="성과"
              items={p.성과}
              onChange={(next) => updateItem(p.id, { 성과: next })}
            />
          </EditorCard>
        )}
      />
      <AddItemButton label="프로젝트 추가" onClick={addItem} />
    </div>
  );
}
