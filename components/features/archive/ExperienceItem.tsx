"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui";
import type { ExperienceWithFolder, Template } from "@/types/archive";
import { getExperienceTitle, getExperiencePeriod } from "@/lib/constants/templates";

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
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      className={[
        "relative flex items-center gap-1 pl-2.5 pr-2.5 py-2 mx-1 rounded-md cursor-pointer transition-colors group/item",
        "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]",
        isDragging ? "opacity-50" : "",
        isActive
          ? "bg-surface-brand before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand before:rounded-full"
          : "hover:bg-surface-tertiary",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onClick(experience.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(experience.id);
        }
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {templateLabel && (
          <Badge variant="brand" className="text-[10px] py-0 self-start mb-0.5">
            {templateLabel}
          </Badge>
        )}
        <p
          className={[
            "text-body font-medium truncate",
            isActive ? "text-brand-dark" : "text-text-primary",
          ].join(" ")}
        >
          {title}
        </p>
        {period && (
          <p className="text-label text-text-tertiary truncate">{period}</p>
        )}
      </div>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 text-text-disabled cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        aria-label="순서 변경"
      >
        <Menu size={14} />
      </button>
    </div>
  );
}
