"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

import {
  type DemoFieldDef,
  type DemoFieldValue,
  type DemoPeriod,
  type DemoRow,
} from "./landing-demo-fields";

/**
 * 랜딩 체험의 입력칸 하나 (FRT-339).
 *
 * 실제 폼과 같은 순서로 그린다 — 라벨 → **가이드 문구** → 입력칸. 우리가 얼마나 자세히
 * 묻는지가 이 가운데 줄에 있으므로, 좁다고 지우지 않는다.
 */

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-border text-body-sm text-text-primary bg-surface-secondary placeholder:text-text-tertiary focus:outline-none focus:border-brand";

const MAX_ROWS = 3;

interface Props {
  field: DemoFieldDef;
  value: DemoFieldValue;
  onChange: (next: DemoFieldValue) => void;
}

export default function LandingDemoField({ field, value, onChange }: Props) {
  const fieldId = useId();
  const guideId = `${fieldId}-guide`;

  const guide = (
    <p id={guideId} className="text-caption text-text-tertiary mt-0.5 mb-1.5 leading-[1.5]">
      {field.guide}
    </p>
  );
  const control = (
    <FieldControl
      field={field}
      value={value}
      onChange={onChange}
      fieldId={fieldId}
      guideId={guideId}
    />
  );

  // 기간·표는 입력칸이 여럿이라 label 하나로 묶이지 않는다 → fieldset/legend.
  // `min-w-0` 은 fieldset 의 UA `min-inline-size: min-content` 를 지우는 것이다 (FRT-318).
  if (field.format === "period" || field.format === "rows") {
    return (
      <fieldset className="mb-4 min-w-0">
        <legend className="block text-body-sm text-text-secondary">{field.label}</legend>
        {guide}
        {control}
      </fieldset>
    );
  }

  return (
    <div className="mb-4">
      <label htmlFor={fieldId} className="block text-body-sm text-text-secondary">
        {field.label}
      </label>
      {guide}
      {control}
    </div>
  );
}

interface ControlProps extends Props {
  fieldId: string;
  guideId: string;
}

function FieldControl({ field, value, onChange, fieldId, guideId }: ControlProps) {
  switch (field.format) {
    case "textarea":
      return (
        <textarea
          id={fieldId}
          aria-describedby={guideId}
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-border text-body-sm text-text-primary bg-surface-secondary placeholder:text-text-tertiary focus:outline-none focus:border-brand resize-none"
        />
      );

    case "select":
      return (
        <select
          id={fieldId}
          aria-describedby={guideId}
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">선택해주세요</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "date":
      return (
        <input
          id={fieldId}
          aria-describedby={guideId}
          type="date"
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
        />
      );

    case "period":
      return <PeriodControl value={asPeriod(value)} onChange={onChange} guideId={guideId} />;

    case "tags":
      return <TagsControl field={field} value={asTags(value)} onChange={onChange} fieldId={fieldId} guideId={guideId} />;

    case "rows":
      return <RowsControl field={field} value={asRows(value)} onChange={onChange} guideId={guideId} />;

    default:
      return (
        <input
          id={fieldId}
          aria-describedby={guideId}
          type="text"
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT_CLASS}
        />
      );
  }
}

function PeriodControl({
  value,
  onChange,
  guideId,
}: {
  value: DemoPeriod;
  onChange: (next: DemoFieldValue) => void;
  guideId: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        aria-label="시작 시점"
        aria-describedby={guideId}
        value={value.start}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        className={`${INPUT_CLASS} flex-1 min-w-0`}
      />
      <span className="text-caption text-text-tertiary shrink-0">—</span>
      <input
        type="month"
        aria-label="종료 시점"
        aria-describedby={guideId}
        value={value.end}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        className={`${INPUT_CLASS} flex-1 min-w-0`}
      />
    </div>
  );
}

function TagsControl({
  field,
  value,
  onChange,
  fieldId,
  guideId,
}: {
  field: DemoFieldDef;
  value: string[];
  onChange: (next: DemoFieldValue) => void;
  fieldId: string;
  guideId: string;
}) {
  const [text, setText] = useState("");

  function commit(raw: string) {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (!tag || value.includes(tag)) {
      setText("");
      return;
    }
    onChange([...value, tag]);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중의 Enter 는 확정 키다 — 태그로 삼으면 글자가 잘린다 (FRT-172).
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(text);
    }
  }

  return (
    <div>
      <input
        id={fieldId}
        aria-describedby={guideId}
        type="text"
        value={text}
        onChange={(e) => {
          // 쉼표로도 확정된다 — Enter 를 모르는 사람이 더 많다.
          if (e.target.value.endsWith(",")) commit(e.target.value);
          else setText(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(text)}
        placeholder={field.placeholder}
        className={INPUT_CLASS}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-surface-tertiary px-2.5 py-1 text-caption text-text-secondary"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`${tag} 삭제`}
                className="text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RowsControl({
  field,
  value,
  onChange,
  guideId,
}: {
  field: DemoFieldDef;
  value: DemoRow[];
  onChange: (next: DemoFieldValue) => void;
  guideId: string;
}) {
  const columns = field.columns ?? [];

  function updateCell(rowId: string, columnKey: string, cellValue: string) {
    onChange(
      value.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnKey]: cellValue } } : row
      )
    );
  }

  function addRow() {
    if (value.length >= MAX_ROWS) return;
    onChange([
      ...value,
      {
        id: `${field.key}-${crypto.randomUUID()}`,
        cells: Object.fromEntries(columns.map((c) => [c.key, ""])),
      },
    ]);
  }

  return (
    <div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-2 bg-surface-tertiary">
          {columns.map((column) => (
            <span key={column.key} className="px-3 py-1.5 text-caption text-text-secondary">
              {column.label}
            </span>
          ))}
        </div>
        {value.map((row, rowIndex) => (
          <div key={row.id} className="grid grid-cols-2 border-t border-border">
            {columns.map((column, columnIndex) => (
              <div key={column.key} className="relative">
                <input
                  type="text"
                  aria-label={`${rowIndex + 1}번째 줄 ${column.label}`}
                  // 가이드는 셀마다 붙인다 — 설명은 조상에서 상속되지 않는다.
                  aria-describedby={guideId}
                  value={row.cells[column.key] ?? ""}
                  onChange={(e) => updateCell(row.id, column.key, e.target.value)}
                  placeholder={column.placeholder}
                  className={`w-full h-9 px-3 text-body-sm text-text-primary bg-surface placeholder:text-text-tertiary focus:outline-none focus:bg-surface-secondary ${
                    columnIndex === 0 ? "border-r border-border" : ""
                  }`}
                />
                {columnIndex === columns.length - 1 && value.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((r) => r.id !== row.id))}
                    aria-label={`${rowIndex + 1}번째 줄 삭제`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {value.length < MAX_ROWS && (
        <button
          type="button"
          onClick={addRow}
          className="mt-1.5 inline-flex items-center gap-1 text-caption text-brand hover:text-brand-dark transition-colors"
        >
          <Plus size={11} aria-hidden="true" />줄 추가
        </button>
      )}
    </div>
  );
}

function asText(value: DemoFieldValue): string {
  return typeof value === "string" ? value : "";
}

function asTags(value: DemoFieldValue): string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string") ? (value as string[]) : [];
}

function asRows(value: DemoFieldValue): DemoRow[] {
  return Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null && "cells" in v)
    ? (value as DemoRow[])
    : [];
}

function asPeriod(value: DemoFieldValue): DemoPeriod {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DemoPeriod)
    : { start: "", end: "" };
}
