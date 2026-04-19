"use client";

import { ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, X } from "lucide-react";

import type { ResumeVersion } from "@/types/resume";

// ─── EditorField: compact label + input pair ───────────────────────

const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function EditorField({ label, children }: FieldProps) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-caption font-medium text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

export function EditorTextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input type="text" {...props} className={`${inputClass} ${props.className ?? ""}`.trim()} />;
}

export function EditorTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`min-h-[80px] w-full min-w-0 rounded-md border border-border bg-surface p-3 text-body-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15 ${className ?? ""}`.trim()}
    />
  );
}

export function EditorSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: readonly string[];
    emptyLabel?: string;
  },
) {
  const { options, emptyLabel = "선택 안 함", className, ...rest } = props;
  return (
    <select
      {...rest}
      className={`${inputClass} ${className ?? ""}`.trim()}
    >
      <option value="">{emptyLabel}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

// ─── BulletListEditor: inline string[] editor ──────────────────────

interface BulletListEditorProps {
  label?: string;
  items: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}

export function BulletListEditor({
  label,
  items,
  placeholder = "내용을 입력하세요",
  onChange,
}: BulletListEditorProps) {
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <p className="text-caption font-medium text-text-secondary">{label}</p>
      )}
      {items.length === 0 ? (
        <p className="text-caption text-text-tertiary">항목이 없어요.</p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 text-text-tertiary">•</span>
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => update(i, e.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-1 shrink-0 p-1.5 rounded-md text-text-tertiary hover:text-error hover:bg-surface-tertiary transition-colors"
              aria-label="항목 삭제"
            >
              <X size={14} />
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 self-start text-caption text-text-secondary hover:text-text-primary transition-colors"
      >
        <Plus size={12} /> 추가
      </button>
    </div>
  );
}

// ─── TagArrayEditor: chips with inline input ───────────────────────

interface TagArrayEditorProps {
  label?: string;
  items: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}

export function TagArrayEditor({
  label,
  items,
  placeholder = "추가할 항목",
  onChange,
}: TagArrayEditorProps) {
  const addFromInput = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (items.includes(value)) return;
    onChange([...items, value]);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <p className="text-caption font-medium text-text-secondary">{label}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-surface-brand px-2.5 py-0.5 text-caption text-brand-dark"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(i)}
              className="hover:text-error"
              aria-label={`${item} 삭제`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              const target = e.currentTarget;
              addFromInput(target.value);
              target.value = "";
            } else if (e.key === "Backspace" && !e.currentTarget.value && items.length > 0) {
              remove(items.length - 1);
            }
          }}
          onBlur={(e) => {
            addFromInput(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
          className="min-w-[80px] flex-1 bg-transparent text-caption text-text-primary placeholder:text-text-tertiary outline-none"
        />
      </div>
    </div>
  );
}

// ─── Sortable list helpers ─────────────────────────────────────────

interface SortableListProps<T extends { id: number }> {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, handle: SortableHandle) => ReactNode;
}

type UseSortableReturn = ReturnType<typeof useSortable>;

export interface SortableHandle {
  setNodeRef: UseSortableReturn["setNodeRef"];
  attributes: UseSortableReturn["attributes"];
  listeners: UseSortableReturn["listeners"];
  style: { transform: string | undefined; transition: string | undefined; opacity: number };
}

export function SortableList<T extends { id: number }>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = [...items];
    const [moved] = next.splice(oldIdx, 1);
    next.splice(newIdx, 0, moved);
    onReorder(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableWrapper key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableWrapper>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWrapper({
  id,
  children,
}: {
  id: number;
  children: (handle: SortableHandle) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handle: SortableHandle = {
    setNodeRef,
    attributes,
    listeners,
    style,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}

// ─── Card shell for sortable list items ────────────────────────────

export function EditorCard({
  handle,
  onDelete,
  children,
}: {
  handle: SortableHandle;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2 rounded-md border border-border bg-surface p-3">
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-text-tertiary active:cursor-grabbing shrink-0 p-1"
        aria-label="순서 변경"
        {...handle.attributes}
        {...handle.listeners}
      >
        <GripVertical size={14} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
      <button
        type="button"
        onClick={onDelete}
        className="mt-0.5 shrink-0 p-1 text-text-tertiary hover:text-error transition-colors"
        aria-label="삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── ID helper for newly added items ───────────────────────────────

let clientIdCounter = -1;
export function nextClientId(): number {
  return clientIdCounter--;
}

// Reserve a counter floor below every id already present in the resume so
// newly-issued client ids never collide with restored draft ids.
export function reserveClientIds(resume: ResumeVersion): void {
  const sections: ReadonlyArray<ReadonlyArray<{ id: number }> | undefined> = [
    resume.학력,
    resume.경력,
    resume.자격증,
    resume.어학,
    resume.대외활동,
    resume.프로젝트,
    resume.수상,
    resume.동아리_학회,
  ];
  let min: number | null = null;
  for (const section of sections) {
    if (!section) continue;
    for (const item of section) {
      if (typeof item?.id === "number" && (min === null || item.id < min)) {
        min = item.id;
      }
    }
  }
  if (min !== null) {
    clientIdCounter = Math.min(clientIdCounter, min - 1);
  }
}

// ─── AddItemButton ─────────────────────────────────────────────────

export function AddItemButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-caption text-text-secondary hover:border-brand hover:text-brand transition-colors"
    >
      <Plus size={13} /> {label}
    </button>
  );
}
