"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui";
import type { ExperienceWithFolder, Template } from "@/types/archive";
import { getExperienceTitle, getExperiencePeriod } from "@/lib/templates";

interface ExperienceItemProps {
  experience: ExperienceWithFolder;
  template: Template | undefined;
  isActive: boolean;
  onClick: (id: string) => void;
}

export function ExperienceItem({
  experience,
  template,
  isActive,
  onClick,
}: ExperienceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: experience.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = getExperienceTitle(experience.raw_text);
  const period = getExperiencePeriod(experience.raw_text);
  const templateLabel = template?.label ?? "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "relative flex items-center gap-1 pl-6 pr-2.5 py-2 mx-1 rounded-md cursor-pointer transition-colors group/item",
        isDragging ? "opacity-50" : "",
        isActive
          ? "bg-surface-brand before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand before:rounded-full"
          : "hover:bg-surface-tertiary",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onClick(experience.id)}
    >
      {/* Drag handle — desktop only, shown on hover.
          onMouseDown: prevent the browser from starting a text-selection
          drag before dnd-kit's activation distance is met. */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-0.5 top-1/2 -translate-y-1/2 hidden lg:flex w-5 h-5 items-center justify-center opacity-0 group-hover/item:opacity-100 text-text-disabled cursor-grab active:cursor-grabbing transition-opacity"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        aria-label="순서 변경"
      >
        <GripVertical size={12} />
      </button>

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {templateLabel && (
          <Badge variant="brand" className="text-[10px] px-1.5 py-0 self-start mb-0.5">
            {templateLabel}
          </Badge>
        )}
        <p
          className={[
            "text-body-sm font-medium truncate",
            isActive ? "text-brand-dark" : "text-text-primary",
          ].join(" ")}
        >
          {title}
        </p>
        {period && (
          <p className="text-caption text-text-tertiary truncate">{period}</p>
        )}
      </div>
    </div>
  );
}
