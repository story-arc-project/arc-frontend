"use client";

import { Badge } from "@/components/ui/badge";
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2";
import type { ExperienceV2 } from "@/types/archive";

interface ResumeExperiencePickerProps {
  /** 이미 정렬된 목록을 그대로 그린다(정렬은 호출부 책임). */
  experiences: ExperienceV2[];
  /**
   * 선택은 "고른 id" 가 아니라 **제외한 id** 로 표현한다. 기본이 전체 선택이므로 초기값 ∅ 이
   * 곧 정책이고, 목록 로드가 끝나기를 기다렸다가 전체를 선택 상태로 밀어넣는 effect 가 필요 없다.
   */
  excludedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ResumeExperiencePicker({
  experiences,
  excludedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: ResumeExperiencePickerProps) {
  const total = experiences.length;
  const selectedCount = experiences.filter((e) => !excludedIds.has(e.id)).length;
  const allSelected = selectedCount === total && total > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm text-text-primary font-medium">
          경험 선택{" "}
          <span className="text-text-secondary font-normal">
            {selectedCount} / {total}개
          </span>
        </p>
        <button
          type="button"
          onClick={allSelected ? onClearAll : onSelectAll}
          className="text-caption text-text-secondary hover:text-text-primary underline-offset-2 hover:underline"
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      <ul className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {experiences.map((exp) => {
          const checked = !excludedIds.has(exp.id);
          const typeLabel = EXPERIENCE_TYPE_MAP[exp.typeId]?.label;
          return (
            <li key={exp.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-secondary">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(exp.id)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm text-text-primary">
                    {exp.title.trim() === "" ? "제목 없음" : exp.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
                    {typeLabel && (
                      <Badge className="shrink-0 whitespace-nowrap">{typeLabel}</Badge>
                    )}
                    {formatDate(exp.updatedAt)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
